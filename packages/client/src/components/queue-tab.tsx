import type { LucideIcon } from "lucide-react"
import { tabButtonClass } from "./nav-tab"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

interface QueueTabProps {
  label: string
  tooltip: string
  icon: LucideIcon
  active: boolean
  count: number
  countTestId: string
  onSelect: () => void
}

export function QueueTab({
  label,
  tooltip,
  icon: Icon,
  active,
  count,
  countTestId,
  onSelect,
}: QueueTabProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={onSelect} className={tabButtonClass(active)}>
          <Icon className="h-3.5 w-3.5" />
          {label}
          {count > 0 && (
            <span
              data-testid={countTestId}
              className="rounded-full bg-accent px-1.5 text-[10px] font-semibold"
            >
              {count}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
