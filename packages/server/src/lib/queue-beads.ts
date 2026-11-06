import { type BdBead, listBeads } from "./bd"
import { readOptions } from "./read-options"

const CACHE_TTL_MS = 1000

interface QueueEntry {
  promise: Promise<BdBead[]>
  expiresAt: number
}

const entries = new Map<string, QueueEntry>()

function keyOf(dbPath: string | undefined): string {
  return dbPath ?? "__default__"
}

// In-flight reads keep an infinite expiry so concurrent callers share the promise.
export function readQueueBeads(dbPath: string | undefined): Promise<BdBead[]> {
  const key = keyOf(dbPath)
  const hit = entries.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.promise

  const entry: QueueEntry = {
    promise: readOptions(dbPath).then((options) => listBeads(options)),
    expiresAt: Number.POSITIVE_INFINITY,
  }
  entries.set(key, entry)
  entry.promise.then(
    () => {
      entry.expiresAt = Date.now() + CACHE_TTL_MS
    },
    () => {
      if (entries.get(key) === entry) entries.delete(key)
    },
  )
  return entry.promise
}

export function invalidateQueueBeads(dbPath: string | undefined): void {
  entries.delete(keyOf(dbPath))
}
