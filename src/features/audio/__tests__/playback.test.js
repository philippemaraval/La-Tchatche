import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PLAYBACK_RATES,
  calculatePlaybackProgress,
  clampNumber,
  clampSeekPosition,
  computeResumePosition,
  isPlaybackRateAllowed,
  normalizePlaybackRate,
  seekFromProgress,
  shiftSeekPosition,
  shouldClearStoredPosition,
} from '../playback.js'

describe('audio playback helpers', () => {
  it('clamps invalid values and swapped bounds', () => {
    expect(clampNumber(20, 0, 10)).toBe(10)
    expect(clampNumber(-2, 0, 10)).toBe(0)
    expect(clampNumber(5, 10, 0)).toBe(5)
    expect(clampNumber('abc', 1, 10)).toBe(1)
  })

  it('clamps seek to duration when duration exists', () => {
    expect(clampSeekPosition(12, 10)).toBe(10)
    expect(clampSeekPosition(-4, 10)).toBe(0)
    expect(clampSeekPosition(4, 0)).toBe(4)
  })

  it('applies seek delta and respects boundaries', () => {
    expect(shiftSeekPosition(5, 4, 10)).toBe(9)
    expect(shiftSeekPosition(5, -10, 10)).toBe(0)
    expect(shiftSeekPosition(5, 100, 8)).toBe(8)
  })

  it('returns progress ratio and percent', () => {
    expect(calculatePlaybackProgress(25, 100)).toEqual({
      seek: 25,
      duration: 100,
      ratio: 0.25,
      percent: 25,
    })
    expect(calculatePlaybackProgress(20, 0)).toEqual({
      seek: 0,
      duration: 0,
      ratio: 0,
      percent: 0,
    })
  })

  it('converts percent to seek and clamps out of range values', () => {
    expect(seekFromProgress(50, 200)).toBe(100)
    expect(seekFromProgress(120, 200)).toBe(200)
    expect(seekFromProgress(-5, 200)).toBe(0)
  })

  it('detects when stored position should be cleared', () => {
    expect(shouldClearStoredPosition(0, 240)).toBe(true)
    expect(shouldClearStoredPosition(100, 240)).toBe(false)
    expect(shouldClearStoredPosition(236, 240)).toBe(true)
    expect(shouldClearStoredPosition(236, 240, { nearEndThresholdSeconds: 2 })).toBe(false)
  })

  it('clamps resume position with optional tail padding', () => {
    expect(computeResumePosition(120, 200)).toBe(120)
    expect(computeResumePosition(250, 200)).toBe(199)
    expect(computeResumePosition(250, 200, { tailPaddingSeconds: 1 })).toBe(199)
    expect(computeResumePosition(-20, 200)).toBe(0)
  })

  it('validates and normalizes playback rates', () => {
    expect(isPlaybackRateAllowed(1.2, DEFAULT_PLAYBACK_RATES)).toBe(true)
    expect(isPlaybackRateAllowed(1.1, DEFAULT_PLAYBACK_RATES)).toBe(false)
    expect(normalizePlaybackRate(1.2)).toBe(1.2)
    expect(normalizePlaybackRate(1.1)).toBe(1)
    expect(normalizePlaybackRate(3, { allowedRates: [0.75, 1.25], fallbackRate: 1.25 })).toBe(1.25)
  })
})
