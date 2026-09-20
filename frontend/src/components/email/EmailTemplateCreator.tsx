import { useMemo, useRef, useState } from 'react'
import { Plus, Copy, Loader2, AlertCircle, X, Search, Mail, Type, FileText, Code2, Braces, Check, ChevronUp, ChevronDown, Heading1, Heading2, Pilcrow, Bold, Italic, Link as LinkIcon, ExternalLink, Image as ImageIcon, List, Table, Minus } from 'lucide-react'
import { EmailTemplateVariables } from './EmailTemplateVariables'
import { EmailTemplatePreview } from './EmailTemplatePreview'
import { GeneralEmailTemplateBadge } from './TemplateBadges'
import {
  emailApi, extractGeneralVarsClient, previewGeneralClient,
  type GeneralEmailTemplate,
} from '../../api/emailTemplates'

type Props = {
  onCreated: (t: GeneralEmailTemplate) => void
  onClose: () => void
}

const INPUT_CLS =
  'input h-11 text-[15px] font-medium bg-card border-border hover:border-border focus:border-border focus:ring-0 focus-visible:border-border focus-visible:ring-0 focus-visible:ring-offset-0 transition-all'
const CLOSE_BTN_CLS =
  'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-soft transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
const TOOL_BTN_CLS =
  'inline-flex h-8 min-w-8 cursor-pointer items-center justify-center gap-1 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
const EDITOR_AREA_CLS =
  'min-h-[380px] w-full flex-1 cursor-text resize-y bg-transparent px-3 py-3.5 font-mono text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none'

type HtmlSnippet = { label: string; title: string; before: string; after: string; placeholder: string }

const HTML_BAR: HtmlSnippet[] = [
  { label: 'H1', title: 'Heading 1', before: '<h1>', after: '</h1>', placeholder: 'Heading' },
  { label: 'H2', title: 'Heading 2', before: '<h2>', after: '</h2>', placeholder: 'Subheading' },
  { label: 'P', title: 'Paragraph', before: '<p>', after: '</p>', placeholder: 'Text' },
  { label: 'B', title: 'Bold', before: '<strong>', after: '</strong>', placeholder: 'bold text' },
  { label: 'I', title: 'Italic', before: '<em>', after: '</em>', placeholder: 'italic text' },
  { label: 'Link', title: 'Link', before: '<a href="https://example.com">', after: '</a>', placeholder: 'link text' },
  { label: 'Button', title: 'Call-to-action button', before: '<a href="{login_url}" style="display:inline-block;padding:10px 20px;background:#2563EB;color:#ffffff;border-radius:8px;text-decoration:none;">', after: '</a>', placeholder: 'Login' },
  { label: 'List', title: 'Bullet list', before: '<ul>\n  <li>', after: '</li>\n</ul>', placeholder: 'Item' },
  { label: 'Table', title: 'Table', before: '<table>\n  <tr>\n    <td>', after: '</td>\n  </tr>\n</table>', placeholder: 'Cell' },
  { label: 'Img', title: 'Image', before: '<img src="https://example.com/image.png" alt="', after: '" />', placeholder: 'description' },
  { label: 'HR', title: 'Divider', before: '<hr />', after: '', placeholder: '' },
]

const TOOL_ICONS: Record<string, typeof Heading1> = {
  H1: Heading1, H2: Heading2, P: Pilcrow, B: Bold, I: Italic, Link: LinkIcon,
  Button: ExternalLink, List, Table, Img: ImageIcon, HR: Minus,
}

const DEFAULT_CONTENT = '<html>\n  <body>\n    <h1>Welcome {company_name}</h1>\n    <p>Hello {employee_name}</p>\n    <a href="{login_url}">Login</a>\n  </body>\n</html>'

