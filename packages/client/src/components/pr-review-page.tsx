import { useNavigate } from "@tanstack/react-router"
import { GitPullRequest, Loader2 } from "lucide-react"
import {
  type PrReviewRow,
  useApprovePr,
  usePrReview,
  useRefreshQueues,
} from "../hooks/use-review-queues"
import { setSelectedBead as persistSelectedBead } from "../lib/local-storage"
import { toastError } from "../lib/notifications"
import { ReviewQueueShell, useQueueWorkspace } from "./review-queue-shell"
import { Button } from "./ui/button"

interface PrReviewRowItemProps {
  row: PrReviewRow
  approvePending: boolean
  onOpen: (id: string) => void
  onApprove: (id: string) => void
}

function PrReviewRowItem({ row, approvePending, onOpen, onApprove }: PrReviewRowItemProps) {
  return (
    <li
      data-testid="pr-review-row"
      data-bead-id={row.id}
      className="flex flex-wrap items-center gap-3 py-3"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="truncate text-sm font-medium">{row.title}</div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <button
            type="button"
            className="font-mono hover:underline"
            onClick={() => onOpen(row.id)}
          >
            {row.id}
          </button>
          {row.prUrl ? (
            <a
              data-testid="pr-review-link"
              href={row.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              PR #{row.prNumber}
            </a>
          ) : (
            <span>No PR link</span>
          )}
        </div>
      </div>
      {row.approved ? (
        <span className="text-xs text-muted-foreground">Approved, waiting on worker</span>
      ) : null}
      <Button
        data-testid="approve-button"
        size="sm"
        disabled={row.approved || approvePending}
        onClick={() => onApprove(row.id)}
      >
        Approve
      </Button>
    </li>
  )
}

export function PrReviewPage() {
  const navigate = useNavigate()
  const { workspace, dbPath } = useQueueWorkspace()
  const query = usePrReview(dbPath)
  const refresh = useRefreshQueues(dbPath)
  const { approve, isPending: approvePending } = useApprovePr(dbPath)

  const openBead = (id: string) => {
    persistSelectedBead(id)
    void navigate({ to: "/" })
  }

  const approveRow = async (id: string) => {
    try {
      const result = await approve(id)
      if (result && !result.success) {
        toastError(`Could not approve ${id}`, { description: result.error })
      }
    } catch (error) {
      toastError(`Could not approve ${id}`, {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const rows = query.data ?? []

  return (
    <ReviewQueueShell
      workspace={workspace}
      title="PR Review"
      description="Beads waiting for your approval of their pull request."
      icon={<GitPullRequest className="h-5 w-5" />}
      isFetching={query.isFetching}
      isPending={query.isLoading}
      onRefresh={() => void refresh()}
    >
      {query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load PR reviews: {query.error.message}
        </p>
      ) : query.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing is waiting for PR approval.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => (
            <PrReviewRowItem
              key={row.id}
              row={row}
              approvePending={approvePending}
              onOpen={openBead}
              onApprove={(id) => void approveRow(id)}
            />
          ))}
        </ul>
      )}
    </ReviewQueueShell>
  )
}
