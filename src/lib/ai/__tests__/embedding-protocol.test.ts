import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmbeddingResponse } from '@/workers/embedding.worker'

let mockPostMessage: ReturnType<typeof vi.fn>
let simulateMessage: (data: EmbeddingResponse) => void

// These get assigned after dynamic import
let embedForStorage: (id: string, text: string) => Promise<number[]>
let embedForQuery: (text: string) => Promise<number[]>
let preloadEmbeddingModel: () => void
let embeddingLifecycle: { setError: ReturnType<typeof vi.fn>; setProgress: ReturnType<typeof vi.fn>; setReady: ReturnType<typeof vi.fn>; startLoading: ReturnType<typeof vi.fn> }

// Mock model-lifecycle before any imports resolve it
vi.mock('@/lib/ai/model-lifecycle', () => ({
  ModelLifecycle: class {
    startLoading = vi.fn()
    setProgress = vi.fn()
    setReady = vi.fn()
    setError = vi.fn()
  },
}))

beforeAll(async () => {
  mockPostMessage = vi.fn()

  // Stub Worker globally before the module creates one
  vi.stubGlobal(
    'Worker',
    class MockWorker {
      private _onmessage?: (event: MessageEvent) => void

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_url: unknown, _options?: unknown) {}

      set onmessage(handler: (event: MessageEvent) => void) {
        this._onmessage = handler
        simulateMessage = (data: EmbeddingResponse) => {
          handler({ data } as MessageEvent<EmbeddingResponse>)
        }
      }

      get onmessage(): ((event: MessageEvent) => void) | undefined {
        return this._onmessage
      }

      postMessage = (...args: unknown[]) => mockPostMessage(...args)
    },
  )

  // Dynamic import so the module sees our mocked Worker
  const mod = await import('@/lib/ai/embeddings')
  embedForStorage = mod.embedForStorage
  embedForQuery = mod.embedForQuery
  preloadEmbeddingModel = mod.preloadEmbeddingModel
  embeddingLifecycle = mod.embeddingLifecycle as unknown as typeof embeddingLifecycle
})

beforeEach(() => {
  mockPostMessage.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('request/response matching by ID', () => {
  it('resolves the correct promise when responses arrive out of order', async () => {
    const p1 = embedForStorage('req-1', 'text one')
    const p2 = embedForStorage('req-2', 'text two')

    // Respond to req-2 first, then req-1
    simulateMessage({ type: 'result', id: 'req-2', vector: [4, 5, 6] })
    simulateMessage({ type: 'result', id: 'req-1', vector: [1, 2, 3] })

    expect(await p1).toEqual([1, 2, 3])
    expect(await p2).toEqual([4, 5, 6])
  })

  it('posts the correct message to the worker', () => {
    // Fire-and-forget — we just want to inspect postMessage
    const promise = embedForStorage('msg-id', 'hello')

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'embed',
      id: 'msg-id',
      text: 'passage: hello',
    })

    // Clean up: resolve the pending request
    simulateMessage({ type: 'result', id: 'msg-id', vector: [0] })
    return promise
  })

  it('resolves embedForQuery with a worker-generated ID', async () => {
    const promise = embedForQuery('search text')

    // Capture the ID assigned by embedForQuery (it uses crypto.randomUUID)
    const sentMessage = mockPostMessage.mock.calls.at(-1)?.[0] as {
      type: string
      id: string
      text: string
    }
    expect(sentMessage.type).toBe('embed')
    expect(sentMessage.text).toBe('query: search text')

    simulateMessage({ type: 'result', id: sentMessage.id, vector: [7, 8, 9] })
    expect(await promise).toEqual([7, 8, 9])
  })

  it('ignores responses for unknown IDs', async () => {
    const promise = embedForStorage('known-id', 'text')

    // This should be silently ignored — no crash
    simulateMessage({ type: 'result', id: 'unknown-id', vector: [0] })

    // The known request should still be pending — resolve it
    simulateMessage({ type: 'result', id: 'known-id', vector: [1] })
    expect(await promise).toEqual([1])
  })
})

describe('timeout cleanup', () => {
  it('rejects after 30s and clears the timer', async () => {
    vi.useFakeTimers()

    const promise = embedForStorage('timeout-id', 'slow text')

    vi.advanceTimersByTime(30_000)

    await expect(promise).rejects.toThrow('timed out')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the timer when a response arrives before timeout', async () => {
    vi.useFakeTimers()

    const promise = embedForStorage('fast-id', 'fast text')

    // Respond before timeout
    simulateMessage({ type: 'result', id: 'fast-id', vector: [1] })
    expect(await promise).toEqual([1])

    // Advancing past 30s should not cause any issues — timer was cleared
    vi.advanceTimersByTime(30_000)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('broadcast error (error without ID)', () => {
  it('rejects all pending requests', async () => {
    const p1 = embedForStorage('err-1', 'a')
    const p2 = embedForStorage('err-2', 'b')
    const p3 = embedForStorage('err-3', 'c')

    simulateMessage({ type: 'error', message: 'Model crashed' })

    await expect(p1).rejects.toThrow('Model crashed')
    await expect(p2).rejects.toThrow('Model crashed')
    await expect(p3).rejects.toThrow('Model crashed')
  })

  it('only rejects the targeted request for error with ID', async () => {
    const p1 = embedForStorage('ok-1', 'a')
    const p2 = embedForStorage('fail-1', 'b')

    // Error with specific ID only affects that request
    simulateMessage({ type: 'error', id: 'fail-1', message: 'Bad input' })

    await expect(p2).rejects.toThrow('Bad input')

    // p1 should still be pending — resolve it
    simulateMessage({ type: 'result', id: 'ok-1', vector: [1] })
    expect(await p1).toEqual([1])
  })
})

describe('load-error handling', () => {
  it('sets lifecycle error state without rejecting pending requests', async () => {
    const p1 = embedForStorage('load-err-1', 'text one')
    const p2 = embedForStorage('load-err-2', 'text two')

    simulateMessage({ type: 'load-error', message: 'Network timeout' })

    expect(embeddingLifecycle.setError).toHaveBeenCalledWith('Network timeout')

    // Pending requests should still be resolvable — not rejected
    simulateMessage({ type: 'result', id: 'load-err-1', vector: [1, 2] })
    simulateMessage({ type: 'result', id: 'load-err-2', vector: [3, 4] })

    expect(await p1).toEqual([1, 2])
    expect(await p2).toEqual([3, 4])
  })

  it('does not affect progress and ready lifecycle transitions', () => {
    simulateMessage({ type: 'progress', model: 'test-model', progress: 50 })
    expect(embeddingLifecycle.setProgress).toHaveBeenCalledWith(50)

    simulateMessage({ type: 'ready', model: 'test-model' })
    expect(embeddingLifecycle.setReady).toHaveBeenCalled()
  })
})

describe('model switch during pending requests', () => {
  it('does not reject or leak pending requests when model is switched', async () => {
    const promise = embedForStorage('pending-id', 'important text')

    // Switch model while request is pending
    preloadEmbeddingModel()

    // Verify load message was sent (in addition to the embed message)
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'load', modelId: 'Xenova/multilingual-e5-small' }),
    )

    // The pending request should still be resolvable
    simulateMessage({ type: 'result', id: 'pending-id', vector: [42] })
    expect(await promise).toEqual([42])
  })

  it('allows new requests after model switch', async () => {
    preloadEmbeddingModel()

    const promise = embedForStorage('after-switch', 'new text')
    simulateMessage({ type: 'result', id: 'after-switch', vector: [99] })
    expect(await promise).toEqual([99])
  })
})