export function EmailTemplateCreator({ onCreated, onClose }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState(DEFAULT_CONTENT)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const [find, setFind] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  const dirty = name.trim() !== '' || description.trim() !== '' || content !== DEFAULT_CONTENT
  const canCreate = name.trim() !== '' && content.trim() !== '' && !creating

  const generalVars = useMemo(() => extractGeneralVarsClient(content), [content])

  // Instant dummy preview — always replaces variables, updates as you type
  const livePreview = useMemo(() => previewGeneralClient(content), [content])

  function wrapSelection(before: string, after: string, placeholder: string) {
    const el = textareaRef.current
    const start = el?.selectionStart ?? content.length
    const end = el?.selectionEnd ?? content.length
    const hadSelection = end > start
    const sel = (content.slice(start, end) || placeholder)
    const next = (content.slice(0, start) + before + sel + after + content.slice(end)).slice(0, 500000)
    setContent(next)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      if (hadSelection || !placeholder) {
        const pos = start + before.length + sel.length + after.length
        el.selectionStart = el.selectionEnd = Math.min(pos, next.length)
      } else {
        // select the placeholder so the user types over it
        el.selectionStart = start + before.length
        el.selectionEnd = start + before.length + sel.length
      }
    })
  }

  function onEditorKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      wrapSelection('  ', '', '')
    }
  }

  function syncScroll() {
    const el = textareaRef.current
    const gutter = gutterRef.current
    const backdrop = backdropRef.current
    if (!el) return
    if (gutter) gutter.scrollTop = el.scrollTop
    if (backdrop) {
      backdrop.scrollTop = el.scrollTop
      backdrop.scrollLeft = el.scrollLeft
    }
  }

  const lineCount = useMemo(() => Math.min(content.split('\n').length, 2000), [content])

  // ---- Search with match highlighting ----
  const matchCount = useMemo(() => {
    if (!find) return 0
    const q = find.toLowerCase()
    const src = content.toLowerCase()
    let n = 0
    let pos = 0
    while ((pos = src.indexOf(q, pos)) !== -1) {
      n++
      pos += q.length || 1
      if (n > 500) break
    }
    return n
  }, [content, find])

  const highlighted = useMemo(() => {
    if (!find) return null
    const q = find.toLowerCase()
    const nodes: React.ReactNode[] = []
    let i = 0
    let k = 0
    let mi = 0
    const active = ((matchIndex % Math.max(matchCount, 1)) + Math.max(matchCount, 1)) % Math.max(matchCount, 1)
    while (i < content.length && k < 500) {
      const pos = content.toLowerCase().indexOf(q, i)
      if (pos === -1) break
      if (pos > i) nodes.push(<span key={k++}>{content.slice(i, pos)}</span>)
      nodes.push(
        <mark
          key={k++}
          className={mi === active ? 'rounded-sm bg-orange-400 text-slate-900' : 'rounded-sm bg-yellow-300/80 text-slate-900'}
        >
          {content.slice(pos, pos + find.length)}
        </mark>,
      )
      mi++
      i = pos + (find.length || 1)
    }
    if (i < content.length) nodes.push(<span key={k++}>{content.slice(i)}</span>)
    nodes.push(<br key={k++} />)
    return nodes
  }, [content, find, matchIndex, matchCount])

  function goMatch(dir: 1 | -1) {
    if (!matchCount) return
    setMatchIndex((m) => (m + dir + matchCount) % matchCount)
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      goMatch(e.shiftKey ? -1 : 1)
    } else if (e.key === 'Escape') {
      setFind('')
      setMatchIndex(0)
    }
  }

  function insertAtCursor(text: string) {
    const el = textareaRef.current
    if (!el) {
      setContent((c) => (c + text).slice(0, 500000))
      return
    }
    const start = el.selectionStart ?? content.length
    const end = el.selectionEnd ?? content.length
    const next = (content.slice(0, start) + text + content.slice(end)).slice(0, 500000)
    setContent(next)
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + text.length
    })
  }

  async function doCreate() {
    if (!canCreate) return
    setCreating(true)
    setError('')
    try {
      const created = await emailApi.createGeneral({ name: name.trim(), description: description.trim(), content })
      onCreated(created)
    } catch (e: any) {
      setError(e.message || 'Could not create template.')
    } finally {
      setCreating(false)
    }
  }

  function requestClose() {
    if (dirty && !confirmClose) {
      setConfirmClose(true)
      return
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Create email template">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={requestClose} aria-hidden="true" />
      <div className="relative flex h-dvh w-full flex-col bg-card shadow-2xl border-l border-border dark:bg-slate-900 lg:w-[80vw] lg:max-w-[85vw] animate-in motion-reduce:animate-none">
        {/* Header — same as edit email template drawer */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-gradient-to-r from-primary/[0.04] via-transparent to-transparent px-5 py-4 dark:from-white/[0.04] dark:bg-slate-900 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold tracking-tight">Create Email Template</h3>
                <GeneralEmailTemplateBadge />
                {dirty && <span className="badge badge-warn">Unsaved changes</span>}
              </div>
              <p className="truncate text-xs font-medium text-muted-foreground">
                Reusable HTML template — stored in the database.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={doCreate} disabled={!canCreate} className="btn btn-primary btn-sm cursor-pointer disabled:opacity-50">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} {creating ? 'Creating…' : 'Create'}
            </button>
            <button type="button" onClick={requestClose} className={CLOSE_BTN_CLS} aria-label="Close drawer">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Scrollable content — same as edit email template drawer */}
        <div className="flex-1 space-y-6 overflow-y-auto bg-background px-5 py-6 sm:px-6">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" /><p className="flex-1">{error}</p>
              <button type="button" onClick={() => setError('')} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
              <div className="min-w-0 space-y-6">
                <div className="space-y-2">
                  <label htmlFor="et-create-name" className="flex items-center gap-2 text-sm font-semibold">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"><Type className="h-3.5 w-3.5" aria-hidden="true" /></span>
                    Template Name <span className="text-destructive">*</span>
                  </label>
                  <input id="et-create-name" value={name} onChange={(e) => setName(e.target.value.slice(0, 200))} className={INPUT_CLS} maxLength={200} placeholder="e.g. Welcome email" />
                  <p className="text-xs text-muted-foreground">Clear, reusable name for this template</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="et-create-desc" className="flex items-center gap-2 text-sm font-semibold">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><FileText className="h-3.5 w-3.5" aria-hidden="true" /></span>
                    Description <span className="text-xs font-normal text-muted-foreground">— optional</span>
                  </label>
                  <input id="et-create-desc" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 5000))} className={INPUT_CLS} placeholder="What is this template for?" />
                  <p className="text-xs text-muted-foreground">Shown in the template list to help owners pick</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="et-create-content" className="flex items-center gap-2 text-sm font-semibold">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600"><Code2 className="h-3.5 w-3.5" aria-hidden="true" /></span>
                    HTML Content <span className="text-destructive">*</span>
                    <span className="ml-auto text-[11px] font-medium tabular-nums text-muted-foreground">{content.length.toLocaleString()} chars</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[180px] flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <input
                        value={find}
                        onChange={(e) => { setFind(e.target.value); setMatchIndex(0) }}
                        onKeyDown={onSearchKeyDown}
                        placeholder="Search in editor… (Enter = next)"
                        aria-label="Search in editor"
                        className={`${INPUT_CLS} pl-10 pr-20`}
                      />
                      {find && (
                        <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                          <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                            {matchCount ? `${(matchIndex % matchCount) + 1}/${matchCount}` : '0/0'}
                          </span>
                          <button type="button" onClick={() => goMatch(-1)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Previous match">
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => goMatch(1)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Next match">
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => { try { navigator.clipboard.writeText(content) } catch {} }}
                      className="btn btn-outline btn-sm cursor-pointer"
                      aria-label="Copy content"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-muted/40 p-2" role="toolbar" aria-label="HTML tags">
                    {HTML_BAR.map((s) => {
                      const Icon = TOOL_ICONS[s.label]
                      return (
                        <button
                          key={s.label}
                          type="button"
                          title={s.title}
                          aria-label={`Insert ${s.title}`}
                          onClick={() => wrapSelection(s.before, s.after, s.placeholder)}
                          className={TOOL_BTN_CLS}
                        >
                          {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                          <span>{s.label}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border bg-card transition-all">
                    <div className="flex h-[380px]">
                      <div
                        ref={gutterRef}
                        aria-hidden="true"
                        className="h-full w-12 shrink-0 select-none overflow-hidden border-r border-border bg-muted/40 py-3.5 text-right font-mono text-[14px] leading-relaxed text-muted-foreground"
                      >
                        <div className="px-2">
                          {Array.from({ length: lineCount }, (_, i) => (
                            <div key={i + 1}>{i + 1}</div>
                          ))}
                        </div>
                      </div>
                      <div className="relative h-full min-w-0 flex-1">
                        {find && (
                          <div
                            ref={backdropRef}
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 select-none overflow-hidden px-3 py-3.5 font-mono text-[14px] leading-relaxed"
                          >
                            <pre className="whitespace-pre-wrap [overflow-wrap:break-word]"><code>{highlighted}</code></pre>
                          </div>
                        )}
                        <textarea
                          id="et-create-content"
                          ref={textareaRef}
                          value={content}
                          onChange={(e) => setContent(e.target.value.slice(0, 500000))}
                          onKeyDown={onEditorKeyDown}
                          onScroll={syncScroll}
                          spellCheck={false}
                          aria-label="HTML editor"
                          className={`${EDITOR_AREA_CLS} absolute inset-0 h-full resize-none overflow-auto ${find ? 'bg-transparent text-transparent caret-foreground selection:bg-primary/40' : ''}`}
                          placeholder={'<html>\n  <body>\n    <h1>Welcome {company_name}</h1>\n  </body>\n</html>'}
                        />
                      </div>
                    </div>
                  </div>
                  {/* Template summary */}
                  <div className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                      <Braces className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <h4 className="text-sm font-semibold">Template summary</h4>
                      {dirty
                        ? <span className="badge badge-warn ml-auto">Unsaved changes</span>
                        : <span className="badge badge-success ml-auto"><Check className="h-3 w-3" /> Saved</span>}
                    </div>
                    <dl className="grid grid-cols-2 gap-3 p-4 text-xs sm:grid-cols-3">
                      <div className="space-y-0.5">
                        <dt className="font-medium text-muted-foreground">Variables used</dt>
                        <dd className="text-lg font-bold tabular-nums">{generalVars.length}</dd>
                      </div>
                      <div className="space-y-0.5">
                        <dt className="font-medium text-muted-foreground">Content</dt>
                        <dd className="font-semibold tabular-nums">{content.length.toLocaleString()} chars · {lineCount.toLocaleString()} lines</dd>
                      </div>
                      <div className="space-y-0.5">
                        <dt className="font-medium text-muted-foreground">Status</dt>
                        <dd className="font-semibold">{canCreate ? 'Ready to create' : 'Name + content required'}</dd>
                      </div>
                    </dl>
                    <div className="space-y-1.5 border-t border-border px-4 py-3 text-xs">
                      {generalVars.length > 0 ? (
                        <p className="text-muted-foreground">
                          <span className="font-semibold text-foreground">In use:</span>{' '}
                          <span className="font-mono">{generalVars.map((v) => `{${v}}`).slice(0, 8).join(', ')}</span>
                          {generalVars.length > 8 && ` +${generalVars.length - 8} more`}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">No {'{variables}'} used yet.</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use {'{variable}'} placeholders — never converted to Markdown.
                  </p>
                </div>
                {/* Live preview — always open while editing */}
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">Live preview — dummy data</div>
                  <div className="p-4">
                    <EmailTemplatePreview html={livePreview} mock title="Live preview" />
                  </div>
                </div>
              </div>
              <div className="min-w-0">
                <EmailTemplateVariables
                  generalVars={generalVars}
                  bladeVars={[]}
                  onInsert={insertAtCursor}
                />
              </div>
            </div>

        </div>
      </div>

      {confirmClose && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="unsaved-title">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setConfirmClose(false)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="space-y-2 px-6 py-5">
              <h3 id="unsaved-title" className="text-base font-bold">Discard unsaved changes?</h3>
              <p className="text-sm text-muted-foreground">You have unsaved edits in this template.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4">
              <button type="button" onClick={() => setConfirmClose(false)} className="btn btn-ghost">Keep editing</button>
              <button type="button" onClick={onClose} className="btn btn-primary">Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
