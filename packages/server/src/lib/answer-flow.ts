export const ANSWER_PREFIX = "Answer from Tanner:"

export type AnswerResult =
  | { success: true }
  | { success: false; stage: "comment" | "clear"; error: string }

export function answerComment(text: string): string | null {
  const trimmed = text.trim()
  return trimmed === "" ? null : `${ANSWER_PREFIX} ${trimmed}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function answerThenClear(
  saveComment: () => Promise<void>,
  clearHuman: () => Promise<void>,
): Promise<AnswerResult> {
  try {
    await saveComment()
  } catch (error) {
    return { success: false, stage: "comment", error: errorMessage(error) }
  }
  try {
    await clearHuman()
  } catch (error) {
    return {
      success: false,
      stage: "clear",
      error: `Answer saved as a comment, but removing the human label failed: ${errorMessage(error)}`,
    }
  }
  return { success: true }
}
