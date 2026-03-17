import { describe, expect, it } from 'vitest'
import { formatAudioTime, normalizeSeconds, splitSeconds, toWholeSeconds } from '../time.js'

describe('audio time helpers', () => {
  it('normalizes invalid and negative values', () => {
    expect(normalizeSeconds(-4)).toBe(0)
    expect(normalizeSeconds('12.4')).toBe(12.4)
    expect(normalizeSeconds('abc', 7)).toBe(7)
  })

  it('floors normalized values', () => {
    expect(toWholeSeconds('12.9')).toBe(12)
    expect(toWholeSeconds(undefined)).toBe(0)
  })

  it('returns canonical split parts', () => {
    expect(splitSeconds(3661)).toEqual({
      total: 3661,
      hours: 1,
      minutes: 1,
      seconds: 1,
    })
  })

  it('formats as m:ss by default and h:mm:ss when needed', () => {
    expect(formatAudioTime(5)).toBe('0:05')
    expect(formatAudioTime(125)).toBe('2:05')
    expect(formatAudioTime(3661)).toBe('1:01:01')
    expect(formatAudioTime(125, { forceHours: true })).toBe('0:02:05')
  })
})
