import type { BdOptions } from "./bd"
import { readMetadataMode } from "./dolt-metadata"

// A server-mode workspace runs bd in parallel; embedded mode keeps the db lock.
export async function readOptions(dbPath: string | undefined): Promise<BdOptions> {
  const options: BdOptions = dbPath ? { db: dbPath } : {}
  if (dbPath && (await readMetadataMode(dbPath)) === "server") options.parallel = true
  return options
}
