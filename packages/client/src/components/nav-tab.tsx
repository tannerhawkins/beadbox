import type { LucideIcon } from "lucide-react"
import { cn } from "../lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

interface NavTabProps {
  label: string
  tooltip: string
  icon: LucideIcon
  active: boolean
  onSelect: () => void
}

export function NavTab({ label, tooltip, icon: Icon, active, onSelect }: NavTabProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onSelect}
          className={cn(
            "px-2.5 py-1.5 text-sm font-medium rounded-md transition-colors inline-flex items-center gap-1.5",
            active
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
