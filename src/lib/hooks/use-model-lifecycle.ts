import { useSyncExternalStore } from 'react'
import type { ModelLifecycle, ModelSnapshot } from '@/lib/ai/model-lifecycle'

export function useModelLifecycle(lifecycle: ModelLifecycle): ModelSnapshot {
  return useSyncExternalStore(lifecycle.subscribe, lifecycle.getSnapshot)
}
