import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, Save, Copy, Loader2, AlertCircle, AlertTriangle, X, Search, Pencil, RefreshCw, Mail, Type, FileText, Code2, Braces, Clock3, Check, ChevronUp, ChevronDown, Heading1, Heading2, Pilcrow, Bold, Italic, Link as LinkIcon, ExternalLink, Image as ImageIcon, List, Table, Minus } from 'lucide-react'
import { EmailTemplateVariables } from './EmailTemplateVariables'
import { EmailTemplatePreview } from './EmailTemplatePreview'
import { GeneralEmailTemplateBadge, ProjectEmailTemplateBadge } from './TemplateBadges'
import {
  emailApi, extractGeneralVarsClient, extractBladeRawsClient, normalizeBladeRaw, analyzeBladeClient,
  previewGeneralClient, previewBladeClient,
  type GeneralEmailTemplate, type ProjectEmailTemplate,
} from '../../api/emailTemplates'

type Props =
  | { kind: 'general'; template: GeneralEmailTemplate; onSaved: (t: GeneralEmailTemplate) => void; onClose: () => void }
  | { kind: 'project'; template: ProjectEmailTemplate; projectId: string; onSaved: (t: ProjectEmailTemplate) => void; onClose: () => void }

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

export function EmailTemplateEditor(props: Props) {
  const isGeneral = props.kind === 'general'
  const [name, setName] = useState(isGeneral ? (props.template as GeneralEmailTemplate).name : (props.template as ProjectEmailTemplate).name)
  const [description, setDescription] = useState(isGeneral ? ((props.template as GeneralEmailTemplate).description || '') : '')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedTick, setSavedTick] = useState(false)
  const [confirmSave, setConfirmSave] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [find, setFind] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const initialRef = useRef('')
  const initialVarsRef = useRef<{ general: string[]; bladeRaws: string[]; bladeNames: string[] }>(
    { general: [], bladeRaws: [], bladeNames: [] },
  )

  const templateId = props.template.id
  const projectId = !isGeneral ? (props as Extract<Props, { kind: 'project' }>).projectId : ''

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        if (isGeneral) {
          const t = props.template as GeneralEmailTemplate
          if (!cancelled) {
            setContent(t.content || '')
            initialRef.current = t.content || ''
            initialVarsRef.current = { general: extractGeneralVarsClient(t.content || ''), bladeRaws: [], bladeNames: [] }
          }
        } else {
          // Always read current file when opening
          const detail = await emailApi.getProjectTemplate(projectId, templateId)
          if (!cancelled) {
            setContent(detail.content || '')
            initialRef.current = detail.content || ''
            initialVarsRef.current = {
              general: [],
              bladeRaws: (detail.variables || []).map((v) => normalizeBladeRaw(v.raw)),
              bladeNames: (detail.variables || []).map((v) => v.name),
            }
            ;(props as Extract<Props, { kind: 'project' }>).onSaved(detail)
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Could not load template.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, projectId])

  const dirty = content !== initialRef.current || (isGeneral && name !== (props.template as GeneralEmailTemplate).name)

  const generalVars = useMemo(() => (isGeneral ? extractGeneralVarsClient(content) : []), [content, isGeneral])
  const bladeVars = useMemo(() => {
    if (isGeneral) return []
    const t = props.template as ProjectEmailTemplate
    return (t.variables || []).map((v) => ({ name: v.name, raw: v.raw }))
  }, [isGeneral, props.template])

  // Instant dummy preview — always replaces variables, updates as you type
  const livePreview = useMemo(
    () => (isGeneral ? previewGeneralClient(content) : previewBladeClient(content)),
    [content, isGeneral],
  )

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

  // ---- Smart Blade analysis: unknown (manually added) variables + summary ----
  // Understands Laravel scoping — @php blocks, loop vars, @inject, @props/@aware,
  // $errors/$attributes/$slot, $loop in loops, @isset/@empty guards, $message in
  // @error blocks; ignores comments and @verbatim. Only truly external vars warn.
  const bladeAnalysis = useMemo(
    () => (isGeneral ? null : analyzeBladeClient(content, initialVarsRef.current.bladeNames)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [content, isGeneral, props.template],
  )

  const currentBladeRaws = useMemo(() => (isGeneral ? [] : extractBladeRawsClient(content)), [content, isGeneral])

  const unknownVars = useMemo(() => {
    if (isGeneral) {
      const known = new Set(initialVarsRef.current.general)
      return generalVars.filter((v) => !known.has(v)).map((v) => `{${v}}`)
    }
    return (bladeAnalysis?.unknown || []).map((u) => u.raw)
  }, [isGeneral, generalVars, bladeAnalysis, content])

  const unusedKnown = useMemo(() => {
    if (isGeneral) {
      const used = new Set(generalVars)
      return initialVarsRef.current.general.filter((v) => !used.has(v)).map((v) => `{${v}}`)
    }
    const usedBases = new Set((bladeAnalysis?.used || []).map((n) => n.split('.')[0]))
    return initialVarsRef.current.bladeNames.filter((n) => !usedBases.has(n.split('.')[0]))
  }, [isGeneral, generalVars, bladeAnalysis, content])

  const summary = useMemo(() => {
    const usedCount = isGeneral ? generalVars.length : currentBladeRaws.length
    const knownCount = isGeneral ? initialVarsRef.current.general.length : initialVarsRef.current.bladeNames.length
    const allUsed = unusedKnown.length === 0
    const tpl = props.template as GeneralEmailTemplate & ProjectEmailTemplate
    const rawUpdated = (tpl as GeneralEmailTemplate).updated_at ?? (tpl as ProjectEmailTemplate).updatedAt ?? ''
    let lastEdit = '—'
    if (rawUpdated) {
      const d = new Date(rawUpdated)
      if (!Number.isNaN(d.getTime())) lastEdit = d.toLocaleString()
    }
    return { usedCount, knownCount, allUsed, lastEdit }
  }, [isGeneral, generalVars, currentBladeRaws, unusedKnown, props.template])

  function insertAtCursor(text: string) {    const el = textareaRef.current
    if (!el) {
      setContent((c) => c + text)
      return
    }
    const start = el.selectionStart ?? content.length
    const end = el.selectionEnd ?? content.length
    const next = content.slice(0, start) + text + content.slice(end)
    setContent(next)
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + text.length
    })
  }

  async function fetchServerPreview() {
    setPreviewLoading(true)
    try {
      const html = await emailApi.preview(content, isGeneral ? 'general' : 'blade')
      setPreviewHtml(html)
    } catch (e: any) {
      // fall back to instant client preview (already dummy-substituted)
      setPreviewHtml(livePreview)
      setError(e.message || 'Preview failed.')
    } finally {
      setPreviewLoading(false)
    }
  }

  function openPreviewTab() {
    setTab('preview')
    fetchServerPreview()
  }

  async function doSave() {
    if (!dirty || saving) return
    // Project files: explicit confirmation first time
    if (!isGeneral && !confirmSave) {
      setConfirmSave(true)
      return
    }
    setSaving(true)
    setError('')
    try {
      if (isGeneral) {
        const updated = await emailApi.updateGeneral(templateId, { name: name.trim(), description, content })
        initialRef.current = updated.content
        initialVarsRef.current = { general: updated.variables || extractGeneralVarsClient(updated.content), bladeRaws: [], bladeNames: [] }
        ;(props as Extract<Props, { kind: 'general' }>).onSaved(updated)
      } else {
        const updated = await emailApi.saveProjectTemplate(projectId, templateId, content)
        initialRef.current = updated.content || content
        initialVarsRef.current = {
          general: [],
          bladeRaws: (updated.variables || []).map((v) => normalizeBladeRaw(v.raw)),
          bladeNames: (updated.variables || []).map((v) => v.name),
        }
        ;(props as Extract<Props, { kind: 'project' }>).onSaved(updated)
      }
      setSavedTick(true)
      setConfirmSave(false)
      window.setTimeout(() => setSavedTick(false), 2000)
    } catch (e: any) {
      setError(e.message || 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  function requestClose() {
    if (dirty && !confirmClose) {
      setConfirmClose(true)
      return
    }
    props.onClose()
  }

  // warn on navigate away + Escape to close drawer
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (dirty) e.preventDefault()
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (confirmSave) setConfirmSave(false)
        else if (confirmClose) setConfirmClose(false)
        else requestClose()
      }
    }
    window.addEventListener('beforeunload', handler)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('beforeunload', handler)
      window.removeEventListener('keydown', esc)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, confirmSave, confirmClose])

  const relPath = !isGeneral ? (props.template as ProjectEmailTemplate).relativePath : ''
  const moduleName = !isGeneral ? (props.template as ProjectEmailTemplate).moduleName : null
  const projectName = !isGeneral ? (props.template as ProjectEmailTemplate).projectName : ''

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Edit email template">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={requestClose} aria-hidden="true" />
      <div className="relative flex h-dvh w-full flex-col bg-card shadow-2xl border-l border-border dark:bg-slate-900 lg:w-[80vw] lg:max-w-[85vw] animate-in motion-reduce:animate-none">
        {/* Header — same as view task drawer */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-gradient-to-r from-primary/[0.04] via-transparent to-transparent px-5 py-4 dark:from-white/[0.04] dark:bg-slate-900 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold tracking-tight">Edit Email Template</h3>
                {isGeneral ? <GeneralEmailTemplateBadge /> : <ProjectEmailTemplateBadge />}
                {savedTick && <span className="badge badge-success">Saved</span>}
                {dirty && <span className="badge badge-warn">Unsaved changes</span>}
              </div>
              <p className="truncate text-xs font-medium text-muted-foreground" title={!isGeneral ? relPath : undefined}>
                {isGeneral
                  ? 'Reusable HTML template — stored in the database.'
                  : `Project: ${projectName}${moduleName ? ` · Module: ${moduleName}` : ''} · Path: ${relPath}`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1" role="tablist" aria-label="Editor view">
              <button
                type="button" role="tab" aria-selected={tab === 'edit'} onClick={() => setTab('edit')}
                className={`btn btn-sm cursor-pointer border-0 ${tab === 'edit' ? 'btn-primary' : 'btn-ghost'}`}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                type="button" role="tab" aria-selected={tab === 'preview'} onClick={openPreviewTab}
                className={`btn btn-sm cursor-pointer border-0 ${tab === 'preview' ? 'btn-primary' : 'btn-ghost'}`}
              >
                {previewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Preview
              </button>
            </div>
            <button type="button" onClick={doSave} disabled={!dirty || saving} className="btn btn-primary btn-sm cursor-pointer disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={requestClose} className={CLOSE_BTN_CLS} aria-label="Close drawer">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Scrollable content — same as view task drawer */}
        <div className="flex-1 space-y-6 overflow-y-auto bg-background px-5 py-6 sm:px-6">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" /><p className="flex-1">{error}</p>
              <button type="button" onClick={() => setError('')} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading template…
            </div>
          ) : tab === 'preview' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Variables always replaced with dummy data — never executes PHP.
                </p>
                <button type="button" onClick={fetchServerPreview} disabled={previewLoading} className="btn btn-outline btn-sm cursor-pointer">
                  {previewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
                </button>
              </div>
              {previewLoading && !previewHtml ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Rendering preview…
                </div>
              ) : (
                <EmailTemplatePreview html={previewHtml || livePreview} mock />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
              <div className="min-w-0 space-y-6">
                {isGeneral && (
                  <>
                    <div className="space-y-2">
                      <label htmlFor="et-name" className="flex items-center gap-2 text-sm font-semibold">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"><Type className="h-3.5 w-3.5" aria-hidden="true" /></span>
                        Template Name <span className="text-destructive">*</span>
                      </label>
                      <input id="et-name" value={name} onChange={(e) => setName(e.target.value.slice(0, 200))} className={INPUT_CLS} maxLength={200} />
                      <p className="text-xs text-muted-foreground">Clear, reusable name for this template</p>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="et-desc" className="flex items-center gap-2 text-sm font-semibold">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><FileText className="h-3.5 w-3.5" aria-hidden="true" /></span>
                        Description <span className="text-xs font-normal text-muted-foreground">— optional</span>
                      </label>
                      <input id="et-desc" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 5000))} className={INPUT_CLS} placeholder="What is this template for?" />
                      <p className="text-xs text-muted-foreground">Shown in the template list to help owners pick</p>
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <label htmlFor="et-content" className="flex items-center gap-2 text-sm font-semibold">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600"><Code2 className="h-3.5 w-3.5" aria-hidden="true" /></span>
                    {isGeneral ? 'HTML Content' : 'Blade Content'} <span className="text-destructive">*</span>
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
                          id="et-content"
                          ref={textareaRef}
                          value={content}
                          onChange={(e) => setContent(e.target.value.slice(0, 500000))}
                          onKeyDown={onEditorKeyDown}
                          onScroll={syncScroll}
                          spellCheck={false}
                          aria-label={isGeneral ? 'HTML editor' : 'Blade editor'}
                          className={`${EDITOR_AREA_CLS} absolute inset-0 h-full resize-none overflow-auto ${find ? 'bg-transparent text-transparent caret-foreground selection:bg-primary/40' : ''}`}
                          placeholder={isGeneral ? '<html>\n  <body>\n    <h1>Welcome {company_name}</h1>\n  </body>\n</html>' : '{{ $company_name }}'}
                        />
                      </div>
                    </div>
                  </div>
                  {unknownVars.length > 0 && (
                    <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <p className="flex-1">
                        Possibly undefined variable{unknownVars.length === 1 ? '' : 's'} — not passed to this view
                        {!isGeneral && ' and not defined by @php, @foreach, @props or @inject here'}:{' '}
                        <span className="font-mono font-semibold">{unknownVars.slice(0, 8).join(', ')}</span>
                        {unknownVars.length > 8 && ` +${unknownVars.length - 8} more`}
                      </p>
                    </div>
                  )}
                  {/* Template summary */}
                  <div className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                      <Braces className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <h4 className="text-sm font-semibold">Template summary</h4>
                      {dirty
                        ? <span className="badge badge-warn ml-auto">Unsaved changes</span>
                        : <span className="badge badge-success ml-auto"><Check className="h-3 w-3" /> Saved</span>}
                    </div>
                    <dl className="grid grid-cols-2 gap-3 p-4 text-xs sm:grid-cols-4">
                      <div className="space-y-0.5">
                        <dt className="font-medium text-muted-foreground">Variables used</dt>
                        <dd className="text-lg font-bold tabular-nums">{summary.usedCount}</dd>
                      </div>
                      <div className="space-y-0.5">
                        <dt className="font-medium text-muted-foreground">Known variables</dt>
                        <dd className="text-lg font-bold tabular-nums">{summary.knownCount}</dd>
                      </div>
                      <div className="space-y-0.5">
                        <dt className="font-medium text-muted-foreground">Content</dt>
                        <dd className="font-semibold tabular-nums">{content.length.toLocaleString()} chars · {lineCount.toLocaleString()} lines</dd>
                      </div>
                      <div className="space-y-0.5">
                        <dt className="flex items-center gap-1 font-medium text-muted-foreground"><Clock3 className="h-3 w-3" /> Last edit</dt>
                        <dd className="font-semibold">{summary.lastEdit}</dd>
                      </div>
                    </dl>
                    {!isGeneral && (bladeAnalysis?.defined.length ?? 0) > 0 && (
                      <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Defined in template (@php, loops, @props, @inject):</span>{' '}
                        <span className="font-mono">{bladeAnalysis!.defined.slice(0, 12).join(', ')}</span>
                        {bladeAnalysis!.defined.length > 12 && ` +${bladeAnalysis!.defined.length - 12} more`}
                      </p>
                    )}
                    <div className="space-y-1.5 border-t border-border px-4 py-3 text-xs">
                      {summary.allUsed ? (
                        <p className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
                          <Check className="h-3.5 w-3.5" /> All known variables are used.
                        </p>
                      ) : (
                        <p className="text-muted-foreground">
                          <span className="font-semibold text-foreground">Unused:</span>{' '}
                          <span className="font-mono">{unusedKnown.slice(0, 8).join(', ')}</span>
                          {unusedKnown.length > 8 && ` +${unusedKnown.length - 8} more`}
                        </p>
                      )}
                      {(isGeneral ? generalVars : currentBladeRaws).length > 0 && (
                        <p className="text-muted-foreground">
                          <span className="font-semibold text-foreground">In use:</span>{' '}
                          <span className="font-mono">{(isGeneral ? generalVars.map((v) => `{${v}}`) : currentBladeRaws).slice(0, 8).join(', ')}</span>
                          {(isGeneral ? generalVars.length : currentBladeRaws.length) > 8 &&
                            ` +${(isGeneral ? generalVars.length : currentBladeRaws.length) - 8} more`}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isGeneral ? 'Use {variable} placeholders — never converted to Markdown.' : 'Blade syntax preserved — {name} format is for General templates only.'}
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
                  bladeVars={bladeVars}
                  onInsert={insertAtCursor}
                />
              </div>
            </div>
          )}

        </div>
      </div>

      {confirmSave && !isGeneral && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="save-file-title">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setConfirmSave(false)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="space-y-2 px-6 py-5">
              <h3 id="save-file-title" className="text-base font-bold">Save project file?</h3>
              <p className="text-sm text-muted-foreground">This will modify the actual project file:</p>
              <p className="rounded-lg bg-muted/50 px-3 py-2 font-mono text-xs">{relPath}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4">
              <button type="button" onClick={() => setConfirmSave(false)} className="btn btn-ghost">Cancel</button>
              <button type="button" onClick={doSave} disabled={saving} className="btn btn-primary">Save File</button>
            </div>
          </div>
        </div>
      )}

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
              <button type="button" onClick={props.onClose} className="btn btn-primary">Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
