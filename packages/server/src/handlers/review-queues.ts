// Review queues handler namespace: the Needs Input and PR Review tabs.
//
// Both tabs are label queues over the active workspace (lib/label-queues.ts).
// Writes touch labels and comments only: beadbox never calls GitHub or posts
// PR comments. After a successful write it also drops a best-effort worker
// wake marker (lib/wake-marker.ts). The PR link is built from the project's
// origin remote and the last `pr=<n>` in the bead's notes; it is null whenever
// either is missing.

import { answerComment, answerThenClear } from "../lib/answer-flow"
import {
  type BdBead,
  type BdOptions,
  addComment as bdAddComment,
  addLabel as bdAddLabel,
  removeLabel as bdRemoveLabel,
} from "../lib/bd"
import { invalidateEpicCache } from "../lib/epic-cache"
import { projectDirOrNull, readOriginUrl } from "../lib/git-remote"
import { type GithubRepo, parseGithubRemote, pullRequestUrl } from "../lib/github-remote"
import {
  APPROVED_LABEL,
  NEEDS_ANSWER_LABEL,
  NEEDS_APPROVAL_LABEL,
  selectQueue,
} from "../lib/label-queues"
import { lastPrNumber } from "../lib/pr-notes"
import { invalidateQueueBeads, readQueueBeads } from "../lib/queue-beads"
import { type WakeAction, writeWakeMarker } from "../lib/wake-marker"

type Success<T> = { success: true; data: T }
type Failure = { success: false; error: string }
type WriteResult = { success: boolean; error?: string }

interface PrReviewRow {
  id: string
  title: string
  notes: string
  prNumber: number | null
  prUrl: string | null
  approved: boolean
}

interface NeedsInputRow {
  id: string
  title: string
  notes: string
}

interface QueueCounts {
  prReview: number
  needsInput: number
}

function writeOptions(dbPath: string | undefined): BdOptions {
  return dbPath ? { db: dbPath } : {}
}

function toNeedsInputRow(bead: BdBead): NeedsInputRow {
  return { id: bead.id, title: bead.title, notes: bead.notes ?? "" }
}

function toPrReviewRow(bead: BdBead, repo: GithubRepo | null): PrReviewRow {
  const notes = bead.notes ?? ""
  const prNumber = lastPrNumber(notes)
  return {
    id: bead.id,
    title: bead.title,
    notes,
    prNumber,
    prUrl: repo && prNumber !== null ? pullRequestUrl(repo, prNumber) : null,
    approved: bead.labels.includes(APPROVED_LABEL),
  }
}

async function originRepo(dbPath: string | undefined): Promise<GithubRepo | null> {
  const projectDir = projectDirOrNull(dbPath)
  return parseGithubRemote(projectDir === null ? null : await readOriginUrl(projectDir))
}

async function query<T>(run: () => Promise<T>): Promise<Success<T> | Failure> {
  try {
    return { success: true, data: await run() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function runWrite(
  dbPath: string | undefined,
  write: () => Promise<void>,
): Promise<WriteResult> {
  const result = await query(async () => {
    await write()
    invalidateEpicCache()
  })
  invalidateQueueBeads(dbPath)
  if (!result.success) console.error("Review queue write failed:", result.error)
  return result.success ? { success: true } : result
}

export function listPrReview(dbPath?: string): Promise<Success<PrReviewRow[]> | Failure> {
  return query(async () => {
    const beads = selectQueue(await readQueueBeads(dbPath), NEEDS_APPROVAL_LABEL)
    const repo = beads.length === 0 ? null : await originRepo(dbPath)
    return beads.map((bead) => toPrReviewRow(bead, repo))
  })
}

export function listNeedsInput(dbPath?: string): Promise<Success<NeedsInputRow[]> | Failure> {
  return query(async () => {
    const beads = selectQueue(await readQueueBeads(dbPath), NEEDS_ANSWER_LABEL)
    return beads.map(toNeedsInputRow)
  })
}

export function countQueues(dbPath?: string): Promise<Success<QueueCounts> | Failure> {
  return query(async () => {
    const beads = await readQueueBeads(dbPath)
    return {
      prReview: selectQueue(beads, NEEDS_APPROVAL_LABEL).length,
      needsInput: selectQueue(beads, NEEDS_ANSWER_LABEL).length,
    }
  })
}

function wake(id: string, action: WakeAction): void {
  void writeWakeMarker(id, action).catch((error: unknown) => {
    console.error(
      "Wake marker write failed:",
      error instanceof Error ? error.message : String(error),
    )
  })
}

export async function approvePr(id: string, dbPath?: string): Promise<WriteResult> {
  const result = await runWrite(dbPath, () => bdAddLabel(id, APPROVED_LABEL, writeOptions(dbPath)))
  if (result.success) wake(id, "approved")
  return result
}

export async function clearNeedsInput(id: string, dbPath?: string): Promise<WriteResult> {
  const result = await runWrite(dbPath, () =>
    bdRemoveLabel(id, NEEDS_ANSWER_LABEL, writeOptions(dbPath)),
  )
  if (result.success) wake(id, "cleared")
  return result
}

export async function answerNeedsInput(
  id: string,
  text: string,
  dbPath?: string,
): Promise<WriteResult & { stage?: "comment" | "clear" }> {
  const comment = answerComment(text)
  if (comment === null) return { success: false, error: "Answer is empty" }
  const options = writeOptions(dbPath)
  const result = await answerThenClear(
    () => bdAddComment(id, comment, options),
    () => bdRemoveLabel(id, NEEDS_ANSWER_LABEL, options),
  ).finally(() => invalidateQueueBeads(dbPath))
  invalidateEpicCache()
  if (result.success || result.stage === "clear") wake(id, "answered")
  return result.success
    ? { success: true }
    : { success: false, error: result.error, stage: result.stage }
}
