const ANSWER_PREFIX = "Answer from Tanner:"

type AnswerResult =
  | { success: true }
  | { success: false; stage: "comment" | "clear"; error: string }

export function answerComment(text: string): string | null {
  const trimmed = text.trim()
  return trimmed === "" ? null : `${ANSWER_PREFIX} ${trimmed}`
}

export async function answerThenClear(
  saveComment: () => Promise<void>,
  clearNeedsAnswer: () => Promise<void>,
): Promise<AnswerResult> {
  let stage: "comment" | "clear" = "comment"
  try {
    await saveComment()
    stage = "clear"
    await clearNeedsAnswer()
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (stage === "comment") return { success: false, stage, error: message }
    return {
      success: false,
      stage,
      error: `Answer saved as a comment, but removing the needs-answer label failed: ${message}`,
    }
  }
}
