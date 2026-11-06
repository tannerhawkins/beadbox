import { RefreshCw, ServerCrash } from "lucide-react"
import { Fragment } from "react"
import type { AppHealth } from "../hooks/use-app-health"
import { ERROR_CATEGORY_TITLES } from "../lib/epic-tree-utils"
import { cn } from "../lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { WorkspaceErrorScreen } from "./workspace-error-screen"

interface HeaderHealthBannerProps {
  appHealth: Extract<AppHealth, { status: "error" | "fatal" }>
  autoRetryCountdown?: number | null
  databasePath: string
  detailsOpen: boolean
  onDetailsOpenChange: (open: boolean) => void
  isRefreshing?: boolean
  onRefresh?: () => Promise<void> | void
}

export function HeaderHealthBanner({
  appHealth,
  autoRetryCountdown,
  databasePath,
  detailsOpen,
  onDetailsOpenChange,
  isRefreshing,
  onRefresh,
}: HeaderHealthBannerProps) {
  const loadError = appHealth.loadError
  const summaryMsg =
    loadError && loadError.category !== "unknown"
      ? (ERROR_CATEGORY_TITLES[loadError.category] ?? appHealth.reason)
      : appHealth.reason
  return (
    <Fragment>
      <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-red-500/10 border-t border-red-500/20 text-red-400 text-xs">
        <ServerCrash className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {autoRetryCountdown != null && autoRetryCountdown > 0
            ? `Retrying automatically... (${autoRetryCountdown}s)`
            : summaryMsg}
        </span>
        {loadError && (
          <button
            onClick={() => onDetailsOpenChange(true)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors shrink-0"
          >
            Details
          </button>
        )}
        {appHealth.status === "error" && appHealth.canRetry && onRefresh && (
          <button
            onClick={() => onRefresh?.()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors shrink-0"
          >
            <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
            Retry
          </button>
        )}
      </div>
      {loadError && (
        <Dialog open={detailsOpen} onOpenChange={onDetailsOpenChange}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {ERROR_CATEGORY_TITLES[loadError.category] ?? "Error Details"}
              </DialogTitle>
            </DialogHeader>
            <WorkspaceErrorScreen
              error={loadError}
              onRetry={() => {
                onDetailsOpenChange(false)
                onRefresh?.()
              }}
              isRetrying={!!isRefreshing}
              databasePath={databasePath}
            />
          </DialogContent>
        </Dialog>
      )}
    </Fragment>
  )
}
