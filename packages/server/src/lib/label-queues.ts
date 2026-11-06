import type { BdBead } from "./bd"

export const NEEDS_ANSWER_LABEL = "needs-answer"
export const NEEDS_APPROVAL_LABEL = "needs-approval"
export const APPROVED_LABEL = "approved"

const INACTIVE_STATUSES: ReadonlySet<string> = new Set(["closed", "tombstone"])

function oldestFirst(a: BdBead, b: BdBead): number {
  return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
}

export function selectQueue(beads: BdBead[], label: string): BdBead[] {
  return beads
    .filter((bead) => !INACTIVE_STATUSES.has(bead.status) && (bead.labels ?? []).includes(label))
    .sort(oldestFirst)
}
