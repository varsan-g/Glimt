import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart'
import { open } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { useAppContext } from '@/lib/app-context'
import { embeddingLifecycle, reembedAllIdeas } from '@/lib/ai/embeddings'
import { toast } from 'sonner'
import { titleLifecycle } from '@/lib/ai/title-generation'
import { whisperLifecycle } from '@/lib/ai/whisper'
import { useModelLifecycle } from '@/lib/hooks/use-model-lifecycle'
import { ModelManager } from '@/features/settings/model-manager'
import { UpdateChecker } from '@/features/settings/update-checker'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import { keyEventToShortcut, parseShortcutKeys } from '@/lib/shortcut'
import {
  RiArrowDownSLine,
  RiArrowLeftLine,
  RiBrainLine,
  RiCheckLine,
  RiComputerLine,
  RiInformationLine,
  RiKeyboardLine,
  RiLoader2Line,
  RiMagicLine,
  RiMarkdownLine,
  RiMoonLine,
  RiPaletteLine,
  RiPlayLine,
  RiSettings4Line,
  RiSunLine,
} from '@remixicon/react'

type Theme = 'light' | 'dark' | 'system'

interface SettingsProps {
  onBack: () => void
}

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof RiSunLine }[] = [
  { value: 'light', label: 'Light', icon: RiSunLine },
  { value: 'dark', label: 'Dark', icon: RiMoonLine },
  { value: 'system', label: 'System', icon: RiComputerLine },
]

