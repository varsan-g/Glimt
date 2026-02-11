// Error handling conventions:
// - User-triggered actions: toast.error() for user feedback + console.error() for debugging
// - Background operations (embedding, export): console.error() only
// - Startup/init: surface to UI state (e.g. dbError renders an error page)
// - Tauri context checks: empty catch with comment (expected in Vite dev server)

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/components/error-boundary'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Dashboard } from '@/features/dashboard/dashboard'
import { Settings } from '@/features/settings/settings'
import { AppProvider, type AppContextValue } from '@/lib/app-context'
import { useAutoUpdate } from '@/lib/hooks/use-auto-update'
import { useDatabase } from '@/lib/hooks/use-database'
import { useIdeaActions } from '@/lib/hooks/use-idea-actions'
import { useModelNotifications } from '@/lib/hooks/use-model-notifications'
import { useTheme } from '@/lib/hooks/use-theme'
import {
  changeCaptureShortcut,
  changeRecordShortcut,
  getSavedCaptureShortcut,
  getSavedRecordShortcut,
  parseShortcutKeys,
  registerCaptureShortcut,
  registerRecordShortcut,
} from '@/lib/shortcut'
import {
  RiAddLine,
  RiArchiveLine,
  RiDashboardLine,
  RiMoonLine,
  RiSettings3Line,
  RiSunLine,
} from '@remixicon/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

type View = 'dashboard' | 'settings'

export function App() {
  const [view, setView] = useState<View>('dashboard')
  const [commandOpen, setCommandOpen] = useState(false)
  const [captureShortcut, setCaptureShortcut] = useState(getSavedCaptureShortcut)
  const [recordShortcut, setRecordShortcut] = useState(getSavedRecordShortcut)

  const { dbReady, dbError } = useDatabase()
  const { theme, onThemeChange } = useTheme()
  useModelNotifications()
  const autoUpdate = useAutoUpdate()
  const ideaActions = useIdeaActions()

  // Load ideas once DB is ready
  useEffect(() => {
    if (dbReady) {
      ideaActions.loadIdeas()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadIdeas is stable, only run when DB becomes ready
  }, [dbReady])

  // Register global shortcuts
  useEffect(() => {
    registerCaptureShortcut().catch(console.error)
    registerRecordShortcut().catch(console.error)
  }, [])

  // Command palette keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleCaptureShortcutChange = useCallback(async (newShortcut: string) => {
    try {
      await changeCaptureShortcut(newShortcut)
      setCaptureShortcut(newShortcut)
      const keys = parseShortcutKeys(newShortcut).join('+')
      toast.success(`Capture shortcut changed to ${keys}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to set shortcut: ${message}`)
    }
  }, [])

  const handleRecordShortcutChange = useCallback(async (newShortcut: string) => {
    try {
      await changeRecordShortcut(newShortcut)
      setRecordShortcut(newShortcut)
      const keys = parseShortcutKeys(newShortcut).join('+')
      toast.success(`Record shortcut changed to ${keys}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to set shortcut: ${message}`)
    }
  }, [])

  const contextValue = useMemo<AppContextValue>(
    () => ({
      theme,
      onThemeChange,
      ...ideaActions,
      ...autoUpdate,
      captureShortcut,
      onCaptureShortcutChange: handleCaptureShortcutChange,
      recordShortcut,
      onRecordShortcutChange: handleRecordShortcutChange,
    }),
    [
      theme,
      onThemeChange,
      ideaActions,
      autoUpdate,
      captureShortcut,
      handleCaptureShortcutChange,
      recordShortcut,
      handleRecordShortcutChange,
    ],
  )

  if (dbError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-8">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold text-foreground">Failed to initialize database</h1>
          <p className="text-sm text-muted-foreground">{dbError}</p>
          <p className="text-xs text-muted-foreground">
            This usually means the app is not running inside Tauri. Try running with: bun run tauri
            dev
          </p>
        </div>
      </div>
    )
  }

  if (!dbReady) {
    return (
      <div className="flex h-screen flex-col bg-background">
        {/* Skeleton header */}
        <div className="border-b px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="skeleton h-5 w-24" />
            <div className="skeleton h-9 flex-1" />
            <div className="flex gap-1.5">
              <div className="skeleton h-8 w-20 rounded-md" />
              <div className="skeleton size-8 rounded-md" />
            </div>
          </div>
        </div>
        {/* Skeleton cards */}
        <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
          <div className="skeleton h-3 w-32" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3 rounded-lg border border-border p-4">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
              <div className="flex justify-between">
                <div className="skeleton h-3 w-28" />
                <div className="flex gap-2">
                  <div className="skeleton h-6 w-16 rounded-md" />
                  <div className="skeleton h-6 w-14 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  let content: React.ReactNode
  switch (view) {
    case 'dashboard':
      content = (
        <ErrorBoundary>
          <Dashboard onSettings={() => setView('settings')} />
        </ErrorBoundary>
      )
      break
    case 'settings':
      content = (
        <ErrorBoundary>
          <Settings onBack={() => setView('dashboard')} />
        </ErrorBoundary>
      )
      break
  }

  return (
    <AppProvider value={contextValue}>
      <TooltipProvider delayDuration={300}>
        <div key={view} className="view-enter">
          {content}
        </div>
        <Toaster position="bottom-right" richColors />
        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              <CommandItem
                onSelect={() => {
                  setView('dashboard')
                  setCommandOpen(false)
                }}
              >
                <RiDashboardLine className="size-4" />
                Dashboard
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setView('settings')
                  setCommandOpen(false)
                }}
              >
                <RiSettings3Line className="size-4" />
                Settings
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setView('dashboard')
                  ideaActions.onToggleArchive(!ideaActions.showArchive)
                  setCommandOpen(false)
                }}
              >
                <RiArchiveLine className="size-4" />
                {ideaActions.showArchive ? 'Show Ideas' : 'Show Archive'}
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => {
                  ideaActions.onCapture()
                  setCommandOpen(false)
                }}
              >
                <RiAddLine className="size-4" />
                New Idea
                <CommandShortcut>{parseShortcutKeys(captureShortcut).join('+')}</CommandShortcut>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  const next = theme === 'dark' ? 'light' : 'dark'
                  onThemeChange(next)
                  setCommandOpen(false)
                }}
              >
                {theme === 'dark' ? (
                  <RiSunLine className="size-4" />
                ) : (
                  <RiMoonLine className="size-4" />
                )}
                Toggle Dark Mode
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </TooltipProvider>
    </AppProvider>
  )
}
