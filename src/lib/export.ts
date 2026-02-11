import type { Idea } from './types'

export function generateMarkdown(idea: Idea): string {
  const created = new Date(idea.createdAt).toISOString()
  const updated = new Date(idea.updatedAt).toISOString()

  const lines: string[] = [
    '---',
    `id: "${idea.id}"`,
    `created: "${created}"`,
    `updated: "${updated}"`,
  ]

  if (idea.title) {
    lines.push(`title: "${idea.title.replace(/"/g, '\\"')}"`)
  }

  lines.push('---', '', idea.text, '')

  return lines.join('\n')
}

export function generateFilename(idea: Idea): string {
  const d = new Date(idea.createdAt)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}_${hours}${minutes}${seconds}_${idea.id}.md`
}
