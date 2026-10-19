import { createContext, useContext, useSyncExternalStore } from 'react'

// Session interaction counter — an external store so bumps don't re-render the whole app.
let count = 0
const subs = new Set()

export function bump(n = 1) {
  count += n
  subs.forEach((f) => f())
}

export function useCount() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => count,
  )
}

// Screen micro-shake provided by the App shell.
export const ShakeContext = createContext(() => {})
export const useShake = () => useContext(ShakeContext)

// Tiny shared hook for measuring an element.
export function observeSize(el, cb) {
  const ro = new ResizeObserver(([e]) => cb(e.contentRect.width, e.contentRect.height))
  ro.observe(el)
  return () => ro.disconnect()
}
