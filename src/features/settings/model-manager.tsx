import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { embeddingLifecycle, preloadEmbeddingModel } from '@/lib/ai/embeddings'
import { EMBEDDING_MODELS, STT_MODELS, TITLE_MODELS } from '@/lib/ai/models'
import { preloadTitleModel, titleLifecycle } from '@/lib/ai/title-generation'
import { preloadWhisperModel, whisperLifecycle } from '@/lib/ai/whisper'
import { useModelLifecycle } from '@/lib/hooks/use-model-lifecycle'
import {
  RiCheckLine,
  RiDownloadLine,
  RiFileTextLine,
  RiMagicLine,
  RiMicLine,
} from '@remixicon/react'

interface ModelInfo {
  id: string
  name: string
  size: string
  description: string
  type: 'stt' | 'embeddings' | 'title'
}

const AVAILABLE_MODELS: ModelInfo[] = [
  ...STT_MODELS.map((m) => ({ ...m, type: 'stt' as const })),
  ...EMBEDDING_MODELS.map((m) => ({ ...m, type: 'embeddings' as const })),
  ...TITLE_MODELS.map((m) => ({ ...m, type: 'title' as const })),
]

export function ModelManager() {
  const stt = useModelLifecycle(whisperLifecycle)
  const embedding = useModelLifecycle(embeddingLifecycle)
  const title = useModelLifecycle(titleLifecycle)

  function getStatus(modelId: string, type: 'stt' | 'embeddings' | 'title') {
    const snap = { stt, embeddings: embedding, title }[type]
    if (snap.modelId === modelId && snap.state === 'ready') return 'ready' as const
    if (snap.modelId === modelId && snap.state === 'loading') return 'downloading' as const
    return 'not-loaded' as const
  }

  function getProgress(type: 'stt' | 'embeddings' | 'title') {
    const snap = { stt, embeddings: embedding, title }[type]
    return snap.state === 'loading' ? snap.progress : undefined
  }

  function handleLoad(modelId: string, type: 'stt' | 'embeddings' | 'title') {
    if (type === 'stt') preloadWhisperModel(modelId)
    else if (type === 'embeddings') preloadEmbeddingModel()
    else if (type === 'title') preloadTitleModel(modelId)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Models are downloaded and stored locally. All AI processing runs on your device.
      </p>

      <div className="space-y-6">
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <RiMicLine className="size-4" />
            Speech-to-Text Models
          </h4>
          <div className="space-y-2">
            {AVAILABLE_MODELS.filter((m) => m.type === 'stt').map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                status={getStatus(model.id, model.type)}
                progress={getProgress(model.type)}
                onLoad={() => handleLoad(model.id, model.type)}
              />
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <RiMagicLine className="size-4" />
            Embedding Models
          </h4>
          <div className="space-y-2">
            {AVAILABLE_MODELS.filter((m) => m.type === 'embeddings').map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                status={getStatus(model.id, model.type)}
                progress={getProgress(model.type)}
                onLoad={() => handleLoad(model.id, model.type)}
              />
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <RiFileTextLine className="size-4" />
            Title Generation Models
          </h4>
          <div className="space-y-2">
            {AVAILABLE_MODELS.filter((m) => m.type === 'title').map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                status={getStatus(model.id, model.type)}
                progress={getProgress(model.type)}
                onLoad={() => handleLoad(model.id, model.type)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ModelCard({
  model,
  status,
  progress,
  onLoad,
}: {
  model: ModelInfo
  status: 'not-loaded' | 'downloading' | 'ready'
  progress: number | undefined
  onLoad: () => void
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{model.name}</span>
            <Badge variant="secondary">{model.size}</Badge>
            {status === 'ready' && (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                <RiCheckLine className="mr-0.5 size-3" />
                Active
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{model.description}</p>
          {status === 'downloading' && progress !== undefined && (
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.round(progress)}%` }}
              />
            </div>
          )}
        </div>
        <div>
          {status === 'not-loaded' && (
            <Button size="sm" onClick={onLoad}>
              <RiDownloadLine className="size-4" />
              Download
            </Button>
          )}
          {status === 'downloading' && (
            <Button size="sm" disabled>
              {progress !== undefined ? `${Math.round(progress)}%` : 'Loading...'}
            </Button>
          )}
          {status === 'ready' && (
            <Button size="sm" variant="outline" disabled>
              Loaded
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
