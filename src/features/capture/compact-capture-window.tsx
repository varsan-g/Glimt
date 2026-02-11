import type { SaveState } from '@/capture-app'
import { CompactVuMeter } from '@/components/compact-vu-meter'
import {
  MarkdownEditor,
  type EditorUpdateInfo,
  type MarkdownEditorHandle,
} from '@/components/markdown-editor'
import { ensureWhisperModel, whisperLifecycle } from '@/lib/ai/whisper'
import { useModelLifecycle } from '@/lib/hooks/use-model-lifecycle'
import { getIdea } from '@/lib/db'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import { useAudioRecording } from '@/lib/use-audio-recording'
import {
  RiArrowRightLine,
  RiCheckLine,
  RiEditLine,
  RiLoader2Line,
  RiMicLine,
  RiStopFill,
} from '@remixicon/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const PLACEHOLDERS = [
  'Capture an idea...',
  'Quick thought...',
  'Note to self...',
  'What if...',
  'Something to remember...',
  'Before I forget...',
]

const MD_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /^# /m, message: 'Heading formatting active' },
  { pattern: /^[-*] /m, message: 'List formatting active' },
  { pattern: /\*\*.+\*\*/, message: 'Bold formatting active' },
  { pattern: /`.+`/, message: 'Code formatting active' },
]

interface CompactCaptureWindowProps {
  onSave: (text: string) => void
  onEdit: (id: string, text: string) => void
  onClose: () => void
  onRecordingChange: (recording: boolean) => void
  onDragStart: () => void
  saveState: SaveState
  autoRecord?: boolean
}

