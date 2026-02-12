import { MarkdownEditor, type MarkdownEditorHandle } from '@/components/markdown-editor'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppContext } from '@/lib/app-context'
import type { Idea } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  RiAddLine,
  RiArchiveLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiInboxLine,
  RiInboxUnarchiveLine,
  RiLightbulbFlashLine,
  RiLoopLeftLine,
  RiSearchLine,
  RiSettings3Line,
} from '@remixicon/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const SEARCH_EXAMPLES = [
  'What was that idea about meetings?',
  'Find notes on user onboarding',
  'Ideas related to machine learning',
  'Thoughts about product pricing',
  'Notes from last brainstorming session',
]

function useAnimatedPlaceholder(sentences: string[], active: boolean): string {
  const [display, setDisplay] = useState('')
  const sentenceIndexRef = useRef(0)
  const charIndexRef = useRef(0)
  const phaseRef = useRef<'typing' | 'pausing'>('typing')

  useEffect(() => {
    if (!active) return

    charIndexRef.current = 0
    phaseRef.current = 'typing'
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout>

    function tick() {
      if (cancelled) return
      const sentence = sentences[sentenceIndexRef.current % sentences.length]
      if (!sentence) return

      if (phaseRef.current === 'typing') {
        charIndexRef.current += 1
        setDisplay(sentence.slice(0, charIndexRef.current))

        if (charIndexRef.current >= sentence.length) {
          phaseRef.current = 'pausing'
          timeoutId = setTimeout(tick, 2000)
        } else {
          timeoutId = setTimeout(tick, 50)
        }
      } else {
        charIndexRef.current = 0
        sentenceIndexRef.current = (sentenceIndexRef.current + 1) % sentences.length
        setDisplay('')
        phaseRef.current = 'typing'
        timeoutId = setTimeout(tick, 400)
      }
    }

    timeoutId = setTimeout(() => {
      if (cancelled) return
      setDisplay('')
      timeoutId = setTimeout(tick, 400)
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [active, sentences])

  return active ? display : ''
}

interface DashboardProps {
  onSettings: () => void
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function groupByDay(ideas: Idea[]): Map<string, Idea[]> {
  const groups = new Map<string, Idea[]>()
  for (const idea of ideas) {
    const day = new Date(idea.createdAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const existing = groups.get(day)
    if (existing) {
      existing.push(idea)
    } else {
      groups.set(day, [idea])
    }
  }
  return groups
}

export function Dashboard({ onSettings }: DashboardProps) {
  const {
    ideas,
    showArchive,
    archiveCount,
    onToggleArchive,
    onSearch,
    onUpdate,
    onDelete,
    onArchive,
    onCapture,
    onRegenerateTitle,
  } = useAppContext()

  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const editEditorRef = useRef<MarkdownEditorHandle>(null)

  const placeholderActive = !searchQuery && !isSearchFocused && !showArchive
  const animatedText = useAnimatedPlaceholder(SEARCH_EXAMPLES, placeholderActive)

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        onSearch(value)
      }, 300)
    },
    [onSearch],
  )

  function switchTab(archived: boolean) {
    if (archived === showArchive) return
    setSearchQuery('')
    setEditingId(null)
    setDeleteConfirmId(null)
    onToggleArchive(archived)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const startEdit = useCallback((idea: Idea) => {
    setEditingId(idea.id)
    setEditText(idea.text)
  }, [])

  const saveEdit = useCallback(
    (id: string) => {
      const text = editEditorRef.current?.getMarkdown() ?? editText
      const trimmed = text.trim()
      if (trimmed) {
        onUpdate(id, trimmed)
      }
      setEditingId(null)
    },
    [editText, onUpdate],
  )

  const confirmDelete = useCallback((id: string) => {
    setDeleteConfirmId(id)
  }, [])

  const executeDelete = useCallback(() => {
    if (deleteConfirmId) {
      onDelete(deleteConfirmId)
      setDeleteConfirmId(null)
    }
  }, [deleteConfirmId, onDelete])

  const grouped = useMemo(() => groupByDay(ideas), [ideas])

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {/* Brand */}
          <div className="flex items-center gap-1.5">
            <RiLightbulbFlashLine className="size-5 text-primary" />
            <span className="text-lg font-semibold">Glimt</span>
          </div>

          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <RiSearchLine className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder={
                showArchive ? 'Search archived ideas...' : isSearchFocused ? 'Search...' : undefined
              }
              className="pl-8 pr-8"
            />
            {placeholderActive && animatedText && (
              <span className="pointer-events-none absolute inset-y-0 left-8 right-8 flex items-center truncate text-base text-muted-foreground md:text-sm">
                {animatedText}
              </span>
            )}
            {searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              >
                <RiCloseLine className="size-4" />
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-1.5">
            <Button onClick={onCapture} size="sm">
              <RiAddLine className="size-4" />
              Capture
            </Button>
            <Button onClick={onSettings} size="sm" variant="ghost">
              <RiSettings3Line className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filter strip */}
      <div className="filter-strip px-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="archive-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={!showArchive}
              className={`archive-tab${!showArchive ? ' archive-tab-active' : ''}`}
              onClick={() => switchTab(false)}
            >
              <RiLightbulbFlashLine className="size-4" />
              Ideas
            </button>
            <button
              role="tab"
              aria-selected={showArchive}
              className={`archive-tab${showArchive ? ' archive-tab-active' : ''}`}
              onClick={() => switchTab(true)}
            >
              <RiArchiveLine className="size-4" />
              Archive
              {archiveCount > 0 && <span className="archive-tab-count">{archiveCount}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Search result banner */}
      {searchQuery && ideas.length > 0 && (
        <div className="px-4 pt-3 sm:px-6">
          <div className="search-active mx-auto flex max-w-3xl items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              Found <strong className="text-foreground">{ideas.length}</strong> idea
              {ideas.length !== 1 ? 's' : ''}
              {showArchive && ' in archive'}
            </span>
            <Badge variant="secondary" className="text-xs">
              Semantic Search
            </Badge>
          </div>
        </div>
      )}

      {/* Idea list */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
          {ideas.length === 0 && (
            <div className="py-16 text-center">
              {searchQuery ? (
                <p className="text-lg text-muted-foreground">
                  No {showArchive ? 'archived ' : ''}ideas match your search.
                </p>
              ) : showArchive ? (
                <div className="archive-empty flex flex-col items-center gap-4">
                  <div className="archive-empty-icon flex size-16 items-center justify-center rounded-2xl">
                    <RiInboxLine className="size-8" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-foreground">Archive is empty</h2>
                    <p className="text-sm text-muted-foreground">
                      Ideas you archive will appear here. Archive ideas you want to keep but hide
                      from your main view.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                    <RiLightbulbFlashLine className="size-8 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-foreground">
                      Capture your first idea
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Click <strong>Capture</strong> or press{' '}
                      <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-medium">
                        Alt+I
                      </kbd>{' '}
                      to add one.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {Array.from(grouped.entries()).map(([day, dayIdeas]) => (
            <div key={day} className="space-y-3">
              <h2 className="day-header text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                {day}
              </h2>
              {dayIdeas.map((idea) => (
                <Card
                  key={idea.id}
                  className={`idea-card group${showArchive ? ' idea-card-archived' : ''}${editingId === idea.id ? ' idea-card-editing' : ''}`}
                >
                  <CardContent className="space-y-2 p-4">
                    {editingId === idea.id ? (
                      <div className="space-y-2">
                        <MarkdownEditor
                          key={editingId}
                          ref={editEditorRef}
                          initialContent={editText}
                          compact
                          placeholder="Edit your idea..."
                          onSave={() => saveEdit(idea.id)}
                          onCancel={() => setEditingId(null)}
                          className="min-h-[80px]"
                        />
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => saveEdit(idea.id)}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Ctrl+Enter to save / Esc to cancel
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className="cursor-pointer"
                          onClick={() => startEdit(idea)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') startEdit(idea)
                          }}
                        >
                          <div className="group/title flex items-center gap-1.5">
                            {idea.title ? (
                              <h3 className="mb-1 font-semibold text-foreground">{idea.title}</h3>
                            ) : (
                              <span className="mb-1 text-sm italic text-muted-foreground">
                                Untitled
                              </span>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className={cn(
                                    'mb-1 inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-all hover:text-foreground',
                                    regeneratingId === idea.id
                                      ? 'opacity-100'
                                      : idea.title
                                        ? 'opacity-0 group-hover/title:opacity-100'
                                        : 'opacity-0 group-hover:opacity-100',
                                  )}
                                  disabled={regeneratingId === idea.id}
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    setRegeneratingId(idea.id)
                                    try {
                                      await onRegenerateTitle(idea.id)
                                    } finally {
                                      setRegeneratingId(null)
                                    }
                                  }}
                                >
                                  <RiLoopLeftLine
                                    className={cn(
                                      'size-3.5',
                                      regeneratingId === idea.id && 'animate-spin',
                                    )}
                                  />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {regeneratingId === idea.id
                                  ? 'Generating...'
                                  : idea.title
                                    ? 'Regenerate title'
                                    : 'Generate title'}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <MarkdownRenderer content={idea.text} className="line-clamp-3" />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] text-muted-foreground">
                            {formatDate(idea.createdAt)}
                          </span>
                          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-muted-foreground hover:text-foreground"
                              title={showArchive ? 'Restore to Ideas' : 'Move to Archive'}
                              onClick={(e) => {
                                e.stopPropagation()
                                onArchive(idea.id)
                              }}
                            >
                              {showArchive ? (
                                <RiInboxUnarchiveLine className="size-4" />
                              ) : (
                                <RiArchiveLine className="size-4" />
                              )}
                            </Button>
                            {deleteConfirmId === idea.id ? (
                              <div className="flex gap-1">
                                <Button
                                  size="xs"
                                  variant="destructive"
                                  autoFocus
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    executeDelete()
                                  }}
                                >
                                  Confirm
                                </Button>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDeleteConfirmId(null)
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 text-muted-foreground hover:text-destructive"
                                title="Delete"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  confirmDelete(idea.id)
                                }}
                              >
                                <RiDeleteBinLine className="size-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
