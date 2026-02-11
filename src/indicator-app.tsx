import { embedForStorage } from '@/lib/ai/embeddings'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import { preloadWhisperModel } from '@/lib/ai/whisper'
import { createIdea, getIdea, initDb, storeEmbedding } from '@/lib/db'
import { exportIdea } from '@/lib/export-service'
import { useAudioRecording } from '@/lib/use-audio-recording'
import { useCallback, useEffect, useRef, useState } from 'react'
import { RecordingPill } from './features/indicator/recording-pill'
import { getSavedRecordShortcut, parseShortcutKeys } from './lib/shortcut'

type IndicatorState = 'recording' | 'transcribing' | 'saved' | 'error'

async function positionBottomRight(): Promise<void> {
  const { primaryMonitor } = await import('@tauri-apps/api/window')
  const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const { LogicalPosition } = await import('@tauri-apps/api/dpi')
  const monitor = await primaryMonitor()
  if (!monitor) return

  const screenW = monitor.size.width / monitor.scaleFactor
  const screenH = monitor.size.height / monitor.scaleFactor
  const win = getCurrentWebviewWindow()
  await win.setPosition(new LogicalPosition(screenW - 240 - 24, screenH - 48 - 64))
}

async function hideIndicator(): Promise<void> {
  const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  await getCurrentWebviewWindow().hide()
}

export function IndicatorApp() {
  const [dbReady, setDbReady] = useState(false)
  const [pillState, setPillState] = useState<IndicatorState>('recording')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const shortcutLabel = parseShortcutKeys(getSavedRecordShortcut()).join('+')

  // Cleanup function for timers
  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const scheduleHide = useCallback(
    (delayMs: number) => {
      clearTimers()
      hideTimerRef.current = setTimeout(() => {
        hideIndicator().catch(console.error)
      }, delayMs)
    },
    [clearTimers],
  )

  const handleTranscriptionComplete = useCallback(
    async (text: string) => {
      clearTimers()

      if (!text) {
        setErrorMessage('Nothing detected')
        setPillState('error')
        scheduleHide(2000)
        return
      }

      try {
        const idea = await createIdea(text)

        // Await embedding before notifying dashboard so semantic search finds the new idea
        try {
          const embedPromise = embedForStorage(idea.id, text).then((vector) =>
            storeEmbedding(idea.id, 'multilingual-e5-small', vector),
          )
          const timeout = new Promise<void>((resolve) => setTimeout(resolve, 10_000))
          await Promise.race([embedPromise, timeout])
        } catch (error) {
          console.error('Embedding failed during indicator save:', error)
        }

        const { emit } = await import('@tauri-apps/api/event')
        await emit('idea-saved')

        setPillState('saved')
        scheduleHide(1500)

        // Background: export
        const exportEnabled = localStorage.getItem(STORAGE_KEYS.EXPORT_ENABLED) === 'true'
        const exportDir = localStorage.getItem(STORAGE_KEYS.EXPORT_DIR)
        if (exportEnabled && exportDir) {
          const fullIdea = await getIdea(idea.id)
          if (fullIdea) {
            exportIdea(fullIdea, exportDir).catch(console.error)
          }
        }
      } catch (saveError) {
        console.error('Failed to save idea from indicator:', saveError)
        setErrorMessage('Save failed')
        setPillState('error')
        scheduleHide(3000)
      }
    },
    [clearTimers, scheduleHide],
  )

  const handleError = useCallback(
    (message: string) => {
      clearTimers()
      setErrorMessage(message)
      setPillState('error')
      scheduleHide(3000)
    },
    [clearTimers, scheduleHide],
  )

  const {
    state: recordingState,
    stream,
    startRecording,
    stopRecording,
  } = useAudioRecording({
    onTranscriptionComplete: handleTranscriptionComplete,
    onError: handleError,
  })

  // Sync recording hook state to pill state
  useEffect(() => {
    if (recordingState === 'recording') {
      setPillState('recording')
    } else if (recordingState === 'transcribing') {
      setPillState('transcribing')
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [recordingState])

  // Elapsed timer during recording
  useEffect(() => {
    if (recordingState === 'recording') {
      setElapsedSeconds(0)
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1)
      }, 1000)
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }
    }
  }, [recordingState])

  // Initialize DB and theme
  useEffect(() => {
    document.documentElement.classList.add('capture-transparent')
    import('@tauri-apps/api/webview')
      .then(({ getCurrentWebview }) =>
        getCurrentWebview().setBackgroundColor({ red: 0, green: 0, blue: 0, alpha: 0 }),
      )
      .catch(() => {
        // Expected when not running in Tauri context (e.g. Vite dev server)
      })

    // Apply theme
    const theme = localStorage.getItem(STORAGE_KEYS.THEME) ?? 'system'
    if (
      theme === 'dark' ||
      (theme === 'system' && matchMedia('(prefers-color-scheme:dark)').matches)
    ) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    initDb()
      .then(() => {
        setDbReady(true)
        const savedSttModel = localStorage.getItem(STORAGE_KEYS.STT_MODEL)
        if (savedSttModel) {
          preloadWhisperModel(savedSttModel)
        }
      })
      .catch((error: unknown) => {
        console.error('Indicator DB init failed:', error)
      })

    return () => document.documentElement.classList.remove('capture-transparent')
  }, [])

  // Listen for start-recording / stop-recording events
  useEffect(() => {
    let unlistenStart: (() => void) | undefined
    let unlistenStop: (() => void) | undefined

    import('@tauri-apps/api/event')
      .then(({ listen }) => {
        listen('start-recording', () => {
          setErrorMessage(null)
          setPillState('recording')
          setElapsedSeconds(0)
          positionBottomRight()
            .then(() => startRecording())
            .catch((error) => {
              console.error('Failed to start recording:', error)
              handleError(error instanceof Error ? error.message : 'Could not access microphone')
            })
        }).then((fn) => {
          unlistenStart = fn
        })

        listen('stop-recording', () => {
          stopRecording()
        }).then((fn) => {
          unlistenStop = fn
        })
      })
      .catch(() => {
        // Expected when not running in Tauri context (e.g. Vite dev server)
      })

    return () => {
      unlistenStart?.()
      unlistenStop?.()
    }
  }, [startRecording, stopRecording, handleError])

  if (!dbReady) return null

  return (
    <RecordingPill
      state={pillState}
      stream={stream}
      elapsedSeconds={elapsedSeconds}
      error={errorMessage}
      shortcutLabel={shortcutLabel}
    />
  )
}
