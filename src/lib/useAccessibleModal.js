import { useEffect, useRef } from 'react'

export function useAccessibleModal({ open, onClose }) {
  const dialogRef = useRef(null)
  const initialFocusRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    previousFocusRef.current =
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const focusTimer = window.setTimeout(() => {
      if (initialFocusRef.current instanceof HTMLElement) {
        initialFocusRef.current.focus()
        return
      }

      if (dialogRef.current instanceof HTMLElement) {
        dialogRef.current.focus()
      }
    }, 0)

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      onClose()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', handleKeyDown)

      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus()
      }
      previousFocusRef.current = null
    }
  }, [onClose, open])

  return {
    dialogRef,
    initialFocusRef,
  }
}
