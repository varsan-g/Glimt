import type { UpdateStatus } from '@/lib/updater'
import {
  checkForUpdate,
  downloadAndInstall,
  recordCheckTimestamp,
  restartApp,
  shouldCheckAutomatically,
} from '@/lib/updater'
import type { Update } from '@tauri-apps/plugin-updater'
import { useCallback, useEffect, useState } from 'react'

export function useAutoUpdate() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: 'idle' })
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null)
  const [appVersion, setAppVersion] = useState('0.1.0')

  // Fetch app version
  useEffect(() => {
    import('@tauri-apps/api/app')
      .then(({ getVersion }) => getVersion())
      .then((version) => setAppVersion(version))
      .catch(() => {
        // Not running in Tauri context
      })
  }, [])

  // Automatic update check
  useEffect(() => {
    if (!shouldCheckAutomatically()) return
    checkForUpdate()
      .then((update) => {
        if (update) {
          setPendingUpdate(update)
          setUpdateStatus({
            state: 'available',
            version: update.version,
            body: update.body ?? undefined,
          })
        } else {
          setUpdateStatus({ state: 'up-to-date' })
        }
        recordCheckTimestamp()
      })
      .catch(() => {
        // Silent failure on automatic check
      })
  }, [])

  const handleCheckUpdate = useCallback(async () => {
    setUpdateStatus({ state: 'checking' })
    try {
      const update = await checkForUpdate()
      recordCheckTimestamp()
      if (update) {
        setPendingUpdate(update)
        setUpdateStatus({
          state: 'available',
          version: update.version,
          body: update.body ?? undefined,
        })
      } else {
        setUpdateStatus({ state: 'up-to-date' })
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      setUpdateStatus({ state: 'error', message })
    }
  }, [])

  const handleInstallUpdate = useCallback(async () => {
    if (!pendingUpdate) return
    setUpdateStatus({ state: 'downloading', progress: 0 })
    try {
      await downloadAndInstall(pendingUpdate, (downloaded, total) => {
        const progress = total > 0 ? (downloaded / total) * 100 : 0
        setUpdateStatus({ state: 'downloading', progress })
      })
      setUpdateStatus({ state: 'ready' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      setUpdateStatus({ state: 'error', message })
    }
  }, [pendingUpdate])

  const handleRestart = useCallback(async () => {
    try {
      await restartApp()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      setUpdateStatus({ state: 'error', message })
    }
  }, [])

  return {
    appVersion,
    updateStatus,
    onCheckUpdate: handleCheckUpdate,
    onInstallUpdate: handleInstallUpdate,
    onRestart: handleRestart,
  }
}
