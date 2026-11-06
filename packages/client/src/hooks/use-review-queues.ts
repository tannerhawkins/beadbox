import {
  type QueryClient,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useCallback, useRef } from "react"
import { rpc } from "@/lib/rpc"

type Ok<T> = T extends { success: true; data: infer D } ? D : never
type WriteResult = { success: boolean; error?: string; stage?: "comment" | "clear" }

export type PrReviewRow = Ok<Awaited<ReturnType<typeof rpc.reviewQueues.listPrReview>>>[number]
export type NeedsInputRow = Ok<Awaited<ReturnType<typeof rpc.reviewQueues.listNeedsInput>>>[number]
type QueueCounts = Ok<Awaited<ReturnType<typeof rpc.reviewQueues.countQueues>>>

function unwrap<T>(result: { success: true; data: T } | { success: false; error: string }): T {
  if (!result.success) throw new Error(result.error)
  return result.data
}

// Every queue query lives under this prefix, so one invalidation refreshes the
// counts and both lists together. The live-update counter is not in the keys,
// or every change would leave another cached copy behind (beadbox-005).
const queuesKey = (dbPath: string | undefined) => ["review-queues", dbPath] as const
const countsKey = (dbPath: string | undefined) => [...queuesKey(dbPath), "counts"] as const
const prReviewKey = (dbPath: string | undefined) => [...queuesKey(dbPath), "pr-review"] as const
const needsInputKey = (dbPath: string | undefined) => [...queuesKey(dbPath), "needs-input"] as const

const ZERO_COUNTS: QueueCounts = { prReview: 0, needsInput: 0 }

/**
 * Header badge counts. A failed read shows zero and is not retried: a bd that
 * cannot answer would fail again, and a stale count would mislead.
 */
export function useQueueCounts(dbPath: string | undefined): QueueCounts {
  const query = useQuery({
    queryKey: countsKey(dbPath),
    queryFn: async () => unwrap(await rpc.reviewQueues.countQueues(dbPath)),
    enabled: Boolean(dbPath),
    retry: false,
  })
  return query.isError || query.data === undefined ? ZERO_COUNTS : query.data
}

export function usePrReview(dbPath: string | undefined): UseQueryResult<PrReviewRow[]> {
  return useQuery({
    queryKey: prReviewKey(dbPath),
    queryFn: async () => unwrap(await rpc.reviewQueues.listPrReview(dbPath)),
    enabled: Boolean(dbPath),
  })
}

export function useNeedsInput(dbPath: string | undefined): UseQueryResult<NeedsInputRow[]> {
  return useQuery({
    queryKey: needsInputKey(dbPath),
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

// A missing cache entry is left alone: setQueryData does nothing when the
// updater returns undefined, and the background refetch fills it in.
function markApproved(queryClient: QueryClient, dbPath: string | undefined, id: string) {
  queryClient.setQueryData<PrReviewRow[]>(prReviewKey(dbPath), (rows) =>
    rows?.map((row) => (row.id === id ? { ...row, approved: true } : row)),
  )
}

function removeNeedsInput(queryClient: QueryClient, dbPath: string | undefined, id: string) {
  queryClient.setQueryData<NeedsInputRow[]>(needsInputKey(dbPath), (rows) =>
    rows?.filter((row) => row.id !== id),
  )
  queryClient.setQueryData<QueueCounts>(
    countsKey(dbPath),
    (counts) => counts && { ...counts, needsInput: Math.max(0, counts.needsInput - 1) },
  )
}

// The server has no double-submit guard, so a write that is already in flight
// ignores repeat calls. The ref catches a second click that lands before React
// re-renders with the pending flag. The cache changes on success before the
// write settles; the refetch that reconciles with the server runs in the background.
function useQueueWrite<TVars>(
  dbPath: string | undefined,
  write: (vars: TVars) => Promise<WriteResult>,
  applySuccess: (queryClient: QueryClient, vars: TVars) => void,
) {
  const queryClient = useQueryClient()
  const refresh = useRefreshQueues(dbPath)
  const inFlight = useRef(false)
  const { mutateAsync, isPending } = useMutation({
    mutationFn: write,
    onSuccess: (result, vars) => {
      if (result.success) applySuccess(queryClient, vars)
    },
    onSettled: () => {
      inFlight.current = false
      void refresh()
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
  const { run, isPending } = useQueueWrite(
    dbPath,
    (id: string) => rpc.reviewQueues.approvePr(id, dbPath),
    (queryClient, id: string) => markApproved(queryClient, dbPath, id),
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
  const { run, isPending } = useQueueWrite<NeedsInputWrite>(
    dbPath,
    (write) => runNeedsInputWrite(write, dbPath),
    (queryClient, write) => removeNeedsInput(queryClient, dbPath, write.id),
  )
  return {
    answer: (id: string, text: string) => run({ kind: "answer", id, text }),
    clear: (id: string) => run({ kind: "clear", id }),
    isPending,
  }
}
