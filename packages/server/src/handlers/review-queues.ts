// Review queues handler namespace: the Needs Input and PR Review tabs.
//
// Both tabs are label queues over the active workspace (lib/label-queues.ts).
// Writes touch labels and comments only: beadbox never calls GitHub or posts
// PR comments. The PR link is built from the project's origin remote and the
// last `pr=<n>` in the bead's notes; it is null whenever either is missing.

import { answerComment, answerThenClear } from "../lib/answer-flow"
import {
  type BdBead,
  type BdOptions,
  addComment as bdAddComment,
  addLabel as bdAddLabel,
  removeLabel as bdRemoveLabel,
  listBeads,
} from "../lib/bd"
import { invalidateEpicCache } from "../lib/epic-cache"
import { projectDirOrNull, readOriginUrl } from "../lib/git-remote"
import { type GithubRepo, parseGithubRemote, pullRequestUrl } from "../lib/github-remote"
import { APPROVED_LABEL, HUMAN_LABEL, NEEDS_APPROVAL_LABEL, selectQueue } from "../lib/label-queues"
import { lastPrNumber } from "../lib/pr-notes"
import { readOptions } from "../lib/read-options"

type Success<T> = { success: true; data: T }
type Failure = { success: false; error: string }
type WriteResult = { success: boolean; error?: string }

export interface PrReviewRow {
  id: string
  title: string
  notes: string
  prNumber: number | null
  prUrl: string | null
  approved: boolean
}

export interface NeedsInputRow {
  id: string
  title: string
  notes: string
}

export interface QueueCounts {
  prReview: number
  needsInput: number
}

function extractError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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

async function runWrite(write: () => Promise<void>): Promise<WriteResult> {
  try {
    await write()
    invalidateEpicCache()
    return { success: true }
  } catch (error: unknown) {
    console.error("Review queue write failed:", error)
    return { success: false, error: extractError(error) }
  }
}

export async function listPrReview(dbPath?: string): Promise<Success<PrReviewRow[]> | Failure> {
  try {
    const beads = selectQueue(await listBeads(await readOptions(dbPath)), NEEDS_APPROVAL_LABEL)
    const repo = beads.length === 0 ? null : await originRepo(dbPath)
    return { success: true, data: beads.map((bead) => toPrReviewRow(bead, repo)) }
  } catch (error: unknown) {
    return { success: false, error: extractError(error) }
  }
}

export async function listNeedsInput(dbPath?: string): Promise<Success<NeedsInputRow[]> | Failure> {
  try {
    const beads = selectQueue(await listBeads(await readOptions(dbPath)), HUMAN_LABEL)
    return { success: true, data: beads.map(toNeedsInputRow) }
  } catch (error: unknown) {
    return { success: false, error: extractError(error) }
  }
}

export async function countQueues(dbPath?: string): Promise<Success<QueueCounts> | Failure> {
  try {
    const beads = await listBeads(await readOptions(dbPath))
    return {
      success: true,
      data: {
        prReview: selectQueue(beads, NEEDS_APPROVAL_LABEL).length,
        needsInput: selectQueue(beads, HUMAN_LABEL).length,
      },
    }
  } catch (error: unknown) {
    return { success: false, error: extractError(error) }
  }
}

export function approvePr(id: string, dbPath?: string): Promise<WriteResult> {
  return runWrite(() => bdAddLabel(id, APPROVED_LABEL, writeOptions(dbPath)))
}

export function clearNeedsInput(id: string, dbPath?: string): Promise<WriteResult> {
  return runWrite(() => bdRemoveLabel(id, HUMAN_LABEL, writeOptions(dbPath)))
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
    () => bdRemoveLabel(id, HUMAN_LABEL, options),
  )
  invalidateEpicCache()
  return result.success
    ? { success: true }
    : { success: false, error: result.error, stage: result.stage }
}
