import { execFileAsync } from "./exec"
import { projectDirFromDatabasePath } from "./workspace-registry"

export function projectDirOrNull(dbPath: string | undefined): string | null {
  if (!dbPath || dbPath.startsWith("server://")) return null
  return projectDirFromDatabasePath(dbPath)
}

export async function readOriginUrl(projectDir: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", projectDir, "remote", "get-url", "origin"],
      {
        timeout: 5000,
      },
    )
    const url = stdout.trim()
    return url === "" ? null : url
  } catch {
    return null
  }
}
