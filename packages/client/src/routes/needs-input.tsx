import { createFileRoute } from "@tanstack/react-router"
import { NeedsInputPage } from "../components/needs-input-page"

export const Route = createFileRoute("/needs-input")({
  component: NeedsInputPage,
})
