const MIN_QUOTE_DURATION = 15
const MAX_QUOTE_DURATION = 30

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function decodePart(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function parseHashParams(hash) {
  const normalizedHash = String(hash || '').trim().replace(/^#/, '')
  if (!normalizedHash) {
    return new Map()
  }

  const map = new Map()
  const tokens = normalizedHash.split(/[&,]/).filter(Boolean)

  for (const token of tokens) {
    const [rawKey, ...rest] = token.split('=')
    if (!rawKey) {
      continue
    }

    const key = decodePart(rawKey).trim().toLowerCase()
    const value = decodePart(rest.join('=').trim())
    if (!key) {
      continue
    }

    map.set(key, value)
  }

  return map
}

function parseNumericParam(value) {
  if (value == null || value === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.floor(parsed) : null
}

export function parseEpisodeHash(hash) {
  const params = parseHashParams(hash)
  const rawEpisode = params.get('episode')
  const episodeSlug = rawEpisode ? rawEpisode.trim() : ''

  if (!episodeSlug) {
    return null
  }

  const tValue = parseNumericParam(params.get('t'))
  const dValue = parseNumericParam(params.get('d'))

  return {
    rawHash: String(hash || ''),
    episodeSlug,
    hasStart: typeof tValue === 'number',
    startSeconds: tValue == null ? 0 : Math.max(0, tValue),
    hasDuration: typeof dValue === 'number',
    durationSeconds:
      dValue == null ? 20 : clamp(Math.max(0, dValue), MIN_QUOTE_DURATION, MAX_QUOTE_DURATION),
  }
}

export function buildEpisodeHash({ episodeSlug, startSeconds, durationSeconds }) {
  const slug = String(episodeSlug || '').trim()
  if (!slug) {
    return '#'
  }

  const parts = [`episode=${encodeURIComponent(slug)}`]

  if (Number.isFinite(startSeconds)) {
    parts.push(`t=${Math.max(0, Math.floor(startSeconds))}`)
  }

  if (Number.isFinite(durationSeconds)) {
    const clampedDuration = clamp(
      Math.max(0, Math.floor(durationSeconds)),
      MIN_QUOTE_DURATION,
      MAX_QUOTE_DURATION,
    )
    parts.push(`d=${clampedDuration}`)
  }

  return `#${parts.join('&')}`
}
