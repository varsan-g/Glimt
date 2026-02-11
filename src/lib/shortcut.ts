import { isRegistered, register, unregister } from '@tauri-apps/plugin-global-shortcut'
import { emitTo } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

import { STORAGE_KEYS } from '@/lib/storage-keys'

// ── Defaults & storage keys ───────────────────────────

export const DEFAULT_CAPTURE_SHORTCUT = 'Alt+I'
export const DEFAULT_RECORD_SHORTCUT = 'Alt+R'

const CAPTURE_STORAGE_KEY = STORAGE_KEYS.CAPTURE_SHORTCUT
const RECORD_STORAGE_KEY = STORAGE_KEYS.RECORD_SHORTCUT

// ── Module state ──────────────────────────────────────

let currentCaptureRegistered: string | null = null
let currentRecordRegistered: string | null = null

// ── Getters ───────────────────────────────────────────

export function getSavedCaptureShortcut(): string {
  return localStorage.getItem(CAPTURE_STORAGE_KEY) ?? DEFAULT_CAPTURE_SHORTCUT
}

export function getSavedRecordShortcut(): string {
  return localStorage.getItem(RECORD_STORAGE_KEY) ?? DEFAULT_RECORD_SHORTCUT
}

// ── Shortcut actions ──────────────────────────────────

async function toggleCaptureWindow(): Promise<void> {
  const captureWindow = await WebviewWindow.getByLabel('capture')
  if (!captureWindow) return

  const visible = await captureWindow.isVisible()
  if (visible) {
    await captureWindow.hide()
  } else {
    await captureWindow.show()
    await captureWindow.setFocus()
  }
}

let lastRecordToggle = 0

async function toggleIndicatorRecording(): Promise<void> {
  const now = Date.now()
  if (now - lastRecordToggle < 300) return
  lastRecordToggle = now

  const indicatorWindow = await WebviewWindow.getByLabel('indicator')
  if (!indicatorWindow) return

  const visible = await indicatorWindow.isVisible()
  if (visible) {
    await emitTo('indicator', 'stop-recording')
  } else {
    await indicatorWindow.show()
    await emitTo('indicator', 'start-recording')
  }
}

// ── Generic register/unregister ───────────────────────

async function safeUnregister(shortcut: string): Promise<void> {
  try {
    if (await isRegistered(shortcut)) {
      await unregister(shortcut)
    }
  } catch {
    // Best effort
  }
}

// ── Capture shortcut ──────────────────────────────────

export async function registerCaptureShortcut(shortcut?: string): Promise<void> {
  const target = shortcut ?? getSavedCaptureShortcut()

  if (currentCaptureRegistered && currentCaptureRegistered !== target) {
    await safeUnregister(currentCaptureRegistered)
    currentCaptureRegistered = null
  }

  await safeUnregister(target)
  await register(target, (event) => {
    if (event.state === 'Pressed') {
      toggleCaptureWindow().catch(console.error)
    }
  })
  currentCaptureRegistered = target
}

export async function changeCaptureShortcut(newShortcut: string): Promise<void> {
  const previous = currentCaptureRegistered ?? getSavedCaptureShortcut()

  try {
    await registerCaptureShortcut(newShortcut)
    localStorage.setItem(CAPTURE_STORAGE_KEY, newShortcut)
  } catch (error) {
    try {
      await registerCaptureShortcut(previous)
    } catch {
      // Failed to restore
    }
    throw error
  }
}

// ── Record shortcut ───────────────────────────────────

export async function registerRecordShortcut(shortcut?: string): Promise<void> {
  const target = shortcut ?? getSavedRecordShortcut()

  if (currentRecordRegistered && currentRecordRegistered !== target) {
    await safeUnregister(currentRecordRegistered)
    currentRecordRegistered = null
  }

  await safeUnregister(target)
  await register(target, (event) => {
    if (event.state === 'Pressed') {
      toggleIndicatorRecording().catch(console.error)
    }
  })
  currentRecordRegistered = target
}

export async function changeRecordShortcut(newShortcut: string): Promise<void> {
  const previous = currentRecordRegistered ?? getSavedRecordShortcut()

  try {
    await registerRecordShortcut(newShortcut)
    localStorage.setItem(RECORD_STORAGE_KEY, newShortcut)
  } catch (error) {
    try {
      await registerRecordShortcut(previous)
    } catch {
      // Failed to restore
    }
    throw error
  }
}

// ── Parsing utilities ─────────────────────────────────

export function parseShortcutKeys(shortcut: string): string[] {
  return shortcut.split('+').map((key) => {
    if (key === 'CommandOrControl') return 'Ctrl'
    return key
  })
}

const CODE_TO_KEY: Record<string, string> = {
  ...Object.fromEntries(
    Array.from({ length: 26 }, (_, i) => {
      const letter = String.fromCharCode(65 + i)
      return [`Key${letter}`, letter]
    }),
  ),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`Digit${i}`, String(i)])),
  ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`F${i + 1}`, `F${i + 1}`])),
  Space: 'Space',
  Enter: 'Enter',
  Backspace: 'Backspace',
  Tab: 'Tab',
  Escape: 'Escape',
  Delete: 'Delete',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Backslash: '\\',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Minus: '-',
  Equal: '=',
}

export function keyEventToShortcut(e: KeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    return null
  }

  const key = CODE_TO_KEY[e.code]
  if (!key) return null

  if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
    return null
  }

  const isAlphanumeric = /^(Key[A-Z]|Digit\d)$/.test(e.code)
  if (isAlphanumeric && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
    return null
  }

  const parts: string[] = []
  if (e.ctrlKey) parts.push('Control')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Super')
  parts.push(key)

  return parts.join('+')
}
