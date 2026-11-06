import { useNavigate } from "@tanstack/react-router"
import { type ReactNode, useEffect, useState } from "react"
import { useActiveWorkspace } from "../hooks/use-active-workspace"
import { useAppHealth } from "../hooks/use-app-health"
import { useHasTrains } from "../hooks/use-has-trains"
import { usePreferences } from "../hooks/use-preferences"
import { useUpdateChecker } from "../hooks/use-update-checker"
import { useHasWaiting } from "../hooks/use-waiting-gates"
import type { Workspace } from "../lib/types"
import { tryViewSwitchShortcut } from "../lib/view-switch-keys"
import { Header } from "./header"
import { SettingsDialog } from "./settings-dialog"
import { useWorkspaceGate } from "./startup-gate"
import { UpdateDialog } from "./update-dialog"

export function useQueueWorkspace(): { workspace: Workspace | null; dbPath: string | undefined } {
  const { workspaces } = useWorkspaceGate()
  const [workspace] = useActiveWorkspace(workspaces)
  return { workspace, dbPath: workspace?.databasePath }
}

interface ReviewQueueShellProps {
  workspace: Workspace | null
  title: string
  description: string
  icon: ReactNode
  isFetching: boolean
  isPending: boolean
  onRefresh: () => void
  children: ReactNode
}

export function ReviewQueueShell({
  workspace,
  title,
  description,
  icon,
  isFetching,
  isPending,
  onRefresh,
  children,
}: ReviewQueueShellProps) {
  const navigate = useNavigate()
  const { health: appHealth } = useAppHealth()
  const prefs = usePreferences()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const {
    updateAvailable,
    checking: updateChecking,
    checkNow: checkForUpdates,
    checkError: updateCheckError,
    dismissUpdate,
  } = useUpdateChecker({
    enabled: prefs.updateCheckEnabled,
    frequency: prefs.updateCheckFrequency,
  })

  const dbPath = workspace?.databasePath
  const hasTrains = useHasTrains(dbPath)
  const hasWaiting = useHasWaiting(dbPath)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      tryViewSwitchShortcut(e, {
        push: (to) => void navigate({ to: to as never }),
        hasTrains,
        hasWaiting,
      })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [navigate, hasTrains, hasWaiting])

  return (
    <div className="h-full flex flex-col bg-background safe-area-inset">
      <Header
        currentWorkspace={workspace ?? { id: "", name: "Loading...", mode: "embedded" as const }}
        isRefreshing={isFetching}
        isPending={isPending}
        appHealth={appHealth}
        onRefresh={onRefresh}
        updateAvailable={updateAvailable}
        onUpdateClick={() => setUpdateDialogOpen(true)}
        onSettingsOpen={() => setSettingsOpen(true)}
      />

      <main className="flex-1 overflow-y-auto mx-auto w-full max-w-6xl px-6 py-6 space-y-6">
        <div className="flex items-center gap-2">
          {icon}
          <h1 className="text-lg font-semibold" data-testid="queue-title">
            {title}
          </h1>
          <span className="text-sm text-muted-foreground">{description}</span>
        </div>
        {children}
      </main>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        theme={prefs.theme}
        onThemeChange={prefs.handleThemeChange}
        zoomLevel={prefs.zoomLevel}
        onZoomChange={prefs.handleZoomChange}
        databasePath={dbPath}
        vimNavigationEnabled={prefs.vimEnabled}
        onVimNavigationChange={prefs.handleVimNavigationChange}
        updateCheckEnabled={prefs.updateCheckEnabled}
        onUpdateCheckEnabledChange={prefs.handleUpdateCheckEnabledChange}
        updateCheckFrequency={prefs.updateCheckFrequency}
        onUpdateCheckFrequencyChange={prefs.handleUpdateCheckFrequencyChange}
        updateAvailable={updateAvailable}
        updateChecking={updateChecking}
        updateCheckError={updateCheckError}
        onCheckForUpdates={checkForUpdates}
        onOpenUpdateDialog={() => setUpdateDialogOpen(true)}
      />

      {updateAvailable ? (
        <UpdateDialog
          open={updateDialogOpen}
          onOpenChange={setUpdateDialogOpen}
          updateInfo={updateAvailable}
          onDismiss={dismissUpdate}
          currentVersion={import.meta.env.VITE_APP_VERSION || "0.0.0"}
        />
      ) : null}
    </div>
  )
}
