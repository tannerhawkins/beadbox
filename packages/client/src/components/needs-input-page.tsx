import type { UseQueryResult } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Inbox } from "lucide-react"
import { useState } from "react"
import {
  type NeedsInputRow,
  useNeedsInput,
  useNeedsInputWrites,
  useRefreshQueues,
} from "../hooks/use-review-queues"
import { setSelectedBead as persistSelectedBead } from "../lib/local-storage"
import { toastError } from "../lib/notifications"
import { ReviewQueueShell, useQueueWorkspace } from "./review-queue-shell"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"

type Writes = ReturnType<typeof useNeedsInputWrites>
type WriteOutcome = Awaited<ReturnType<Writes["answer"]>>

function describeFailure(outcome: { error?: string; stage?: "comment" | "clear" }): string {
  const detail = outcome.error ?? "Unknown error"
  return outcome.stage === "clear"
    ? `Answer saved, but clearing the Needs Input flag failed: ${detail}`
    : detail
}

function NeedsInputItem({ row, writes }: { row: NeedsInputRow; writes: Writes }) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState("")
  const [failure, setFailure] = useState<string | null>(null)

  const fail = (message: string): false => {
    setFailure(message)
    toastError(message)
    return false
  }

  // Resolves true when the write succeeded. A null outcome means another write
  // was already in flight, so the draft and error stay as they are.
  const attempt = async (write: () => Promise<WriteOutcome>): Promise<boolean> => {
    let outcome: WriteOutcome
    try {
      outcome = await write()
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err))
    }
    if (outcome === null) return false
    if (outcome.success) {
      setFailure(null)
      return true
    }
    return fail(describeFailure(outcome))
  }

  const send = async () => {
    if (await attempt(() => writes.answer(row.id, draft.trim()))) setDraft("")
  }
  const clear = () => attempt(() => writes.clear(row.id))
  const openBead = () => {
    persistSelectedBead(row.id)
    void navigate({ to: "/" })
  }

  return (
    <li
      className="rounded-md border border-border px-4 py-3 space-y-3"
      data-testid="needs-input-row"
      data-bead-id={row.id}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <button
          type="button"
          className="font-mono text-xs text-muted-foreground hover:underline"
          onClick={openBead}
        >
          {row.id}
        </button>
        <h2 className="text-sm font-medium">{row.title}</h2>
      </div>

      {row.notes.trim() === "" ? (
        <p className="text-sm text-muted-foreground">(no notes)</p>
      ) : (
        <pre
          className="whitespace-pre-wrap break-words max-h-64 overflow-y-auto rounded-md bg-muted/50 p-3 text-sm"
          data-testid="needs-input-notes"
        >
          {row.notes}
        </pre>
      )}

      <Textarea
        data-testid="answer-input"
        aria-label="Answer"
        placeholder="Answer the worker"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />

      {failure ? (
        <p role="alert" data-testid="answer-error" className="text-sm text-destructive">
          {failure}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          data-testid="clear-human-button"
          disabled={writes.isPending}
          onClick={() => void clear()}
        >
          Clear
        </Button>
        <Button
          data-testid="send-answer-button"
          disabled={draft.trim() === "" || writes.isPending}
          onClick={() => void send()}
        >
          {writes.isPending ? "Sending..." : "Send answer"}
        </Button>
      </div>
    </li>
  )
}

function NeedsInputList({
  query,
  dbPath,
  writes,
}: {
  query: UseQueryResult<NeedsInputRow[]>
  dbPath: string | undefined
  writes: Writes
}) {
  if (query.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {query.error.message}
      </p>
    )
  }
  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>
  }
  const rows = query.data ?? []
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="needs-input-empty">
        Nothing needs your input.
      </p>
    )
  }
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <NeedsInputItem key={`${dbPath}:${row.id}`} row={row} writes={writes} />
      ))}
    </ul>
  )
}

export function NeedsInputPage() {
  const { workspace, dbPath } = useQueueWorkspace()
  const query = useNeedsInput(dbPath)
  const writes = useNeedsInputWrites(dbPath)
  const refresh = useRefreshQueues(dbPath)

  return (
    <ReviewQueueShell
      workspace={workspace}
      title="Needs Input"
      description="Beads labeled human. Answer the worker or clear the flag."
      icon={<Inbox className="h-5 w-5" />}
      isFetching={query.isFetching}
      isPending={writes.isPending}
      onRefresh={() => void refresh()}
    >
      <NeedsInputList query={query} dbPath={dbPath} writes={writes} />
    </ReviewQueueShell>
  )
}
