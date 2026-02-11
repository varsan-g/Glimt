import { embedForStorage } from '@/lib/ai/embeddings'
import { ensureTitleModel, generateTitle } from '@/lib/ai/title-generation'
import { archiveIdea, deleteIdea, getIdea, getIdeas, storeEmbedding, updateIdea } from '@/lib/db'
import { exportIdea } from '@/lib/export-service'
import { searchIdeas } from '@/lib/search'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import type { Idea } from '@/lib/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

export function useIdeaActions() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [showArchive, setShowArchive] = useState(false)
  const [archiveCount, setArchiveCount] = useState(0)
  const [exportEnabled, setExportEnabled] = useState(false)
  const [exportDir, setExportDir] = useState<string | null>(null)
  const [autoTitleEnabled, setAutoTitleEnabled] = useState(
    () => localStorage.getItem(STORAGE_KEYS.AUTO_TITLE_ENABLED) === 'true',
  )

  // Use ref to avoid stale closures in event listeners
  const showArchiveRef = useRef(showArchive)
  showArchiveRef.current = showArchive

  const ideasRef = useRef(ideas)
  ideasRef.current = ideas

  const exportEnabledRef = useRef(exportEnabled)
  exportEnabledRef.current = exportEnabled

  const exportDirRef = useRef(exportDir)
  exportDirRef.current = exportDir

  const loadIdeas = useCallback(async (archived?: boolean) => {
    const showingArchive = archived ?? showArchiveRef.current
    try {
      const loaded = await getIdeas({ archived: showingArchive })
      setIdeas(loaded)
      getIdeas({ archived: true })
        .then((archivedIdeas) => setArchiveCount(archivedIdeas.length))
        .catch(console.error)
    } catch (error) {
      console.error('Failed to load ideas:', error)
    }
  }, [])

  // Listen for idea-saved and title-generated events from the capture window
  useEffect(() => {
    let unlistenSaved: (() => void) | undefined
    let unlistenTitle: (() => void) | undefined
    import('@tauri-apps/api/event')
      .then(({ listen }) => {
        listen('idea-saved', () => {
          loadIdeas()
          toast.success('Idea captured')
        }).then((fn) => {
          unlistenSaved = fn
        })
        listen('title-generated', () => {
          loadIdeas()
        }).then((fn) => {
          unlistenTitle = fn
        })
      })
      .catch(() => {
        // Not running in Tauri context
      })
    return () => {
      unlistenSaved?.()
      unlistenTitle?.()
    }
  }, [loadIdeas])

  const handleSearch = useCallback(
    async (query: string) => {
      try {
        if (!query.trim()) {
          await loadIdeas()
          return
        }
        const results = await searchIdeas(query)
        const filtered = results.filter((r) => r.idea.archived === showArchiveRef.current)
        setIdeas(filtered.map((r) => r.idea))
      } catch (error) {
        console.error('Failed to search ideas:', error)
      }
    },
    [loadIdeas],
  )

  const handleUpdate = useCallback(
    async (id: string, text: string) => {
      try {
        await updateIdea(id, { text })

        // Await embedding before reporting success so semantic search reflects the edit
        try {
          const embedPromise = embedForStorage(id, text).then((vector) =>
            storeEmbedding(id, 'multilingual-e5-small', vector),
          )
          const timeout = new Promise<void>((resolve) => setTimeout(resolve, 10_000))
          await Promise.race([embedPromise, timeout])
        } catch (error) {
          console.error('Re-embedding failed during update:', error)
        }

        await loadIdeas()
        toast.success('Idea updated')
        if (exportEnabledRef.current && exportDirRef.current) {
          const dir = exportDirRef.current
          getIdea(id)
            .then((idea) => {
              if (idea) {
                return exportIdea(idea, dir)
              }
            })
            .catch(console.error)
        }
      } catch (error) {
        console.error('Failed to update idea:', error)
        toast.error('Failed to update idea')
      }
    },
    [loadIdeas],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteIdea(id)
        await loadIdeas()
        toast.success('Idea deleted')
      } catch (error) {
        console.error('Failed to delete idea:', error)
        toast.error('Failed to delete idea')
      }
    },
    [loadIdeas],
  )

  const handleArchive = useCallback(
    async (id: string) => {
      try {
        const idea = ideasRef.current.find((i) => i.id === id)
        if (idea) {
          await archiveIdea(id, !idea.archived)
          await loadIdeas()
          toast.success(idea.archived ? 'Idea restored to Ideas' : 'Idea moved to Archive')
        }
      } catch (error) {
        console.error('Failed to archive idea:', error)
        toast.error('Failed to archive idea')
      }
    },
    [loadIdeas],
  )

  const handleToggleArchive = useCallback(
    async (archived: boolean) => {
      setShowArchive(archived)
      await loadIdeas(archived)
    },
    [loadIdeas],
  )

  const handleAutoTitleEnabledChange = useCallback((enabled: boolean) => {
    setAutoTitleEnabled(enabled)
    localStorage.setItem(STORAGE_KEYS.AUTO_TITLE_ENABLED, String(enabled))
    if (enabled) {
      ensureTitleModel()
    }
  }, [])

  const handleRegenerateTitle = useCallback(
    async (id: string) => {
      const idea = ideasRef.current.find((i) => i.id === id)
      if (!idea) return
      try {
        const title = await generateTitle(idea.text)
        await updateIdea(id, { title })
        await loadIdeas()
        toast.success('Title regenerated')
      } catch (error) {
        console.error('Failed to regenerate title:', error)
        toast.error('Failed to regenerate title')
      }
    },
    [loadIdeas],
  )

  const handleCapture = useCallback(async () => {
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      const captureWindow = await WebviewWindow.getByLabel('capture')
      if (captureWindow) {
        await captureWindow.show()
        await captureWindow.setFocus()
      }
    } catch {
      // Not running in Tauri context
    }
  }, [])

  return {
    ideas,
    showArchive,
    archiveCount,
    exportEnabled,
    exportDir,
    autoTitleEnabled,
    loadIdeas,
    onSearch: handleSearch,
    onUpdate: handleUpdate,
    onDelete: handleDelete,
    onArchive: handleArchive,
    onToggleArchive: handleToggleArchive,
    onCapture: handleCapture,
    onRegenerateTitle: handleRegenerateTitle,
    onExportEnabledChange: setExportEnabled,
    onExportDirChange: setExportDir,
    onAutoTitleEnabledChange: handleAutoTitleEnabledChange,
  }
}
