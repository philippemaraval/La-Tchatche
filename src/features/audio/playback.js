import { normalizeSeconds, toWholeSeconds } from './time.js'

export const DEFAULT_PLAYBACK_RATES = Object.freeze([0.8, 1, 1.2, 1.5])

function parseFiniteNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function sanitizePlaybackRates(rates) {
  if (!Array.isArray(rates)) {
    return [...DEFAULT_PLAYBACK_RATES]
  }

  const unique = Array.from(
    new Set(
      rates
        .map((rate) => parseFiniteNumber(rate))
        .filter((rate) => rate !== null && rate > 0),
    ),
  )

  return unique.length > 0 ? unique : [...DEFAULT_PLAYBACK_RATES]
}

export function clampNumber(value, min, max) {
  const parsedValue = parseFiniteNumber(value)
  const parsedMin = parseFiniteNumber(min)
  const parsedMax = parseFiniteNumber(max)

  const lowerBound = parsedMin ?? 0
  const upperBound = parsedMax ?? lowerBound
  const safeMin = Math.min(lowerBound, upperBound)
  const safeMax = Math.max(lowerBound, upperBound)

  if (parsedValue === null) {
    return safeMin
  }

  return Math.min(safeMax, Math.max(safeMin, parsedValue))
}

export function clampSeekPosition(seekSeconds, durationSeconds) {
  const safeSeek = normalizeSeconds(seekSeconds, 0)
  const safeDuration = normalizeSeconds(durationSeconds, 0)

  if (safeDuration <= 0) {
    return safeSeek
  }

  return clampNumber(safeSeek, 0, safeDuration)
}

export function shiftSeekPosition(currentSeekSeconds, deltaSeconds, durationSeconds) {
  const safeCurrentSeek = normalizeSeconds(currentSeekSeconds, 0)
  const safeDelta = parseFiniteNumber(deltaSeconds) ?? 0
  return clampSeekPosition(safeCurrentSeek + safeDelta, durationSeconds)
}

export function calculatePlaybackProgress(seekSeconds, durationSeconds) {
  const safeDuration = normalizeSeconds(durationSeconds, 0)
  if (safeDuration <= 0) {
    return { seek: 0, duration: 0, ratio: 0, percent: 0 }
  }

  const safeSeek = clampSeekPosition(seekSeconds, safeDuration)
  const ratio = safeSeek / safeDuration

  return {
    seek: safeSeek,
    duration: safeDuration,
    ratio,
    percent: ratio * 100,
  }
}

export function seekFromProgress(progressPercent, durationSeconds) {
  const safeDuration = normalizeSeconds(durationSeconds, 0)
  if (safeDuration <= 0) {
    return 0
  }

  const safeProgress = clampNumber(progressPercent, 0, 100)
  return (safeProgress / 100) * safeDuration
}

export function shouldClearStoredPosition(seekSeconds, durationSeconds, options = {}) {
  const seek = toWholeSeconds(seekSeconds, 0)
  if (seek <= 0) {
    return true
  }

  const duration = toWholeSeconds(durationSeconds, 0)
  if (duration <= 0) {
    return false
  }

  const nearEndThreshold = clampNumber(options.nearEndThresholdSeconds ?? 5, 0, duration)
  const clearFrom = Math.max(0, duration - nearEndThreshold)
  return seek >= clearFrom
}

export function computeResumePosition(storedPositionSeconds, durationSeconds, options = {}) {
  const safeDuration = normalizeSeconds(durationSeconds, 0)
  if (safeDuration <= 0) {
    return 0
  }

  const tailPadding = clampNumber(options.tailPaddingSeconds ?? 1, 0, safeDuration)
  const maxResume = Math.max(0, safeDuration - tailPadding)
  return clampNumber(normalizeSeconds(storedPositionSeconds, 0), 0, maxResume)
}

export function isPlaybackRateAllowed(rate, allowedRates = DEFAULT_PLAYBACK_RATES) {
  const rates = sanitizePlaybackRates(allowedRates)
  const parsed = parseFiniteNumber(rate)
  return parsed !== null && rates.includes(parsed)
}

export function normalizePlaybackRate(rate, options = {}) {
  const rates = sanitizePlaybackRates(options.allowedRates)
  const fallbackCandidate = parseFiniteNumber(options.fallbackRate)
  const fallbackRate =
    fallbackCandidate !== null && rates.includes(fallbackCandidate)
      ? fallbackCandidate
      : rates.includes(1)
        ? 1
        : rates[0]

  const parsed = parseFiniteNumber(rate)
  return parsed !== null && rates.includes(parsed) ? parsed : fallbackRate
}
