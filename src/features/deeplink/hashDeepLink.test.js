import { describe, expect, it } from 'vitest'
import { buildEpisodeHash, parseEpisodeHash } from './hashDeepLink'

describe('hash deep-link helpers', () => {
  it('parses episode hash with start and duration', () => {
    expect(parseEpisodeHash('#episode=marius-roi-panier&t=25&d=22')).toEqual({
      rawHash: '#episode=marius-roi-panier&t=25&d=22',
      episodeSlug: 'marius-roi-panier',
      hasStart: true,
      startSeconds: 25,
      hasDuration: true,
      durationSeconds: 22,
    })
  })

  it('returns null without valid episode parameter', () => {
    expect(parseEpisodeHash('#t=10&d=20')).toBeNull()
    expect(parseEpisodeHash('')).toBeNull()
  })

  it('builds a normalized hash', () => {
    expect(buildEpisodeHash({ episodeSlug: 'marius-roi-panier', startSeconds: 8, durationSeconds: 20 })).toBe(
      '#episode=marius-roi-panier&t=8&d=20',
    )
  })
})
