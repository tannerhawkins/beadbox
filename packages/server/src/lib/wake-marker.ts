// Worker wake marker: a one-line file a waiting worker session blocks on.
//
// Path: ~/.beadbox/wake/<bead-id>. Content: "<UTC ISO timestamp> <action>\n".
// Written only after the bd write for that action has succeeded. Written via
// temp file + rename in the same directory so a watcher never reads a
// partial file.

import { randomUUID } from "node:crypto"
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { basename, join } from "node:path"
import { assertSafeBeadId } from "./bd-argv"

export type WakeAction = "approved" | "answered" | "cleared"

export async function writeWakeMarker(beadId: string, action: WakeAction): Promise<void> {
  const dir = join(homedir(), ".beadbox", "wake")
  const path = join(dir, basename(assertSafeBeadId(beadId)))
  const temp = join(dir, `.${basename(path)}.${randomUUID()}.tmp`)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  try {
    await writeFile(temp, `${new Date().toISOString()} ${action}\n`, { mode: 0o600 })
    await rename(temp, path)
  } catch (error) {
    await rm(temp, { force: true })
    throw error
  }
}
