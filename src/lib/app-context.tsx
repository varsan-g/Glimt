import { createContext, useContext, type ReactNode } from 'react'
import type { Theme } from '@/lib/hooks/use-theme'
import type { UpdateStatus } from '@/lib/updater'
import type { Idea } from '@/lib/types'

export interface AppContextValue {
  // Theme
  theme: Theme
  onThemeChange: (theme: Theme) => void

  // Ideas
  ideas: Idea[]
  showArchive: boolean
  archiveCount: number
  exportEnabled: boolean
  exportDir: string | null
  autoTitleEnabled: boolean
  loadIdeas: (archived?: boolean) => Promise<void>
  onSearch: (query: string) => Promise<void>
  onUpdate: (id: string, text: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onArchive: (id: string) => Promise<void>
  onToggleArchive: (archived: boolean) => Promise<void>
  onCapture: () => Promise<void>
  onRegenerateTitle: (id: string) => Promise<void>
  onExportEnabledChange: (enabled: boolean) => void
  onExportDirChange: (dir: string) => void
  onAutoTitleEnabledChange: (enabled: boolean) => void

  // Updates
  appVersion: string
  updateStatus: UpdateStatus
  onCheckUpdate: () => Promise<void>
  onInstallUpdate: () => Promise<void>
  onRestart: () => Promise<void>

  // Shortcuts
  captureShortcut: string
  onCaptureShortcutChange: (shortcut: string) => Promise<void>
  recordShortcut: string
  onRecordShortcutChange: (shortcut: string) => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ value, children }: { value: AppContextValue; children: ReactNode }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return ctx
}
