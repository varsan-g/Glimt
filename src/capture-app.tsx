import { ErrorBoundary } from '@/components/error-boundary'
import { CompactCaptureWindow } from '@/features/capture/compact-capture-window'
import { embedForStorage, preloadEmbeddingModel } from '@/lib/ai/embeddings'
import { generateTitle } from '@/lib/ai/title-generation'
import { preloadWhisperModel } from '@/lib/ai/whisper'
import { createIdea, getIdea, initDb, storeEmbedding, updateIdea } from '@/lib/db'
import { exportIdea } from '@/lib/export-service'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveState = 'idle' | 'saved'

export function CaptureApp() {
  const [dbReady, setDbReady] = useState(false)
  const [editorKey, setEditorKey] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [autoRecord, setAutoRecord] = useState(false)
  const isRecordingRef = useRef(false)
  const isSavingRef = useRef(false)
  const isDraggingRef = useRef(false)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Make html+body transparent so rounded window corners show through
  useEffect(() => {
    document.documentElement.classList.add('capture-transparent')
    // Clear WebView2 background on Windows for true window transparency
    import('@tauri-apps/api/webview')
      .then(({ getCurrentWebview }) =>
        getCurrentWebview().setBackgroundColor({ red: 0, green: 0, blue: 0, alpha: 0 }),
      )
      .catch(() => {
        // Expected when not running in Tauri context (e.g. Vite dev server)
      })
    return () => document.documentElement.classList.remove('capture-transparent')
  }, [])

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
        console.error('Capture DB init failed:', error)
      })
  }, [])

  // Handle window focus/blur
  useEffect(() => {
    async function setup() {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      const currentWindow = getCurrentWebviewWindow()

      function cancelPendingHide() {
        if (blurTimeoutRef.current) {
          clearTimeout(blurTimeoutRef.current)
          blurTimeoutRef.current = null
        }
      }

      const unlistenFocus = await currentWindow.onFocusChanged(({ payload: focused }) => {
        if (focused) {
          cancelPendingHide()
          if (isDraggingRef.current) {
            isDraggingRef.current = false
            return // Don't reset editor after a drag
          }
          // Reset editor on focus so it's clean for a new idea
          setAutoRecord(false)
          setEditorKey((k) => k + 1)
        } else if (
          !isRecordingRef.current &&
          !isSavingRef.current &&
          !isDraggingRef.current
        ) {
          // Debounce hide — resize/move events cancel this if the window is still active
          blurTimeoutRef.current = setTimeout(() => {
            blurTimeoutRef.current = null
            // Final check: only hide if the document truly lost focus
            if (!document.hasFocus()) {
              currentWindow.hide()
            }
          }, 300)
        }
      })

      // Resize/move events fire during drag-resize — cancel any pending hide
      const unlistenResize = await currentWindow.onResized(() => cancelPendingHide())
      const unlistenMove = await currentWindow.onMoved(() => cancelPendingHide())

      return () => {
        unlistenFocus()
        unlistenResize()
        unlistenMove()
      }
    }

    const cleanup = setup()
    return () => {
      cleanup.then((unlistenAll) => unlistenAll())
    }
  }, [])

  // Listen for start-recording event from quick record shortcut
  useEffect(() => {
    let unlisten: (() => void) | undefined
    import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen('start-recording', () => {
          setAutoRecord(true)
          setEditorKey((k) => k + 1)
        }),
      )
      .then((fn) => {
        unlisten = fn
      })
      .catch(() => {
        // Expected when not running in Tauri context (e.g. Vite dev server)
      })
    return () => {
      unlisten?.()
    }
  }, [])

  const finishSave = useCallback(async (ideaId: string, text: string) => {
    // Increment capture count for conditional hints
    const count = parseInt(localStorage.getItem(STORAGE_KEYS.CAPTURE_COUNT) ?? '0', 10)
    localStorage.setItem(STORAGE_KEYS.CAPTURE_COUNT, String(count + 1))

    // Store last idea for edit-last affordance
    localStorage.setItem(STORAGE_KEYS.LAST_IDEA_ID, ideaId)
    localStorage.setItem(STORAGE_KEYS.LAST_IDEA_PREVIEW, text.slice(0, 50))

    // Show save confirmation + hide window immediately for responsive UX
    setSaveState('saved')
    isSavingRef.current = true

    setTimeout(async () => {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      await getCurrentWebviewWindow().hide()
      setSaveState('idle')
      isSavingRef.current = false
    }, 300)

    // Embed before emitting idea-saved so the dashboard can search the new idea
    try {
      const embedPromise = embedForStorage(ideaId, text).then((vector) =>
        storeEmbedding(ideaId, 'multilingual-e5-small', vector),
      )
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, 10_000))
      await Promise.race([embedPromise, timeout])
    } catch (error) {
      console.error('Embedding failed during save:', error)
    }

    // Now emit idea-saved — embedding is stored (or timed out)
    const { emit } = await import('@tauri-apps/api/event')
    await emit('idea-saved')

    // Background export (fire-and-forget)
    const exportEnabled = localStorage.getItem(STORAGE_KEYS.EXPORT_ENABLED) === 'true'
    const exportDir = localStorage.getItem(STORAGE_KEYS.EXPORT_DIR)
    if (exportEnabled && exportDir) {
      getIdea(ideaId)
        .then((idea) => {
          if (idea) return exportIdea(idea, exportDir)
        })
        .catch(console.error)
    }

    // Background title generation (fire-and-forget)
    const autoTitleEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_TITLE_ENABLED) === 'true'
    if (autoTitleEnabled) {
      generateTitle(text)
        .then(async (title) => {
          await updateIdea(ideaId, { title })
          const { emit: emitEvent } = await import('@tauri-apps/api/event')
          await emitEvent('title-generated')
        })
        .catch(console.error)
    }
  }, [])

  const handleSave = useCallback(
    async (text: string) => {
      try {
        const idea = await createIdea(text)
        await finishSave(idea.id, text)
      } catch (error) {
        console.error('Failed to save idea:', error)
      }
    },
    [finishSave],
  )

  const handleEdit = useCallback(
    async (id: string, text: string) => {
      try {
        await updateIdea(id, { text })
        await finishSave(id, text)
      } catch (error) {
        console.error('Failed to update idea:', error)
      }
    },
    [finishSave],
  )

  const handleClose = useCallback(async () => {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    await getCurrentWebviewWindow().hide()
  }, [])

  const handleRecordingChange = useCallback((recording: boolean) => {
    isRecordingRef.current = recording
  }, [])

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true
  }, [])

  if (!dbReady) {
    return null
  }

  return (
    <ErrorBoundary>
      <CompactCaptureWindow
        key={editorKey}
        onSave={handleSave}
        onEdit={handleEdit}
        onClose={handleClose}
        onRecordingChange={handleRecordingChange}
        onDragStart={handleDragStart}
        saveState={saveState}
        autoRecord={autoRecord}
      />
    </ErrorBoundary>
  )
}
