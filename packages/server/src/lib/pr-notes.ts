const PR_POINTER = /(?<![A-Za-z0-9_])pr=(\d+)(?![A-Za-z0-9_])/g

export function lastPrNumber(notes: string | null | undefined): number | null {
  if (!notes) return null
  let last: number | null = null
  for (const match of notes.matchAll(PR_POINTER)) {
    const value = Number(match[1])
    if (Number.isSafeInteger(value) && value > 0) last = value
  }
  return last
}