export function Settings({ onBack }: SettingsProps) {
  const {
    exportEnabled,
    exportDir,
    onExportEnabledChange,
    onExportDirChange,
    appVersion,
    updateStatus,
    onCheckUpdate,
    onInstallUpdate,
    onRestart,
    theme,
    onThemeChange,
    captureShortcut,
    onCaptureShortcutChange,
    recordShortcut,
    onRecordShortcutChange,
    autoTitleEnabled,
    onAutoTitleEnabledChange,
  } = useAppContext()

  const [autostartEnabled, setAutostartEnabled] = useState(false)
  const [activeRecorder, setActiveRecorder] = useState<'capture' | 'record' | null>(null)
  const [heldKeys, setHeldKeys] = useState<string[]>([])
  const recorderRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    isEnabled()
      .then(setAutostartEnabled)
      .catch((err) => console.error('[Settings] Failed to read autostart state:', err))
  }, [])

  const handleAutostartChange = useCallback(async (checked: boolean) => {
    try {
      if (checked) {
        await enable()
      } else {
        await disable()
      }
      setAutostartEnabled(await isEnabled())
    } catch (err) {
      console.error('[Settings] Failed to toggle autostart:', err)
    }
  }, [])

  const openRecorder = useCallback((type: 'capture' | 'record') => {
    setActiveRecorder(type)
    setHeldKeys([])
    requestAnimationFrame(() => recorderRef.current?.focus())
  }, [])

  const handleRecorderKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        setActiveRecorder(null)
        setHeldKeys([])
        return
      }

      // Build live preview of held modifiers + key
      const parts: string[] = []
      if (e.ctrlKey) parts.push('Ctrl')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')
      if (e.metaKey) parts.push('Super')

      // Show modifier-only state while holding
      const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)
      if (isModifier) {
        setHeldKeys(parts)
        return
      }

      // Full combo — commit it
      const shortcut = keyEventToShortcut(e.nativeEvent)
      if (shortcut) {
        setHeldKeys(parseShortcutKeys(shortcut))
        const handler =
          activeRecorder === 'capture' ? onCaptureShortcutChange : onRecordShortcutChange
        // Brief flash of the full combo before closing
        setTimeout(() => {
          setActiveRecorder(null)
          setHeldKeys([])
          handler(shortcut)
        }, 150)
      }
    },
    [activeRecorder, onCaptureShortcutChange, onRecordShortcutChange],
  )

  const handleRecorderKeyUp = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    e.preventDefault()
    // Update held modifiers on key release
    const parts: string[] = []
    if (e.ctrlKey) parts.push('Ctrl')
    if (e.altKey) parts.push('Alt')
    if (e.shiftKey) parts.push('Shift')
    if (e.metaKey) parts.push('Super')
    setHeldKeys(parts)
  }, [])

  const handleRecorderBlur = useCallback(() => {
    setActiveRecorder(null)
    setHeldKeys([])
  }, [])

  async function handleSelectFolder() {
    const selected = await open({
      directory: true,
      recursive: true,
      title: 'Select Obsidian export folder',
    })
    if (selected) {
      onExportDirChange(selected as string)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="border-b p-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <RiArrowLeftLine className="size-4" />
            Back
          </Button>
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-2xl p-4">
          <div className="space-y-8">
            {/* Keyboard Shortcuts */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <RiKeyboardLine className="size-5 text-primary" />
                <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
              </div>

              <div className="space-y-3">
                {/* Quick Capture */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">Quick Capture</p>
                    <p className="text-xs text-muted-foreground">Open the capture window</p>
                  </div>
                  {activeRecorder === 'capture' ? (
                    <button
                      ref={recorderRef}
                      onKeyDown={handleRecorderKeyDown}
                      onKeyUp={handleRecorderKeyUp}
                      onBlur={handleRecorderBlur}
                      aria-live="polite"
                      className="shortcut-recorder-recording flex items-center gap-1 rounded-lg border-2 px-3 py-2 outline-none"
                    >
                      {heldKeys.length > 0 ? (
                        heldKeys.map((key, i) => (
                          <span key={i}>
                            {i > 0 && (
                              <span className="mx-0.5 text-xs text-muted-foreground">+</span>
                            )}
                            <kbd className="shortcut-key">{key}</kbd>
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Press keys...</span>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => openRecorder('capture')}
                      className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 transition-colors hover:border-muted-foreground/30"
                    >
                      {parseShortcutKeys(captureShortcut).map((key, i) => (
                        <span key={i}>
                          {i > 0 && <span className="mx-0.5 text-xs text-muted-foreground">+</span>}
                          <kbd className="shortcut-key">{key}</kbd>
                        </span>
                      ))}
                    </button>
                  )}
                </div>

                {/* Quick Record */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">Quick Record</p>
                    <p className="text-xs text-muted-foreground">
                      Open capture and start voice recording
                    </p>
                  </div>
                  {activeRecorder === 'record' ? (
                    <button
                      ref={recorderRef}
                      onKeyDown={handleRecorderKeyDown}
                      onKeyUp={handleRecorderKeyUp}
                      onBlur={handleRecorderBlur}
                      aria-live="polite"
                      className="shortcut-recorder-recording flex items-center gap-1 rounded-lg border-2 px-3 py-2 outline-none"
                    >
                      {heldKeys.length > 0 ? (
                        heldKeys.map((key, i) => (
                          <span key={i}>
                            {i > 0 && (
                              <span className="mx-0.5 text-xs text-muted-foreground">+</span>
                            )}
                            <kbd className="shortcut-key">{key}</kbd>
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Press keys...</span>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => openRecorder('record')}
                      className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 transition-colors hover:border-muted-foreground/30"
                    >
                      {parseShortcutKeys(recordShortcut).map((key, i) => (
                        <span key={i}>
                          {i > 0 && <span className="mx-0.5 text-xs text-muted-foreground">+</span>}
                          <kbd className="shortcut-key">{key}</kbd>
                        </span>
                      ))}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <hr className="border-border" />

            {/* Autostart */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <RiPlayLine className="size-5 text-primary" />
                <h3 className="text-lg font-semibold">Launch at Startup</h3>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="autostart-toggle"
                  checked={autostartEnabled}
                  onCheckedChange={handleAutostartChange}
                />
                <Label htmlFor="autostart-toggle">Start Glimt when you log in</Label>
              </div>

              <p className="text-sm text-muted-foreground">
                {autostartEnabled
                  ? 'Glimt will launch automatically at login so the global hotkey is always available.'
                  : 'Enable to have Glimt start in the background when you log in.'}
              </p>
            </div>

            <hr className="border-border" />

            {/* AI Status */}
            <AiStatusSection />

            <hr className="border-border" />

            {/* Auto Title */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <RiMagicLine className="size-5 text-primary" />
                <h3 className="text-lg font-semibold">Auto Title</h3>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="auto-title-toggle"
                  checked={autoTitleEnabled}
                  onCheckedChange={onAutoTitleEnabledChange}
                />
                <Label htmlFor="auto-title-toggle">Auto-generate titles for new ideas</Label>
              </div>

              <p className="text-sm text-muted-foreground">
                {autoTitleEnabled
                  ? 'Titles will be generated in the background after each capture using SmolLM2. The model will download automatically when needed (~250MB).'
                  : 'When enabled, a short descriptive title is generated for each new idea using on-device AI.'}
              </p>
            </div>

            <hr className="border-border" />

            {/* Obsidian Export */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <RiMarkdownLine className="size-5 text-primary" />
                <h3 className="text-lg font-semibold">Obsidian Export</h3>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="export-toggle"
                  checked={exportEnabled}
                  onCheckedChange={onExportEnabledChange}
                />
                <Label htmlFor="export-toggle">Enable Obsidian export</Label>
              </div>

              {exportEnabled && (
                <div className="space-y-2 pl-1">
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={handleSelectFolder}>
                      Select folder
                    </Button>
                    {exportDir && (
                      <span className="truncate text-sm text-muted-foreground">{exportDir}</span>
                    )}
                  </div>
                  {!exportDir && (
                    <p className="text-sm text-muted-foreground">
                      Choose a folder where ideas will be exported as Markdown files.
                    </p>
                  )}
                </div>
              )}
            </div>

            <hr className="border-border" />

            {/* Appearance */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <RiPaletteLine className="size-5 text-primary" />
                <h3 className="text-lg font-semibold">Appearance</h3>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => onThemeChange(value)}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
                      theme === value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <Icon
                      className={`size-5 ${theme === value ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                    <span
                      className={`text-sm font-medium ${theme === value ? 'text-primary' : 'text-foreground'}`}
                    >
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-border" />

            {/* Model Management (collapsible) */}
            <CollapsibleModelManagement />

            <hr className="border-border" />

            {/* Updates */}
            <UpdateChecker
              appVersion={appVersion}
              status={updateStatus}
              onCheck={onCheckUpdate}
              onInstall={onInstallUpdate}
              onRestart={onRestart}
            />

            <hr className="border-border" />

            {/* About */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <RiInformationLine className="size-5 text-primary" />
                <h3 className="text-lg font-semibold">About</h3>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Glimt v{appVersion}</p>
                <p>Local-first idea capture app</p>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

function CollapsibleModelManagement() {
  const [open, setOpen] = useState(
    () => localStorage.getItem(STORAGE_KEYS.ADVANCED_OPEN) === 'true',
  )

  const handleOpenChange = useCallback((value: boolean) => {
    setOpen(value)
    localStorage.setItem(STORAGE_KEYS.ADVANCED_OPEN, String(value))
  }, [])

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 py-1 text-left">
        <RiSettings4Line className="size-5 text-primary" />
        <h3 className="text-lg font-semibold">Model Management</h3>
        <RiArrowDownSLine
          className={`ml-auto size-5 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-4">
          <ModelManager />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function AiStatusSection() {
  const embedding = useModelLifecycle(embeddingLifecycle)
  const stt = useModelLifecycle(whisperLifecycle)
  const title = useModelLifecycle(titleLifecycle)
  const [reembedding, setReembedding] = useState(false)

  const handleReembed = useCallback(async () => {
    setReembedding(true)
    try {
      const { total, failed } = await reembedAllIdeas()
      const msg =
        failed > 0 ? `Re-embedded ${total - failed}/${total} ideas` : `Re-embedded ${total} ideas`
      toast.success(msg)
    } catch (error) {
      console.error('Re-embed failed:', error)
      toast.error('Failed to rebuild embeddings')
    } finally {
      setReembedding(false)
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <RiBrainLine className="size-5 text-primary" />
        <h3 className="text-lg font-semibold">AI Status</h3>
      </div>

      <div className="space-y-2 text-sm">
        {/* Semantic search — always shown */}
        <div className="flex items-center gap-2">
          {embedding.state === 'ready' ? (
            <>
              <RiCheckLine className="size-4 text-green-500" />
              <span className="text-green-600 dark:text-green-400">Semantic search active</span>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-7 text-xs"
                disabled={reembedding}
                onClick={handleReembed}
              >
                {reembedding ? (
                  <>
                    <RiLoader2Line className="size-3 animate-spin" />
                    Rebuilding...
                  </>
                ) : (
                  'Rebuild Embeddings'
                )}
              </Button>
            </>
          ) : embedding.state === 'loading' ? (
            <>
              <RiLoader2Line className="size-4 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">
                Semantic search downloading... {Math.round(embedding.progress)}%
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Semantic search not loaded</span>
          )}
        </div>

        {/* Voice — only shown if loaded or loading */}
        {stt.state === 'ready' && (
          <div className="flex items-center gap-2">
            <RiCheckLine className="size-4 text-green-500" />
            <span className="text-green-600 dark:text-green-400">
              Voice: {stt.modelId.split('/').pop()} ready
            </span>
          </div>
        )}
        {stt.state === 'loading' && (
          <div className="flex items-center gap-2">
            <RiLoader2Line className="size-4 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">
              Voice model downloading... {Math.round(stt.progress)}%
            </span>
          </div>
        )}

        {/* Title — only shown if loaded or loading */}
        {title.state === 'ready' && (
          <div className="flex items-center gap-2">
            <RiCheckLine className="size-4 text-green-500" />
            <span className="text-green-600 dark:text-green-400">Auto-titles: SmolLM2 ready</span>
          </div>
        )}
        {title.state === 'loading' && (
          <div className="flex items-center gap-2">
            <RiLoader2Line className="size-4 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">
              Title model downloading... {Math.round(title.progress)}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
