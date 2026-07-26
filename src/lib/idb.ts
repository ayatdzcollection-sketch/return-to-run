// ============================================================
// A small promise wrapper over IndexedDB. No dependency, no abstraction
// beyond what this app uses.
//
// IndexedDB rather than localStorage because the event log is append-only and
// unbounded, raw HR samples run to thousands of rows per session, and
// localStorage would force a full parse-and-reserialize of the entire history
// on every single tap. It also gives the append-only rule a real primitive:
// `add()` throws ConstraintError on a duplicate key instead of overwriting,
// which is exactly the semantics both the log and at-least-once sync want.
// ============================================================

export const DB_NAME = 'rtr'
export const DB_VERSION = 1

export const STORE_EVENTS = 'events'
export const STORE_HR = 'hr_samples'
export const STORE_META = 'meta'

let dbPromise: Promise<IDBDatabase> | null = null

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        const events = db.createObjectStore(STORE_EVENTS, { keyPath: 'id' })
        // The fold reads everything, but the detail view and the sync cursor
        // both want ranges, and an index costs nothing at this scale.
        events.createIndex('by_date', 'date', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_HR)) {
        // Audit-only side store. Raw samples never enter the fold.
        db.createObjectStore(STORE_HR, { keyPath: ['sessionDate', 'ts'] })
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another open tab'))
  })
  return dbPromise
}

/** Reset the cached handle. Tests only — the app opens the database once. */
export function resetDbCache(): void {
  dbPromise = null
}

function tx(db: IDBDatabase, store: string, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(store, mode).objectStore(store)
}

/**
 * Insert without overwriting.
 *
 * Returns false when the key already exists rather than throwing: a duplicate
 * is the normal, expected outcome of at-least-once sync, not an error. Any
 * other failure still rejects.
 */
export async function addIfAbsent(store: string, value: unknown): Promise<boolean> {
  const db = await openDb()
  const objectStore = tx(db, store, 'readwrite')
  try {
    await wrap(objectStore.add(value as never))
    return true
  } catch (err) {
    if (err instanceof DOMException && err.name === 'ConstraintError') return false
    throw err
  }
}

export async function getAll<T>(store: string): Promise<T[]> {
  const db = await openDb()
  return wrap(tx(db, store, 'readonly').getAll() as IDBRequest<T[]>)
}

export async function count(store: string): Promise<number> {
  const db = await openDb()
  return wrap(tx(db, store, 'readonly').count())
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  return wrap(tx(db, STORE_META, 'readonly').get(key) as IDBRequest<T | undefined>)
}

/**
 * Meta is the one mutable store — sync cursors and the schema stamp.
 *
 * It holds no training history: everything here is derivable from the log and
 * the server, so overwriting it can lose progress but never truth.
 */
export async function putMeta(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  await wrap(tx(db, STORE_META, 'readwrite').put(value as never, key))
}
