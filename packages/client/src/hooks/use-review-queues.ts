import { type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useRef } from "react"
import { rpc } from "@/lib/rpc"

type Ok<T> = T extends { success: true; data: infer D } ? D : never
type WriteResult = { success: boolean; error?: string; stage?: "comment" | "clear" }

export type PrReviewRow = Ok<Awaited<ReturnType<typeof rpc.reviewQueues.listPrReview>>>[number]
export type NeedsInputRow = Ok<Awaited<ReturnType<typeof rpc.reviewQueues.listNeedsInput>>>[number]
export type QueueCounts = Ok<Awaited<ReturnType<typeof rpc.reviewQueues.countQueues>>>

function unwrap<T>(result: { success: true; data: T } | { success: false; error: string }): T {
  if (!result.success) throw new Error(result.error)
  return result.data
}

// Every queue query lives under this prefix, so one invalidation refreshes the
// counts and both lists together. The live-update counter is not in the keys,
// or every change would leave another cached copy behind (beadbox-005).
const queuesKey = (dbPath: string | undefined) => ["review-queues", dbPath] as const

const ZERO_COUNTS: QueueCounts = { prReview: 0, needsInput: 0 }

/**
 * Header badge counts. A failed read shows zero and is not retried: a bd that
 * cannot answer would fail again, and a stale count would mislead.
 */
export function useQueueCounts(dbPath: string | undefined): QueueCounts {
  const query = useQuery({
    queryKey: [...queuesKey(dbPath), "counts"],
    queryFn: async () => unwrap(await rpc.reviewQueues.countQueues(dbPath)),
    enabled: Boolean(dbPath),
    retry: false,
  })
  return query.isError || query.data === undefined ? ZERO_COUNTS : query.data
}

export function usePrReview(dbPath: string | undefined): UseQueryResult<PrReviewRow[]> {
  return useQuery({
    queryKey: [...queuesKey(dbPath), "pr-review"],
    queryFn: async () => unwrap(await rpc.reviewQueues.listPrReview(dbPath)),
    enabled: Boolean(dbPath),
  })
}

export function useNeedsInput(dbPath: string | undefined): UseQueryResult<NeedsInputRow[]> {
  return useQuery({
    queryKey: [...queuesKey(dbPath), "needs-input"],
    queryFn: async () => unwrap(await rpc.reviewQueues.listNeedsInput(dbPath)),
    enabled: Boolean(dbPath),
  })
}

/** Refetch the counts and both lists together. */
export function useRefreshQueues(dbPath: string | undefined): () => Promise<void> {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: queuesKey(dbPath) }),
    [queryClient, dbPath],
  )
}

// The server has no double-submit guard, so a write that is already in flight
// ignores repeat calls. The ref catches a second click that lands before React
// re-renders with the pending flag.
function useQueueWrite<TVars>(
  dbPath: string | undefined,
  write: (vars: TVars) => Promise<WriteResult>,
) {
  const refresh = useRefreshQueues(dbPath)
  const inFlight = useRef(false)
  const { mutateAsync, isPending } = useMutation({
    mutationFn: write,
    onSettled: async () => {
      inFlight.current = false
      await refresh()
    },
  })
  const run = useCallback(
    (vars: TVars): Promise<WriteResult | null> => {
      if (inFlight.current) return Promise.resolve(null)
      inFlight.current = true
      return mutateAsync(vars)
    },
    [mutateAsync],
  )
  return { run, isPending }
}

/**
 * Approve adds the `approved` label. Resolves to null when a write is already
 * in flight, otherwise to the server result. Rejects only when the RPC itself
 * fails.
 */
export function useApprovePr(dbPath: string | undefined) {
  const { run, isPending } = useQueueWrite(dbPath, (id: string) =>
    rpc.reviewQueues.approvePr(id, dbPath),
  )
  return { approve: run, isPending }
}

type NeedsInputWrite = { kind: "answer"; id: string; text: string } | { kind: "clear"; id: string }

function runNeedsInputWrite(write: NeedsInputWrite, dbPath: string | undefined) {
  return write.kind === "answer"
    ? rpc.reviewQueues.answerNeedsInput(write.id, write.text, dbPath)
    : rpc.reviewQueues.clearNeedsInput(write.id, dbPath)
}

/**
 * Send answer and Clear share one pending flag, so both buttons disable while
 * either write is in flight. Same null and rejection semantics as useApprovePr.
 */
export function useNeedsInputWrites(dbPath: string | undefined) {
  const { run, isPending } = useQueueWrite<NeedsInputWrite>(dbPath, (write) =>
    runNeedsInputWrite(write, dbPath),
  )
  return {
    answer: (id: string, text: string) => run({ kind: "answer", id, text }),
    clear: (id: string) => run({ kind: "clear", id }),
    isPending,
  }
}
