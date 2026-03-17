function getStorage(storage) {
  if (storage) {
    return storage
  }
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage
}

export function parseStoredJson(key, fallback, storage) {
  const targetStorage = getStorage(storage)
  if (!targetStorage) {
    return fallback
  }

  const raw = targetStorage.getItem(key)
  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function prependStoredJsonItem(key, item, storage) {
  const targetStorage = getStorage(storage)
  if (!targetStorage) {
    throw new Error('storage-unavailable')
  }

  const current = parseStoredJson(key, [], targetStorage)
  const currentList = Array.isArray(current) ? current : []
  const nextList = [item, ...currentList]
  targetStorage.setItem(key, JSON.stringify(nextList))
  return nextList
}
