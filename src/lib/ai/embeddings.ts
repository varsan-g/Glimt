import type { EmbeddingRequest, EmbeddingResponse } from '@/workers/embedding.worker'
import { ModelLifecycle } from './model-lifecycle'

export const embeddingLifecycle = new ModelLifecycle('Xenova/multilingual-e5-small')

type PendingRequest = {
  resolve: (vector: number[]) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const pendingRequests = new Map<string, PendingRequest>()

const worker = new Worker(new URL('../../workers/embedding.worker.ts', import.meta.url), {
  type: 'module',
})

worker.onmessage = (event: MessageEvent<EmbeddingResponse>) => {
  const { data } = event
  switch (data.type) {
    case 'result': {
      const pending = pendingRequests.get(data.id)
      if (pending) {
        clearTimeout(pending.timer)
        pending.resolve(data.vector)
        pendingRequests.delete(data.id)
      }
      break
    }
    case 'progress': {
      embeddingLifecycle.setProgress(data.progress)
      break
    }
    case 'ready': {
      embeddingLifecycle.setReady()
      break
    }
    case 'load-error': {
      embeddingLifecycle.setError(data.message)
      break
    }
    case 'error': {
      if ('id' in data && data.id) {
        const pending = pendingRequests.get(data.id)
        if (pending) {
          clearTimeout(pending.timer)
          pending.reject(new Error(data.message))
          pendingRequests.delete(data.id)
        }
      } else {
        for (const [id, pending] of pendingRequests) {
          clearTimeout(pending.timer)
          pending.reject(new Error(data.message))
          pendingRequests.delete(id)
        }
      }
      break
    }
  }
}

const EMBEDDING_TIMEOUT_MS = 30_000

function sendToWorker(request: EmbeddingRequest & { type: 'embed' }): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(request.id)
      reject(new Error(`Embedding request timed out after ${EMBEDDING_TIMEOUT_MS}ms`))
    }, EMBEDDING_TIMEOUT_MS)
    pendingRequests.set(request.id, { resolve, reject, timer })
    worker.postMessage(request)
  })
}

export function embedForStorage(id: string, text: string): Promise<number[]> {
  return sendToWorker({ type: 'embed', id, text: `passage: ${text}` })
}

export function embedForQuery(text: string): Promise<number[]> {
  const id = crypto.randomUUID()
  return sendToWorker({ type: 'embed', id, text: `query: ${text}` })
}

export function preloadEmbeddingModel(): void {
  embeddingLifecycle.startLoading('Xenova/multilingual-e5-small')
  worker.postMessage({
    type: 'load',
    modelId: 'Xenova/multilingual-e5-small',
  } satisfies EmbeddingRequest)
}
