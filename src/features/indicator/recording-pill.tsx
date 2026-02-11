import { CompactVuMeter } from '@/components/compact-vu-meter'
import { formatTime } from '@/lib/utils'
import { RiCheckLine, RiLoader2Line } from '@remixicon/react'

type PillState = 'recording' | 'transcribing' | 'saved' | 'error'

interface RecordingPillProps {
  state: PillState
  stream: MediaStream | null
  elapsedSeconds: number
  error: string | null
  shortcutLabel: string
}

export function RecordingPill({
  state,
  stream,
  elapsedSeconds,
  error,
  shortcutLabel,
}: RecordingPillProps) {
  return (
    <div className={`glass-indicator ${state === 'recording' ? 'glass-indicator-recording' : ''}`}>
      {/* Specular highlight */}
      <div className="glass-indicator-highlight" />

      <div className="relative flex h-full items-center gap-2.5 px-4">
        {state === 'recording' && (
          <>
            <span className="glass-recording-dot" />
            {stream && <CompactVuMeter stream={stream} />}
            <span className="text-xs tabular-nums text-foreground/70">
              {formatTime(elapsedSeconds)}
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground/60">
              <kbd className="glass-indicator-kbd">{shortcutLabel}</kbd> stop
            </span>
          </>
        )}

        {state === 'transcribing' && (
          <>
            <RiLoader2Line className="size-3.5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Transcribing...</span>
          </>
        )}

        {state === 'saved' && (
          <>
            <RiCheckLine className="size-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Saved</span>
          </>
        )}

        {state === 'error' && (
          <span className="truncate text-xs text-red-500 dark:text-red-400">
            {error ?? 'Recording failed'}
          </span>
        )}
      </div>
    </div>
  )
}
