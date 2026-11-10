// Tiny IndexedDB key-value store — the generated face lives only on this device.
const DB = 'poke'
const STORE = 'kv'

function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

async function tx(mode, fn) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(req?.result)
    t.onerror = () => reject(t.error)
  })
}

export const kvGet = (k) => tx('readonly', (s) => s.get(k)).catch(() => undefined)
export const kvSet = (k, v) => tx('readwrite', (s) => s.put(v, k))
export const kvDel = (k) => tx('readwrite', (s) => s.delete(k))
