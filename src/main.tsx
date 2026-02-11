import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

async function mount() {
  const rootEl = document.getElementById('root')
  if (!rootEl) return

  const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const label = getCurrentWebviewWindow().label

  if (label === 'capture') {
    const { CaptureApp } = await import('./capture-app')
    createRoot(rootEl).render(
      <StrictMode>
        <CaptureApp />
      </StrictMode>,
    )
  } else if (label === 'indicator') {
    const { IndicatorApp } = await import('./indicator-app')
    createRoot(rootEl).render(
      <StrictMode>
        <IndicatorApp />
      </StrictMode>,
    )
  } else {
    const { App } = await import('./app')
    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  }
}

mount()
