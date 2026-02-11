export type ModelStatus = 'not-loaded' | 'downloading' | 'ready' | 'unavailable'

export { doesBrowserSupportTransformersJS } from '@browser-ai/transformers-js'

export const STT_MODELS = [
  {
    id: 'Xenova/whisper-tiny',
    name: 'Whisper Tiny',
    size: '~40MB',
    description: '99 languages, fast transcription',
  },
  {
    id: 'Xenova/whisper-base',
    name: 'Whisper Base',
    size: '~75MB',
    description: '99 languages, better accuracy',
  },
  {
    id: 'Xenova/whisper-small',
    name: 'Whisper Small',
    size: '~250MB',
    description: '99 languages, best accuracy',
  },
] as const

export const EMBEDDING_MODELS = [
  {
    id: 'Xenova/multilingual-e5-small',
    name: 'Multilingual E5 Small',
    size: '~120MB',
    description: '100+ languages, semantic search',
  },
] as const

export const TITLE_MODELS = [
  {
    id: 'HuggingFaceTB/SmolLM2-360M-Instruct',
    name: 'SmolLM2 360M',
    size: '~250MB',
    description: 'Auto-generate titles for captured ideas (English)',
  },
] as const
