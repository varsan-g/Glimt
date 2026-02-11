import { STORAGE_KEYS } from '@/lib/storage-keys'
import type { Update } from '@tauri-apps/plugin-updater'

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string; body: string | undefined }
  | { state: 'downloading'; progress: number }
  | { state: 'ready' }
  | { state: 'up-to-date' }
  | { state: 'error'; message: string }

const LAST_CHECK_KEY = STORAGE_KEYS.LAST_UPDATE_CHECK
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours

export function shouldCheckAutomatically(): boolean {
  const last = localStorage.getItem(LAST_CHECK_KEY)
  if (!last) return true
  const elapsed = Date.now() - Number(last)
  return elapsed >= CHECK_INTERVAL_MS
}

export function recordCheckTimestamp(): void {
  localStorage.setItem(LAST_CHECK_KEY, String(Date.now()))
}

export async function checkForUpdate(): Promise<Update | null> {
  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check()
  return update
}

export async function downloadAndInstall(
  update: Update,
  onProgress: (downloaded: number, total: number) => void,
): Promise<void> {
  let totalBytes = 0
  let downloadedBytes = 0

  await update.downloadAndInstall((event) => {
    if (event.event === 'Started') {
      totalBytes = event.data.contentLength ?? 0
      downloadedBytes = 0
    } else if (event.event === 'Progress') {
      downloadedBytes += event.data.chunkLength
      onProgress(downloadedBytes, totalBytes)
    }
  })
}

export async function restartApp(): Promise<void> {
  const { relaunch } = await import('@tauri-apps/plugin-process')
  await relaunch()
}
