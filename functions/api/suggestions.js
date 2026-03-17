const REQUIRED_FIELDS = ['name', 'category', 'location', 'pitch']
const OPTIONAL_FIELDS = ['email']
const MAX_LENGTH = {
  name: 120,
  email: 254,
  category: 80,
  location: 180,
  pitch: 2000,
}

const memorySuggestions = []

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  })
}

function sanitizeText(value, maxLength) {
  const normalized = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!maxLength) {
    return normalized
  }

  return normalized.slice(0, maxLength)
}

function isValidEmail(email) {
  if (!email) {
    return true
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function createSuggestionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sugg_${crypto.randomUUID()}`
  }
  return `sugg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function getCorsHeaders(request) {
  const requestUrl = new URL(request.url)
  const origin = request.headers.get('origin')
  const sameOrigin = !origin || origin === requestUrl.origin

  if (!sameOrigin) {
    return { sameOrigin: false, headers: {} }
  }

  return {
    sameOrigin: true,
    headers: {
      'Access-Control-Allow-Origin': origin || requestUrl.origin,
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  }
}

function normalizePayload(payload) {
  const normalized = {}

  for (const field of REQUIRED_FIELDS) {
    normalized[field] = sanitizeText(payload?.[field], MAX_LENGTH[field])
  }

  for (const field of OPTIONAL_FIELDS) {
    normalized[field] = sanitizeText(payload?.[field], MAX_LENGTH[field])
  }

  return normalized
}

function validatePayload(payload) {
  const missingFields = REQUIRED_FIELDS.filter((field) => !payload[field])
  const errors = []

  if (missingFields.length > 0) {
    errors.push({
      code: 'missing_required_fields',
      fields: missingFields,
      message: 'Champs obligatoires manquants.',
    })
  }

  if (!isValidEmail(payload.email)) {
    errors.push({
      code: 'invalid_email',
      fields: ['email'],
      message: 'Adresse email invalide.',
    })
  }

  return errors
}

async function saveToD1(env, suggestion) {
  const db = env?.DB
  if (!db || typeof db.prepare !== 'function') {
    return null
  }

  await db
    .prepare(
      `INSERT INTO suggestions (id, created_at, name, email, category, location, pitch)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(
      suggestion.id,
      suggestion.createdAt,
      suggestion.name,
      suggestion.email || null,
      suggestion.category,
      suggestion.location,
      suggestion.pitch,
    )
    .run()

  return {
    mode: 'd1',
    warning: null,
  }
}

async function saveToKv(env, suggestion) {
  const kv = env?.SUGGESTIONS_KV
  if (!kv || typeof kv.put !== 'function' || typeof kv.get !== 'function') {
    return null
  }

  const itemKey = `suggestion:${suggestion.id}`
  const indexKey = 'suggestions:index'

  await kv.put(itemKey, JSON.stringify(suggestion))

  const rawIndex = await kv.get(indexKey)
  const parsed = rawIndex ? JSON.parse(rawIndex) : []
  const nextIndex = Array.isArray(parsed) ? parsed : []
  nextIndex.unshift(suggestion.id)

  // Garde un index compact des derniers IDs uniquement.
  const capped = nextIndex.slice(0, 500)
  await kv.put(indexKey, JSON.stringify(capped))

  return {
    mode: 'kv',
    warning: null,
  }
}

function saveToMemory(suggestion) {
  memorySuggestions.unshift(suggestion)
  if (memorySuggestions.length > 500) {
    memorySuggestions.length = 500
  }

  return {
    mode: 'memory',
    warning:
      'Stockage de secours en memoire volatile: les donnees peuvent etre perdues au redemarrage de la fonction.',
  }
}

async function persistSuggestion(env, suggestion) {
  try {
    const d1Result = await saveToD1(env, suggestion)
    if (d1Result) {
      return d1Result
    }
  } catch (error) {
    void error
  }

  try {
    const kvResult = await saveToKv(env, suggestion)
    if (kvResult) {
      return kvResult
    }
  } catch (error) {
    void error
  }

  return saveToMemory(suggestion)
}

export async function onRequest(context) {
  const { request, env } = context
  const { sameOrigin, headers: corsHeaders } = getCorsHeaders(request)

  if (!sameOrigin) {
    return json(
      {
        ok: false,
        error: {
          code: 'forbidden_origin',
          message: 'Origine non autorisee.',
        },
      },
      403,
      corsHeaders,
    )
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  if (request.method !== 'POST') {
    return json(
      {
        ok: false,
        error: {
          code: 'method_not_allowed',
          message: 'Methode non autorisee. Utilisez POST.',
        },
      },
      405,
      {
        ...corsHeaders,
        Allow: 'POST, OPTIONS',
      },
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json(
      {
        ok: false,
        error: {
          code: 'invalid_json',
          message: 'Payload JSON invalide.',
        },
      },
      400,
      corsHeaders,
    )
  }

  const payload = normalizePayload(body)
  const validationErrors = validatePayload(payload)

  if (validationErrors.length > 0) {
    return json(
      {
        ok: false,
        error: {
          code: 'validation_error',
          message: 'Validation echouee.',
          details: validationErrors,
        },
      },
      422,
      corsHeaders,
    )
  }

  const suggestion = {
    id: createSuggestionId(),
    createdAt: new Date().toISOString(),
    ...payload,
  }

  const storage = await persistSuggestion(env, suggestion)

  return json(
    {
      ok: true,
      data: {
        id: suggestion.id,
        createdAt: suggestion.createdAt,
      },
      storage,
    },
    201,
    corsHeaders,
  )
}
