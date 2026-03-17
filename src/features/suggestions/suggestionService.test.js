import { describe, expect, it, vi } from 'vitest'
import {
  normalizeSuggestionForm,
  submitSuggestionWithFallback,
  validateSuggestionPayload,
} from './suggestionService'

function createMemoryStorage() {
  const store = new Map()
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    setItem(key, value) {
      store.set(key, value)
    },
    dump() {
      return store
    },
  }
}

describe('suggestion service', () => {
  it('normalizes and validates required fields', () => {
    const payload = normalizeSuggestionForm({
      name: '  Marius  ',
      email: '  ',
      category: ' Stade ',
      location: '   Vieux-Port   ',
      pitch: '  Une tchatche sur le port  ',
    })

    expect(payload).toEqual({
      name: 'Marius',
      email: '',
      category: 'Stade',
      location: 'Vieux-Port',
      pitch: 'Une tchatche sur le port',
    })

    expect(validateSuggestionPayload(payload)).toEqual({ valid: true, message: '' })
    expect(validateSuggestionPayload({ ...payload, pitch: '' }).valid).toBe(false)
  })

  it('uses API when available', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      async json() {
        return { data: { id: 'sugg-api-123' } }
      },
    }))

    const result = await submitSuggestionWithFallback({
      form: {
        name: 'Marius',
        email: '',
        category: 'Stade',
        location: 'Vieux-Port',
        pitch: 'Pitch',
      },
      endpoint: '/api/suggestions',
      localStorageKey: 'suggestions',
      fetchImpl,
      storage: createMemoryStorage(),
    })

    expect(result.ok).toBe(true)
    expect(result.source).toBe('api')
    expect(result.id).toBe('sugg-api-123')
  })

  it('falls back to local storage when API fails', async () => {
    const storage = createMemoryStorage()
    const fetchImpl = vi.fn(async () => {
      throw new Error('network-down')
    })

    const result = await submitSuggestionWithFallback({
      form: {
        name: 'Fanny',
        email: '',
        category: 'Cafés',
        location: 'Noailles',
        pitch: 'Pitch',
      },
      endpoint: '/api/suggestions',
      localStorageKey: 'suggestions',
      fetchImpl,
      storage,
    })

    expect(result.ok).toBe(true)
    expect(result.source).toBe('local')
    expect(result.id).toMatch(/^sugg-/)

    const stored = JSON.parse(storage.getItem('suggestions'))
    expect(Array.isArray(stored)).toBe(true)
    expect(stored[0].name).toBe('Fanny')
  })
})
