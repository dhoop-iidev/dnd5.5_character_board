// Content packs kept in this browser (house rule #7, model/packs.ts): IndexedDB, one record per pack id, so they stay
// available offline (PWA) and a pack of several megabytes doesn't crowd the character's localStorage. Loading or
// removing a pack reloads the page: the rules registry is built once, before the app mounts (main.ts).
import { readPack, type ContentPack } from './packs'

const DB = 'dnd55-playboard'
const STORE = 'packs'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is not available'))
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function run<T>(mode: IDBTransactionMode, act: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = act(tx.objectStore(STORE))
        tx.oncomplete = () => {
          db.close()
          resolve(req.result)
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error)
        }
      }),
  )
}

/** The packs stored in this browser (none when IndexedDB is unavailable, e.g. some private windows). */
export async function storedPacks(): Promise<ContentPack[]> {
  try {
    const all = (await run('readonly', (s) => s.getAll())) as unknown[]
    const out: ContentPack[] = []
    for (const raw of all) {
      try {
        out.push(readPack(raw))
      } catch {
        // A damaged record: ignored (it can be loaded again from its file).
      }
    }
    return out
  } catch {
    return []
  }
}

/** Store a pack (replacing the stored one with the same id). */
export async function storePack(pack: ContentPack): Promise<void> {
  await run('readwrite', (s) => s.put(pack))
}

export async function removePack(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id))
}
