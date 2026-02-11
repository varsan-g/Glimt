export const TITLE_SYSTEM_PROMPT = `You are a title generator. You reply with ONLY the title — no labels, no prefixes, no quotes, no explanation. 3-7 words, title case.`

export function buildTitlePrompt(noteText: string): string {
  const truncated = noteText.length > 500 ? noteText.slice(0, 500) : noteText
  return `Write a short title for this note. Reply with ONLY the title.\n\n${truncated}`
}
