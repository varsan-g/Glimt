import { exists, mkdir, writeTextFile } from '@tauri-apps/plugin-fs'
import { generateFilename, generateMarkdown } from './export'
import type { Idea } from './types'

export async function exportIdea(idea: Idea, exportDir: string): Promise<void> {
  try {
    // Ensure directory exists (M4.4 resilience)
    const dirExists = await exists(exportDir)
    if (!dirExists) {
      await mkdir(exportDir, { recursive: true })
    }

    const filename = generateFilename(idea)
    const content = generateMarkdown(idea)
    const filepath = `${exportDir}/${filename}`

    await writeTextFile(filepath, content)
  } catch (error) {
    // Log but don't block capture (M4.4 resilience)
    console.error(
      'Export failed (if this persists, re-select the export folder in Settings):',
      error,
    )
    throw error
  }
}
