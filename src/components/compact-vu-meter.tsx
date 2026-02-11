import { useEffect, useRef } from 'react'

export function CompactVuMeter({ stream }: { stream: MediaStream }) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const levelRef = useRef(0)

  useEffect(() => {
    let audioCtx: AudioContext | null = null
    let animId: number | null = null

    try {
      audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 32
      analyser.smoothingTimeConstant = 0.5
      source.connect(analyser)

      const data = new Uint8Array(analyser.frequencyBinCount)

      function tick() {
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          sum += data[i] ?? 0
        }
        levelRef.current = sum / data.length / 255
        if (canvasRef.current) {
          canvasRef.current.style.width = `${Math.max(4, levelRef.current * 64)}px`
        }
        animId = requestAnimationFrame(tick)
      }

      tick()

      return () => {
        if (animId !== null) cancelAnimationFrame(animId)
        source.disconnect()
        audioCtx?.close()
      }
    } catch {
      return () => {
        if (animId !== null) cancelAnimationFrame(animId)
        audioCtx?.close()
      }
    }
  }, [stream])

  return (
    <div className="h-1.5 w-16 rounded-full bg-red-500/10">
      <div
        ref={canvasRef}
        className="h-1.5 rounded-full bg-red-500 transition-[width] duration-75 dark:bg-red-400"
        style={{ width: '4px' }}
      />
    </div>
  )
}
