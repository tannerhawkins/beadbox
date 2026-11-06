// ⌘1–⌘8 view switching. Beads handles ⌘1–⌘8 in epic-navigation-keys using the
// same VIEW_ROUTES table.

export const VIEW_ROUTES: Record<string, string> = {
  "1": "/",
  "2": "/activity",
  "3": "/formulas",
  "4": "/trains",
  "5": "/chart",
  "6": "/waiting",
  "7": "/needs-input",
  "8": "/pr-review",
}

export interface ViewSwitchContext {
  push: (to: string) => void
  hasTrains: boolean
  hasWaiting: boolean
}

// Returns true when the event was a view-switch shortcut (handled or not).
export function tryViewSwitchShortcut(e: KeyboardEvent, ctx: ViewSwitchContext): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return false
  const to = VIEW_ROUTES[e.key]
  if (!to) return false
  e.preventDefault()
  if (to === "/trains" && !ctx.hasTrains) return true
  if (to === "/waiting" && !ctx.hasWaiting) return true
  ctx.push(to)
  return true
}
