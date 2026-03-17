export const OFFLINE_AUDIO_CACHE_KEY = 'la-tchatche-audio-v1'

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.ogg', '.wav', '.flac', '.webm']
const DEFAULT_BASE_URL = 'https://la-tchatche.local'

function asString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asUrl(value, baseUrl = DEFAULT_BASE_URL) {
  const raw = asString(value)
  if (!raw) {
    return null
  }

  try {
    return new URL(raw, baseUrl)
  } catch {
    return null
  }
}

export function buildAudioCacheLookupKey(audioUrl, options = {}) {
  const { includeSearch = false, includeHash = false, baseUrl = DEFAULT_BASE_URL } = options
  const url = asUrl(audioUrl, baseUrl)

  if (!url) {
    return ''
  }

  if (!includeSearch) {
    url.search = ''
  }

  if (!includeHash) {
    url.hash = ''
  }

  return url.toString()
}

export function isAudioLikeUrl(audioUrl, options = {}) {
  const raw = asString(audioUrl).toLowerCase()
  if (!raw) {
    return false
  }

  if (raw.startsWith('data:audio/')) {
    return true
  }

  const lookup = buildAudioCacheLookupKey(audioUrl, options)
  if (!lookup) {
    return false
  }

  const pathname = new URL(lookup).pathname.toLowerCase()
  return AUDIO_EXTENSIONS.some((extension) => pathname.endsWith(extension))
}

export function toggleOfflineEpisodeId(currentIds, episodeId, forceState) {
  const ids = Array.isArray(currentIds)
    ? Array.from(new Set(currentIds.filter((id) => typeof id === 'string' && id.trim().length > 0)))
    : []
  const targetId = asString(episodeId)

  if (!targetId) {
    return ids
  }

  const alreadyExists = ids.includes(targetId)
  const shouldInclude = typeof forceState === 'boolean' ? forceState : !alreadyExists

  if (shouldInclude) {
    return alreadyExists ? ids : [...ids, targetId]
  }

  return alreadyExists ? ids.filter((id) => id !== targetId) : ids
}
