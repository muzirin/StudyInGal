/**
 * 移动端（Capacitor / WebView）的键值存储：IndexedDB 单库单表。
 * 用于替代桌面端的 JSON 文件存储（main/lib/jsonStore.ts）。
 */
const DB_NAME = 'study-in-gal'
const STORE = 'kv'
const VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 打开失败'))
  })
  return dbPromise
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = action(tx.objectStore(STORE))
    request.onsuccess = () => resolve(request.result as T)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 操作失败'))
  })
}

export async function readKey<T>(key: string, fallback: T): Promise<T> {
  try {
    const value = await withStore<T | undefined>('readonly', (store) => store.get(key))
    return value === undefined ? fallback : value
  } catch {
    return fallback
  }
}

export async function writeKey<T>(key: string, value: T): Promise<void> {
  await withStore('readwrite', (store) => store.put(value, key))
}

export async function updateKey<T>(key: string, fallback: T, mutator: (current: T) => T | void): Promise<T> {
  const current = await readKey(key, fallback)
  const next = mutator(current) ?? current
  await writeKey(key, next)
  return next
}
