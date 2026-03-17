import { describe, expect, it } from 'vitest'
import {
  OFFLINE_AUDIO_CACHE_KEY,
  buildAudioCacheLookupKey,
  isAudioLikeUrl,
  toggleOfflineEpisodeId,
} from '../offline.js'

describe('audio offline helpers', () => {
  it('keeps cache key aligned with the service worker namespace', () => {
    expect(OFFLINE_AUDIO_CACHE_KEY).toBe('la-tchatche-audio-v1')
  })

  it('strips search/hash by default in cache lookup keys', () => {
    const key = buildAudioCacheLookupKey('https://cdn.example.com/story.mp3?token=abc#intro')
    expect(key).toBe('https://cdn.example.com/story.mp3')
  })

  it('can keep search/hash when requested', () => {
    const key = buildAudioCacheLookupKey('https://cdn.example.com/story.mp3?token=abc#intro', {
      includeSearch: true,
      includeHash: true,
    })
    expect(key).toBe('https://cdn.example.com/story.mp3?token=abc#intro')
  })

  it('detects file extension and data URLs', () => {
    expect(isAudioLikeUrl('https://cdn.example.com/story.mp3?token=abc')).toBe(true)
    expect(isAudioLikeUrl('data:audio/mp3;base64,AAAA')).toBe(true)
    expect(isAudioLikeUrl('https://cdn.example.com/story.txt')).toBe(false)
    expect(isAudioLikeUrl('')).toBe(false)
  })

  it('toggles IDs deterministically for add/remove operations', () => {
    expect(toggleOfflineEpisodeId([], 'ep-01')).toEqual(['ep-01'])
    expect(toggleOfflineEpisodeId(['ep-01'], 'ep-01')).toEqual([])
    expect(toggleOfflineEpisodeId(['ep-01', 'ep-01'], 'ep-01', true)).toEqual(['ep-01'])
    expect(toggleOfflineEpisodeId(['ep-01'], 'ep-01', false)).toEqual([])
    expect(toggleOfflineEpisodeId(['ep-01'], 'ep-02', false)).toEqual(['ep-01'])
  })
})
