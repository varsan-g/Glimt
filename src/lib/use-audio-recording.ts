import { transcribeAudio } from '@/lib/ai/whisper'
import { useCallback, useEffect, useRef, useState } from 'react'

type RecordingState = 'idle' | 'recording' | 'transcribing'

interface UseAudioRecordingOptions {
  onTranscriptionComplete: (text: string) => void
  onRecordingChange?: (recording: boolean) => void
  onError?: (error: string) => void
}

interface UseAudioRecordingReturn {
  state: RecordingState
  stream: MediaStream | null
  error: string | null
  startRecording: () => Promise<void>
  stopRecording: () => void
}

export function useAudioRecording(options: UseAudioRecordingOptions): UseAudioRecordingReturn {
  const [state, setState] = useState<RecordingState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setStream(mediaStream)
      const mediaRecorder = new MediaRecorder(mediaStream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        for (const track of mediaStream.getTracks()) {
          track.stop()
        }
        setStream(null)
        optionsRef.current.onRecordingChange?.(false)

        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType })
        chunksRef.current = []

        if (blob.size === 0) {
          setState('idle')
          return
        }

        setState('transcribing')
        try {
          const transcribedText = await transcribeAudio(blob)
          const trimmed = transcribedText.trim()
          setState('idle')
          optionsRef.current.onTranscriptionComplete(trimmed)
        } catch (transcriptionError) {
          const message =
            transcriptionError instanceof Error
              ? transcriptionError.message
              : 'Transcription failed'
          setError(message)
          setState('idle')
          optionsRef.current.onError?.(message)
        }
      }

      mediaRecorder.start()
      setState('recording')
      optionsRef.current.onRecordingChange?.(true)
    } catch (micError) {
      const message = micError instanceof Error ? micError.message : 'Could not access microphone'
      setError(message)
      setState('idle')
      optionsRef.current.onError?.(message)
    }
  }, [])

  return { state, stream, error, startRecording, stopRecording }
}
