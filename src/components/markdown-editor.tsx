import { cn } from '@/lib/utils'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Markdown } from 'tiptap-markdown'

export interface EditorUpdateInfo {
  lineCount: number
  charCount: number
  isEmpty: boolean
  text: string
}

export interface MarkdownEditorHandle {
  getMarkdown: () => string
  insertText: (text: string) => void
  focus: () => void
  clear: () => void
}

interface MarkdownEditorProps {
  placeholder?: string
  className?: string
  compact?: boolean
  disabled?: boolean
  initialContent?: string
  onSave?: () => void
  onCancel?: () => void
  onUpdate?: (info: EditorUpdateInfo) => void
  onArrowUpEmpty?: () => void
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      placeholder,
      className,
      compact,
      disabled,
      initialContent,
      onSave,
      onCancel,
      onUpdate,
      onArrowUpEmpty,
    },
    ref,
  ) {
    const onSaveRef = useRef(onSave)
    const onCancelRef = useRef(onCancel)
    const onUpdateRef = useRef(onUpdate)
    const onArrowUpEmptyRef = useRef(onArrowUpEmpty)
    useEffect(() => {
      onSaveRef.current = onSave
    }, [onSave])
    useEffect(() => {
      onCancelRef.current = onCancel
    }, [onCancel])
    useEffect(() => {
      onUpdateRef.current = onUpdate
    }, [onUpdate])
    useEffect(() => {
      onArrowUpEmptyRef.current = onArrowUpEmpty
    }, [onArrowUpEmpty])

    const editor = useEditor({
      content: initialContent ?? '',
      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder: placeholder ?? 'Start typing...',
        }),
        Markdown.configure({
          html: false,
          transformPastedText: true,
        }),
      ],
      editorProps: {
        handleKeyDown: (view, event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onCancelRef.current?.()
            return true
          }
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            onSaveRef.current?.()
            return true
          }
          if (event.key === 'ArrowUp' && onArrowUpEmptyRef.current) {
            const { doc, selection } = view.state
            const atStart = selection.from === 1 && selection.to === 1
            const isEmpty = doc.textContent.length === 0
            if (isEmpty || atStart) {
              event.preventDefault()
              onArrowUpEmptyRef.current()
              return true
            }
          }
          return false
        },
        attributes: {
          class: cn(
            compact ? 'min-h-[24px]' : 'min-h-[120px]',
            'w-full outline-none',
            'prose prose-sm dark:prose-invert max-w-none',
            'prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1',
            'prose-p:leading-relaxed',
          ),
        },
      },
      editable: !disabled,
      onUpdate: ({ editor: ed }) => {
        if (!onUpdateRef.current) return
        type MarkdownStorage = Record<string, { getMarkdown: () => string } | undefined>
        const md = (ed.storage as unknown as MarkdownStorage).markdown
        const text = md ? md.getMarkdown() : ''
        const lines = text.split('\n')
        onUpdateRef.current({
          lineCount: lines.length,
          charCount: text.length,
          isEmpty: ed.isEmpty,
          text,
        })
      },
    })

    useEffect(() => {
      editor?.setEditable(!disabled)
    }, [editor, disabled])

    useEffect(() => {
      editor?.commands.focus()
    }, [editor])

    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        if (!editor) return ''
        // tiptap-markdown extension stores getMarkdown() on editor.storage.markdown
        type MarkdownStorage = Record<string, { getMarkdown: () => string } | undefined>
        const md = (editor.storage as unknown as MarkdownStorage).markdown
        return md ? md.getMarkdown() : ''
      },
      insertText: (text: string) => {
        if (!editor) return
        if (editor.isEmpty) {
          editor.commands.insertContent(text)
        } else {
          editor.chain().focus('end').insertContent(` ${text}`).run()
        }
      },
      focus: () => {
        editor?.commands.focus()
      },
      clear: () => {
        editor?.commands.clearContent()
      },
    }))

    return (
      <div
        className={cn(
          'rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs',
          'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        <EditorContent editor={editor} />
      </div>
    )
  },
)
