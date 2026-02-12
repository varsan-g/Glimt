import {
  pipeline,
  type FeatureExtractionPipeline,
  type ProgressInfo,
} from '@huggingface/transformers'

export type EmbeddingRequest =
  | { type: 'load'; modelId: string }
  | { type: 'embed'; id: string; text: string }

export type EmbeddingResponse =
  | { type: 'progress'; model: string; progress: number }
  | { type: 'ready'; model: string }
  | { type: 'result'; id: string; vector: number[] }
  | { type: 'error'; id?: string; message: string }
  | { type: 'load-error'; message: string }

let extractor: FeatureExtractionPipeline | null = null
let loadPromise: Promise<FeatureExtractionPipeline> | null = null
let currentModelId: string | null = null
let loadVersion = 0

async function loadModel(modelId: string): Promise<FeatureExtractionPipeline> {
  if (extractor && currentModelId === modelId) return extractor
  if (loadPromise && currentModelId === modelId) return loadPromise

  // If a different model is loading, wait for it to finish before switching
  if (loadPromise && currentModelId !== modelId) {
    await loadPromise.catch(() => {})
  }

  const thisVersion = ++loadVersion
  currentModelId = modelId

  loadPromise = (async () => {
    try {
      self.postMessage({
        type: 'progress',
        model: modelId,
        progress: 0,
      } satisfies EmbeddingResponse)

      const createPipeline = pipeline as (
        task: 'feature-extraction',
        model: string,
        options?: {
          device?: string
          dtype?: string
          progress_callback?: (progress: ProgressInfo) => void
        },
      ) => Promise<FeatureExtractionPipeline>

      const loaded = await createPipeline('feature-extraction', modelId, {
        progress_callback: (progress: ProgressInfo) => {
          if (progress.status === 'progress') {
            self.postMessage({
              type: 'progress',
              model: modelId,
              progress: progress.progress,
            } satisfies EmbeddingResponse)
          }
        },
      })

      // Stale load — a newer load request was made while this one was in-flight
      if (loadVersion !== thisVersion) {
        await loaded.dispose()
        return extractor!
      }

      self.postMessage({
        type: 'ready',
        model: modelId,
      } satisfies EmbeddingResponse)

      extractor = loaded
      return loaded
    } catch (error) {
      if (loadVersion === thisVersion) {
        loadPromise = null
        currentModelId = null
      }
      throw error
    }
  })()

  return loadPromise
}

self.onmessage = async (event: MessageEvent<EmbeddingRequest>) => {
  const { data } = event

  if (data.type === 'load') {
    try {
      await loadModel(data.modelId)
    } catch (error) {
      self.postMessage({
        type: 'load-error',
        message: error instanceof Error ? error.message : String(error),
      } satisfies EmbeddingResponse)
    }
  } else if (data.type === 'embed') {
    try {
      const ext = await loadModel(currentModelId ?? 'Xenova/multilingual-e5-small')
      const output = await ext(data.text, { pooling: 'mean', normalize: true })
      self.postMessage({
        type: 'result',
        id: data.id,
        vector: Array.from(output.data as Float32Array),
      } satisfies EmbeddingResponse)
    } catch (error) {
      self.postMessage({
        type: 'error',
        id: data.id,
        message: error instanceof Error ? error.message : String(error),
      } satisfies EmbeddingResponse)
    }
  }
}
