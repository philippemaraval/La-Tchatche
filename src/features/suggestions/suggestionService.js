import { prependStoredJsonItem } from '../../lib/storage'

const DEFAULT_ENDPOINT = '/api/suggestions'

function normalizeText(value) {
  return String(value || '').trim()
}

export function normalizeSuggestionForm(form) {
  return {
    name: normalizeText(form?.name),
    email: normalizeText(form?.email),
    category: normalizeText(form?.category),
    location: normalizeText(form?.location),
    pitch: normalizeText(form?.pitch),
  }
}

export function validateSuggestionPayload(payload) {
  if (!payload.name || !payload.category || !payload.location || !payload.pitch) {
    return {
      valid: false,
      message: 'Merci de remplir les champs obligatoires.',
    }
  }

  return {
    valid: true,
    message: '',
  }
}

function buildLocalSuggestionItem(payload, idFactory = () => `sugg-${Date.now()}`) {
  return {
    id: idFactory(),
    createdAt: new Date().toISOString(),
    ...payload,
  }
}

async function postSuggestion(payload, endpoint, fetchImpl) {
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`suggestion-api-${response.status}`)
  }

  let responseBody = null
  try {
    responseBody = await response.json()
  } catch {
    responseBody = null
  }

  const id =
    responseBody && typeof responseBody === 'object'
      ? typeof responseBody.id === 'string'
        ? responseBody.id
        : responseBody.data && typeof responseBody.data.id === 'string'
          ? responseBody.data.id
          : null
      : null

  return { id }
}

export async function submitSuggestionWithFallback({
  form,
  endpoint = DEFAULT_ENDPOINT,
  localStorageKey,
  fetchImpl = fetch,
  storage,
}) {
  const payload = normalizeSuggestionForm(form)
  const validation = validateSuggestionPayload(payload)

  if (!validation.valid) {
    return {
      ok: false,
      reason: 'validation',
      message: validation.message,
      payload,
    }
  }

  const fallbackItem = buildLocalSuggestionItem(payload)

  try {
    const targetEndpoint = String(endpoint || '').trim() || DEFAULT_ENDPOINT
    const apiResult = await postSuggestion(payload, targetEndpoint, fetchImpl)

    return {
      ok: true,
      source: 'api',
      id: apiResult.id || fallbackItem.id,
      payload,
    }
  } catch (error) {
    try {
      prependStoredJsonItem(localStorageKey, fallbackItem, storage)
      return {
        ok: true,
        source: 'local',
        id: fallbackItem.id,
        payload,
        error,
      }
    } catch {
      return {
        ok: false,
        reason: 'storage',
        message: 'Envoi indisponible pour le moment. Reessaye plus tard.',
        payload,
      }
    }
  }
}
