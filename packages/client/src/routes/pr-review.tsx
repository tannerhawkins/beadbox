import { createFileRoute } from "@tanstack/react-router"
import { PrReviewPage } from "../components/pr-review-page"

export const Route = createFileRoute("/pr-review")({
  component: PrReviewPage,
})
