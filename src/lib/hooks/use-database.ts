import { preloadEmbeddingModel } from '@/lib/ai/embeddings'
import { preloadWhisperModel } from '@/lib/ai/whisper'
import { initDb } from '@/lib/db'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import { useEffect, useState } from 'react'

export function useDatabase() {
  const [dbReady, setDbReady] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)

  useEffect(() => {
    initDb()
      .then(() => {
        setDbReady(true)
        preloadEmbeddingModel()
        const savedSttModel = localStorage.getItem(STORAGE_KEYS.STT_MODEL)
        if (savedSttModel) {
          preloadWhisperModel(savedSttModel)
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        console.error('DB init failed:', message)
        setDbError(message)
      })
  }, [])

  return { dbReady, dbError }
}
