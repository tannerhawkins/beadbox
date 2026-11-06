export interface GithubRepo {
  owner: string
  repo: string
}

const NAME = "[A-Za-z0-9_.-]+"
const LAZY_NAME = "[A-Za-z0-9_.-]+?"

const REMOTE_PATTERNS: readonly RegExp[] = [
  new RegExp(`^https://(?:[^@/\\s]+@)?github\\.com/(${NAME})/(${LAZY_NAME})(?:\\.git)?/?$`, "i"),
  new RegExp(`^git@github\\.com:(${NAME})/(${LAZY_NAME})(?:\\.git)?/?$`, "i"),
  new RegExp(`^ssh://(?:[^@/\\s]+@)?github\\.com(?::\\d+)?/(${NAME})/(${LAZY_NAME})(?:\\.git)?/?$`, "i"),
]

export function parseGithubRemote(url: string | null | undefined): GithubRepo | null {
  if (typeof url !== "string") return null
  const trimmed = url.trim()
  if (trimmed === "") return null
  for (const pattern of REMOTE_PATTERNS) {
    const match = pattern.exec(trimmed)
    if (!match) continue
    const owner = match[1] ?? ""
    const repo = match[2] ?? ""
    if (repo === "." || repo === "..") return null
    return { owner, repo }
  }
  return null
}

export function pullRequestUrl(repo: GithubRepo, prNumber: number): string {
  return `https://github.com/${repo.owner}/${repo.repo}/pull/${prNumber}`
}
