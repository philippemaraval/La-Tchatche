const DEFAULT_FALLBACK_SECONDS = 0

function parseFiniteNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeSeconds(value, fallback = DEFAULT_FALLBACK_SECONDS) {
  const parsed = parseFiniteNumber(value)
  if (parsed === null || parsed < 0) {
    const safeFallback = parseFiniteNumber(fallback)
    return safeFallback !== null && safeFallback > 0 ? safeFallback : 0
  }
  return parsed
}

export function toWholeSeconds(value, fallback = DEFAULT_FALLBACK_SECONDS) {
  return Math.floor(normalizeSeconds(value, fallback))
}

export function splitSeconds(value) {
  const total = toWholeSeconds(value, 0)
  return {
    total,
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

export function formatAudioTime(value, options = {}) {
  const { forceHours = false } = options
  const { hours, minutes, seconds } = splitSeconds(value)

  if (forceHours || hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  const totalMinutes = hours * 60 + minutes
  return `${totalMinutes}:${String(seconds).padStart(2, '0')}`
}
