import { experimental_transcribe as transcribe } from 'ai'
import { transformersJS, TransformersJSTranscriptionModel } from '@browser-ai/transformers-js'
import { ModelLifecycle } from './model-lifecycle'

export const whisperLifecycle = new ModelLifecycle('Xenova/whisper-tiny')

let model: TransformersJSTranscriptionModel | null = null
let currentModelId = 'Xenova/whisper-tiny'

function getModel(modelId?: string): TransformersJSTranscriptionModel {
  const id = modelId ?? currentModelId
  if (model && currentModelId === id) return model

  currentModelId = id
  model = transformersJS.transcription(id, {
    device: 'webgpu',
    worker: new Worker(new URL('../../workers/transcription.worker.ts', import.meta.url), {
      type: 'module',
    }),
  }) as TransformersJSTranscriptionModel

  return model
}

export function checkWhisperAvailability(): Promise<'unavailable' | 'downloadable' | 'available'> {
  return getModel().availability()
}

export async function loadWhisperWithProgress(modelId: string): Promise<void> {
  whisperLifecycle.startLoading(modelId)
  try {
    const m = getModel(modelId)
    await m.createSessionWithProgress((progress) => {
      whisperLifecycle.setProgress(progress * 100)
    })
    whisperLifecycle.setReady()
  } catch (e: unknown) {
    whisperLifecycle.setError(e instanceof Error ? e.message : String(e))
    throw e
  }
}

export async function transcribeAudio(audio: Blob): Promise<string> {
  const buffer = await audio.arrayBuffer()
  const result = await transcribe({
    model: getModel(),
    audio: new Uint8Array(buffer),
  })
  return result.text
}

export function preloadWhisperModel(modelId?: string): void {
  const id = modelId ?? currentModelId
  loadWhisperWithProgress(id).catch((e: unknown) => {
    whisperLifecycle.setError(e instanceof Error ? e.message : String(e))
  })
}

export function ensureWhisperModel(): void {
  const { state } = whisperLifecycle.getSnapshot()
  if (state === 'loading' || state === 'ready') return
  preloadWhisperModel()
}