export function CompactCaptureWindow({
  onSave,
  onEdit,
  onClose,
  onRecordingChange,
  onDragStart,
  saveState,
  autoRecord,
}: CompactCaptureWindowProps) {
  const [wordCount, setWordCount] = useState(0)
  const [hasContent, setHasContent] = useState(false)
  const [mdHint, setMdHint] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [lastIdea, setLastIdea] = useState<{ id: string; preview: string } | null>(null)
  const stt = useModelLifecycle(whisperLifecycle)

  const editorRef = useRef<MarkdownEditorHandle>(null)
  const saveAfterTranscriptionRef = useRef(false)
  const mdHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTranscriptionComplete = useCallback(
    (text: string) => {
      if (text) {
        editorRef.current?.insertText(text)
      }
      if (saveAfterTranscriptionRef.current) {
        saveAfterTranscriptionRef.current = false
        const markdown = editorRef.current?.getMarkdown().trim()
        if (markdown) {
          onSave(markdown)
        }
      } else {
        editorRef.current?.focus()
      }
    },
    [onSave],
  )

  const {
    state: recordingState,
    stream,
    error: recordingError,
    startRecording,
    stopRecording,
  } = useAudioRecording({
    onTranscriptionComplete: handleTranscriptionComplete,
    onRecordingChange,
  })

  // Rotating placeholder — re-randomized on each mount (editorKey changes)
  const placeholder = useMemo(
    () => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)],
    [],
  )

  // Only show Conditional hints for the first 5 captures
  const showHints = useMemo(() => {
    const count = parseInt(localStorage.getItem(STORAGE_KEYS.CAPTURE_COUNT) ?? '0', 10)
    return count < 5
  }, [])

  // Load last idea info on mount
  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEYS.LAST_IDEA_ID)
    const preview = localStorage.getItem(STORAGE_KEYS.LAST_IDEA_PREVIEW)
    if (id && preview) {
      setLastIdea({ id, preview })
    }
  }, [])

  // Markdown discovery tooltip
  const checkMarkdownPattern = useCallback((text: string) => {
    const hintCount = parseInt(localStorage.getItem(STORAGE_KEYS.MD_HINT_SHOWN) ?? '0', 10)
    if (hintCount >= 3) return

    for (const { pattern, message } of MD_PATTERNS) {
      if (pattern.test(text)) {
        setMdHint(message)
        localStorage.setItem(STORAGE_KEYS.MD_HINT_SHOWN, String(hintCount + 1))
        if (mdHintTimerRef.current) clearTimeout(mdHintTimerRef.current)
        mdHintTimerRef.current = setTimeout(() => setMdHint(null), 2000)
        return
      }
    }
  }, [])

  // Editor update handler
  const handleEditorUpdate = useCallback(
    (info: EditorUpdateInfo) => {
      const words = info.text.trim().split(/\s+/).filter(Boolean).length
      setWordCount(words)
      setHasContent(!info.isEmpty)

      // Clear ghost row when user starts typing (unless editing)
      if (!info.isEmpty && !editingId) {
        setLastIdea(null)
      }

      // Check for markdown patterns
      checkMarkdownPattern(info.text)
    },
    [editingId, checkMarkdownPattern],
  )

  function handleSave() {
    if (recordingState === 'recording') {
      saveAfterTranscriptionRef.current = true
      stopRecording()
      return
    }
    const markdown = editorRef.current?.getMarkdown().trim()
    if (markdown) {
      if (editingId) {
        onEdit(editingId, markdown)
      } else {
        onSave(markdown)
      }
    }
  }

  function handleMicClick() {
    if (recordingState === 'recording') {
      stopRecording()
    } else if (recordingState === 'idle') {
      ensureWhisperModel()
      void startRecording()
    }
  }

  // Auto-start recording when triggered by quick record shortcut
  const autoRecordFired = useRef(false)
  useEffect(() => {
    if (autoRecord && !autoRecordFired.current) {
      autoRecordFired.current = true
      ensureWhisperModel()
      void startRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount when autoRecord is set
  }, [autoRecord])

  // Load last idea into editor
  async function handleEditLast() {
    if (!lastIdea) return
    try {
      const idea = await getIdea(lastIdea.id)
      if (idea) {
        editorRef.current?.insertText(idea.text)
        setEditingId(idea.id)
        setLastIdea(null)
      }
    } catch (error) {
      console.error('Failed to load idea for editing:', error)
    }
  }

  function handleContainerClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (target.closest('button, [contenteditable], input, textarea, a')) return
    editorRef.current?.focus()
  }

  function handleDragHandleMouseDown() {
    onDragStart()
    import('@tauri-apps/api/webviewWindow').then(({ getCurrentWebviewWindow }) =>
      getCurrentWebviewWindow().startDragging(),
    )
  }

  return (
    <div className="glass-capture flex h-screen flex-col px-5 pb-4" onClick={handleContainerClick}>
      {/* Drag handle */}
      <div
        onMouseDown={handleDragHandleMouseDown}
        className="flex shrink-0 cursor-grab items-center justify-center py-2"
      >
        <div className="pointer-events-none h-1 w-8 rounded-full bg-foreground/15" />
      </div>

      {/* Specular highlight edge */}
      <div className="glass-capture-highlight" />

      {saveState === 'saved' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <RiCheckLine className="size-5" />
            <span>Saved</span>
          </div>
        </div>
      )}

      {!hasContent &&
        !editingId &&
        lastIdea &&
        recordingState === 'idle' &&
        saveState === 'idle' && (
          <button
            type="button"
            onClick={() => void handleEditLast()}
            className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50"
          >
            <RiEditLine className="size-3.5" />
            <span className="truncate">{lastIdea.preview}</span>
            <kbd className="ml-auto flex-shrink-0 opacity-40">↑</kbd>
          </button>
        )}

      {/* Editor area — full width (mic moved to status bar) */}
      <div className="relative min-h-0 flex-1 overflow-y-auto pt-1">
        <div className="flex-1 min-w-0">
          <MarkdownEditor
            ref={editorRef}
            placeholder={placeholder}
            className="glass-editor"
            compact
            disabled={recordingState === 'transcribing'}
            onSave={handleSave}
            onCancel={onClose}
            onUpdate={handleEditorUpdate}
            onArrowUpEmpty={lastIdea && !editingId ? () => void handleEditLast() : undefined}
          />
        </div>
      </div>

      {mdHint && <p className="pt-1 text-[10px] text-muted-foreground/60">{mdHint}</p>}

      {/* Status bar */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex flex-1 items-center gap-2">
          <button
            type="button"
            onClick={handleMicClick}
            disabled={recordingState === 'transcribing'}
            className="glass-mic-btn-sm flex-shrink-0"
            aria-label={
              recordingState === 'recording'
                ? 'Stop recording'
                : recordingState === 'transcribing'
                  ? 'Transcribing audio'
                  : 'Start recording'
            }
          >
            {recordingState === 'recording' && <RiStopFill className="size-3.5" />}
            {recordingState === 'transcribing' && (
              <RiLoader2Line className="size-3.5 animate-spin" />
            )}
            {recordingState === 'idle' && <RiMicLine className="size-3.5" />}
          </button>

          {/* VU meter during recording */}
          {recordingState === 'recording' && stream && (
            <div className="flex items-center gap-2 text-xs">
              <span className="glass-recording-dot" />
              <CompactVuMeter stream={stream} />
            </div>
          )}

          {recordingState === 'transcribing' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RiLoader2Line className="size-3 animate-spin" />
              <span>Transcribing...</span>
            </div>
          )}

          {stt.state === 'loading' && recordingState === 'idle' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RiLoader2Line className="size-3 animate-spin" />
              <span>Downloading voice model... {Math.round(stt.progress)}%</span>
            </div>
          )}

          {recordingError && (
            <p className="text-xs text-red-500 dark:text-red-400">{recordingError}</p>
          )}

          {recordingState === 'idle' && hasContent && !recordingError && (
            <span className="glass-hint-text">
              {wordCount} {wordCount === 1 ? 'word' : 'words'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Conditional hint text */}
          {showHints && (
            <p className="glass-hint-text">
              <kbd>Esc</kbd> close
            </p>
          )}

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={
              recordingState === 'transcribing' || (!hasContent && recordingState === 'idle')
            }
            className="glass-save-btn"
          >
            Save
            <RiArrowRightLine className="size-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
