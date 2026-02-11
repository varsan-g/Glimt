import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { embeddingLifecycle } from '@/lib/ai/embeddings'
import { titleLifecycle } from '@/lib/ai/title-generation'
import { whisperLifecycle } from '@/lib/ai/whisper'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import { useModelLifecycle } from './use-model-lifecycle'
import type { ModelState } from '@/lib/ai/model-lifecycle'

export function useModelNotifications(): void {
  const stt = useModelLifecycle(whisperLifecycle)
  const embedding = useModelLifecycle(embeddingLifecycle)
  const title = useModelLifecycle(titleLifecycle)

  const prevStt = useRef<ModelState>(stt.state)
  const prevEmb = useRef<ModelState>(embedding.state)
  const prevTitle = useRef<ModelState>(title.state)

  useEffect(() => {
    if (prevStt.current !== 'ready' && stt.state === 'ready') {
      const name = stt.modelId.split('/').pop() ?? stt.modelId
      toast.success(`${name} model ready`)
      localStorage.setItem(STORAGE_KEYS.STT_MODEL, stt.modelId)
    }
    prevStt.current = stt.state
  }, [stt.state, stt.modelId])

  useEffect(() => {
    if (prevEmb.current !== 'ready' && embedding.state === 'ready') {
      const name = embedding.modelId.split('/').pop() ?? embedding.modelId
      toast.success(`${name} model ready`)
    }
    prevEmb.current = embedding.state
  }, [embedding.state, embedding.modelId])

  useEffect(() => {
    if (prevTitle.current !== 'ready' && title.state === 'ready') {
      const name = title.modelId.split('/').pop() ?? title.modelId
      toast.success(`${name} model ready`)
    }
    prevTitle.current = title.state
  }, [title.state, title.modelId])
}
