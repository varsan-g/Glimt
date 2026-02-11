import { generateText } from 'ai'
import { transformersJS, type TransformersJSLanguageModel } from '@browser-ai/transformers-js'
import { ModelLifecycle } from './model-lifecycle'
import { TITLE_SYSTEM_PROMPT, buildTitlePrompt } from './title-prompt'

export const titleLifecycle = new ModelLifecycle('HuggingFaceTB/SmolLM2-360M-Instruct')

let model: TransformersJSLanguageModel | null = null
let currentModelId = 'HuggingFaceTB/SmolLM2-360M-Instruct'

function getModel(modelId?: string): TransformersJSLanguageModel {
  const id = modelId ?? currentModelId
  if (model && currentModelId === id) return model

  currentModelId = id
  model = transformersJS.languageModel(id, {
    device: 'webgpu',
    worker: new Worker(new URL('../../workers/title.worker.ts', import.meta.url), {
      type: 'module',
    }),
  })

  return model
}

export async function loadTitleModelWithProgress(modelId: string): Promise<void> {
  titleLifecycle.startLoading(modelId)
  try {
    const m = getModel(modelId)
    await m.createSessionWithProgress((progress) => {
      titleLifecycle.setProgress(progress * 100)
    })
    titleLifecycle.setReady()
  } catch (e: unknown) {
    titleLifecycle.setError(e instanceof Error ? e.message : String(e))
    throw e
  }
}

function cleanTitle(raw: string): string {
  let title = raw.trim()

  // Take only the first line
  const firstLine = title.split('\n')[0]
  title = firstLine ? firstLine.trim() : title.trim()

  // Strip common LLM prefixes (e.g. "Title: ...", "Here is a title: ...")
  title = title.replace(/^(?:title|here(?:'s| is)(?: a| the)? title)\s*[:：]\s*/i, '')

  // Strip wrapping quotes (after prefix removal)
  if (
    (title.startsWith('"') && title.endsWith('"')) ||
    (title.startsWith("'") && title.endsWith("'"))
  ) {
    title = title.slice(1, -1).trim()
  }

  // Strip trailing punctuation
  title = title.replace(/[.:!?]+$/, '').trim()

  // Truncate if too long
  if (title.length > 60) {
    const truncated = title.slice(0, 60)
    const lastSpace = truncated.lastIndexOf(' ')
    title = lastSpace > 20 ? truncated.slice(0, lastSpace) + '...' : truncated + '...'
  }

  return title
}

export async function generateTitle(text: string): Promise<string> {
  const result = await generateText({
    model: getModel(),
    system: TITLE_SYSTEM_PROMPT,
    prompt: buildTitlePrompt(text),
    maxOutputTokens: 20,
  })

  return cleanTitle(result.text)
}

export function preloadTitleModel(modelId?: string): void {
  const id = modelId ?? currentModelId
  loadTitleModelWithProgress(id).catch((e: unknown) => {
    titleLifecycle.setError(e instanceof Error ? e.message : String(e))
  })
}

export function ensureTitleModel(): void {
  const { state } = titleLifecycle.getSnapshot()
  if (state === 'loading' || state === 'ready') return
  preloadTitleModel()
}
