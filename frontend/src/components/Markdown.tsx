import React, { useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Check, Copy } from 'lucide-react'

/**
 * MarkdownDocument — dependency-free Markdown renderer (no new packages).
 *
 * Pipeline: raw Markdown string → block AST (`parseBlocks`) → React tree.
 * All visual styling lives in `.markdown-preview` CSS selectors, so core
 * elements render as plain semantic HTML (<h1>, <p>, <strong>, ...).
 *
 * Safety: raw text is passed as React children (auto-escaped). Links allow
 * http(s) only; images allow http(s), data:image, or relative paths — no
 * javascript:, no raw HTML passthrough. Stored Markdown is never modified.
 */

// ---------------------------------------------------------------------------
// Inline parsing (operates on RAW text — React escapes output automatically)
// ---------------------------------------------------------------------------

function isSafeImgUrl(u: string): boolean {
  if (/[\s<>"']/.test(u) || u.includes('(') || u.includes(')')) return false
  if (/^https?:\/\//i.test(u)) return true
  if (/^data:image\/(png|jpe?g|gif|svg\+xml|webp|bmp);base64,/i.test(u)) return true
  if (/^(\/|\.\.\/|\.\/)/.test(u)) return true
  if (/^[A-Za-z0-9_][\w\-.]*\.(png|jpe?g|gif|svg|webp|bmp|ico)(\?.*)?$/i.test(u)) return true
  return false
}

function withBreaks(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  text.split('\n').forEach((seg, i) => {
    if (i > 0) out.push(<br key={`${keyBase}br${i}`} />)
    if (seg) out.push(seg)
  })
  return out
}

function richNodes(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const re = /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(\*\*.+?\*\*)|(\*[^*\n]+?\*)/g
  let last = 0
  let k = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(...withBreaks(text.slice(last, m.index), `${keyBase}t${k++}`))
    if (m[1] !== undefined && m[2] !== undefined && isSafeImgUrl(m[2])) {
      nodes.push(<img key={`${keyBase}i${k++}`} src={m[2]} alt={m[1]} loading="lazy" />)
    } else if (m[3] !== undefined && m[4] !== undefined) {
      nodes.push(
        <a key={`${keyBase}a${k++}`} href={m[4]} target="_blank" rel="noopener">
          {m[3]}
        </a>
      )
    } else if (m[5] !== undefined) {
      nodes.push(<strong key={`${keyBase}b${k++}`}>{m[5].slice(2, -2)}</strong>)
    } else if (m[6] !== undefined) {
      nodes.push(<em key={`${keyBase}e${k++}`}>{m[6].slice(1, -1)}</em>)
    } else {
      // Unsafe image URL — render literally instead of linking anywhere.
      nodes.push(...withBreaks(m[0], `${keyBase}x${k++}`))
    }
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(...withBreaks(text.slice(last), `${keyBase}t${k++}`))
  return nodes
}

function inlineNodes(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Code spans first so `*`, `[`, `!` inside code stay literal.
  text.split(/(`[^`\n]+`)/g).forEach((chunk, ci) => {
    if (!chunk) return
    if (chunk.length > 2 && chunk.startsWith('`') && chunk.endsWith('`')) {
      nodes.push(<code key={`${keyBase}c${ci}`}>{chunk.slice(1, -1)}</code>)
    } else {
      nodes.push(...richNodes(chunk, `${keyBase}r${ci}`))
    }
  })
  return nodes
}

// ---------------------------------------------------------------------------
// Block parsing
// ---------------------------------------------------------------------------

export type ListItemNode = { text: string; checked: boolean | null; children: ListNode[] }
export type ListNode = { ordered: boolean; items: ListItemNode[] }

export type Block =
  | { t: 'h'; level: 1 | 2 | 3 | 4; text: string }
  | { t: 'hr' }
  | { t: 'code'; lang: string; code: string }
  | { t: 'quote'; variant: string | null; title: string | null; body: string }
  | { t: 'table'; align: ('left' | 'center' | 'right')[]; head: string[]; rows: string[][] }
  | { t: 'list'; ordered: boolean; items: ListItemNode[] }
  | { t: 'p'; text: string }

const LIST_RE = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/
const CHECK_RE = /^\[([ xX])\]\s*/
const CODE_PH_RE = /^\u0000CODE(\d+)\u0000$/

function splitTableRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim())
}

function parseTable(tlines: string[]): Block | null {
  if (tlines.length < 2) return null
  const head = splitTableRow(tlines[0])
  const sep = splitTableRow(tlines[1])
  if (!head.length || sep.length !== head.length || !sep.every((c) => /^:?-{1,}:?$/.test(c))) return null
  const align = sep.map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left')) as (
    | 'left'
    | 'center'
    | 'right'
  )[]
  const rows = tlines.slice(2).map(splitTableRow)
  return { t: 'table', align, head, rows }
}

const CALLOUT_RE = /^\*\*(Note|Tip|Important|Warning|Caution)\*\*\s*:?\s*(.*)$/i

function parseQuote(qlines: string[]): Block {
  const first = qlines[0] ?? ''
  const m = first.match(CALLOUT_RE)
  if (m) {
    const rest = [m[2], ...qlines.slice(1)].filter((l) => l !== '').join('\n')
    return { t: 'quote', variant: m[1].toLowerCase(), title: m[1], body: rest }
  }
  return { t: 'quote', variant: null, title: null, body: qlines.join('\n') }
}

type RawItem = { ordered: boolean; indent: number; text: string; checked: boolean | null }

function parseListAt(raws: RawItem[], start: number, level: number): { node: ListNode; next: number } {
  const node: ListNode = { ordered: raws[start].ordered, items: [] }
  let i = start
  while (i < raws.length) {
    const r = raws[i]
    if (r.indent < level) break
    if (r.indent > level) {
      const last = node.items[node.items.length - 1]
      if (!last) {
        // Stray deep indent with no parent — degrade to this level.
        node.items.push({ text: r.text, checked: r.checked, children: [] })
        i++
        continue
      }
      const sub = parseListAt(raws, i, r.indent)
      last.children.push(sub.node)
      i = sub.next
      continue
    }
    if (r.ordered !== node.ordered) break // sibling list of the other marker type
    node.items.push({ text: r.text, checked: r.checked, children: [] })
    i++
  }
  return { node, next: i }
}

function buildLists(llines: string[]): Block[] {
  const raws: RawItem[] = llines.map((l) => {
    const m = l.match(LIST_RE)!
    const ordered = /^\d/.test(m[2])
    let text = m[3]
    let checked: boolean | null = null
    if (!ordered) {
      const cm = text.match(CHECK_RE)
      if (cm) {
        checked = cm[1].toLowerCase() === 'x'
        text = text.slice(cm[0].length)
      }
    }
    const indent = Math.floor(m[1].replace(/\t/g, '  ').length / 2)
    return { ordered, indent, text, checked }
  })
  const base = raws[0].indent
  raws.forEach((r) => {
    r.indent = Math.max(0, r.indent - base)
  })
  const out: Block[] = []
  let i = 0
  while (i < raws.length) {
    const { node, next } = parseListAt(raws, i, raws[i].indent)
    out.push({ t: 'list', ordered: node.ordered, items: node.items })
    i = next > i ? next : i + 1 // guaranteed progress
  }
  return out
}

const isBlank = (s: string) => /^\s*$/.test(s)

export function parseBlocks(src: string): Block[] {
  // Pull fenced code out first so its contents are never reinterpreted.
  const codes: { lang: string; code: string }[] = []
  const text = (src ?? '').replace(/```(\w[\w+-]*)?[ \t]*\n([\s\S]*?)(?:```|$)/g, (_m, lang, code) => {
    codes.push({ lang: (lang || '').toLowerCase(), code: (code || '').replace(/\n$/, '') })
    return `\u0000CODE${codes.length - 1}\u0000`
  })
  const lines = text.split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (isBlank(line)) {
      i++
      continue
    }
    const codePh = line.match(CODE_PH_RE)
    if (codePh) {
      const c = codes[Number(codePh[1])]
      blocks.push({ t: 'code', lang: c.lang, code: c.code })
      i++
      continue
    }
    const hm = line.match(/^(#{1,4})\s+(.*)$/)
    if (hm) {
      blocks.push({ t: 'h', level: hm[1].length as 1 | 2 | 3 | 4, text: hm[2].trim() })
      i++
      continue
    }
    if (/^\s*(---|\*\*\*\*?)\s*$/.test(line)) {
      blocks.push({ t: 'hr' })
      i++
      continue
    }
    if (/^>\s?/.test(line)) {
      const qlines: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        qlines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      blocks.push(parseQuote(qlines))
      continue
    }
    if (/^\s*\|/.test(line)) {
      const tlines: string[] = []
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        tlines.push(lines[i])
        i++
      }
      const tbl = parseTable(tlines)
      if (tbl) {
        blocks.push(tbl)
        continue
      }
      for (const tl of tlines) blocks.push({ t: 'p', text: tl })
      continue
    }
    if (LIST_RE.test(line)) {
      const llines: string[] = []
      while (i < lines.length && LIST_RE.test(lines[i])) {
        llines.push(lines[i])
        i++
      }
      blocks.push(...buildLists(llines))
      continue
    }
    // Standalone plain-text section title (blank line before/after, short,
    // uppercase start, no sentence punctuation) renders as a heading so
    // sections get visual air above them.
    const prevBlank = i === 0 || isBlank(lines[i - 1])
    const nextBlank = i + 1 >= lines.length || isBlank(lines[i + 1])
    if (
      prevBlank &&
      nextBlank &&
      /^[A-Z0-9]/.test(line) &&
      line.trim().length <= 60 &&
      !/[.!?]/.test(line)
    ) {
      blocks.push({ t: 'h', level: 3, text: line.trim() })
      i++
      continue
    }
    // Paragraph: collect until a blank line or another block construct.
    const plines: string[] = [line]
    i++
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !/^(#{1,4}\s+|>)/.test(lines[i]) &&
      !/^\s*\|/.test(lines[i]) &&
      !LIST_RE.test(lines[i]) &&
      !/^\s*(---|\*\*\*\*?)\s*$/.test(lines[i]) &&
      !CODE_PH_RE.test(lines[i]) &&
      !/^```/.test(lines[i])
    ) {
      plines.push(lines[i])
      i++
    }
    blocks.push({ t: 'p', text: plines.join('\n') })
  }
  return blocks
}

// ---------------------------------------------------------------------------
// React rendering
// ---------------------------------------------------------------------------

const LANG_LABELS: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  jsx: 'JSX',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  py: 'Python',
  python: 'Python',
  rb: 'Ruby',
  sh: 'Shell',
  shell: 'Shell',
  bash: 'Bash',
  json: 'JSON',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  php: 'PHP',
  go: 'Go',
  java: 'Java',
  c: 'C',
  yml: 'YAML',
  yaml: 'YAML',
  md: 'Markdown',
  markdown: 'Markdown',
  dockerfile: 'Dockerfile',
  plaintext: 'Text',
  text: 'Text',
  csharp: 'C#',
  'c++': 'C++',
  cpp: 'C++',
  rs: 'Rust',
  rust: 'Rust',
  kt: 'Kotlin',
  vue: 'Vue',
  graphql: 'GraphQL',
}

function langLabel(lang: string): string {
  if (!lang) return 'Code'
  return LANG_LABELS[lang] ?? lang.charAt(0).toUpperCase() + lang.slice(1)
}

export function MarkdownCodeBlock({
  lang,
  code,
  interactive = true,
}: {
  lang: string
  code: string
  interactive?: boolean
}) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // clipboard unavailable (permissions / insecure context) — stay silent
    }
  }
  return (
    <div className="md-codeblock">
      <div className="md-codeblock-head">
        <span className="md-codeblock-lang">{langLabel(lang)}</span>
        {interactive && (
          <button type="button" onClick={copy} className="md-codeblock-copy" aria-label="Copy code">
            {copied ? <Check className="md-icon" aria-hidden="true" /> : <Copy className="md-icon" aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

function renderListItems(items: ListItemNode[], keyBase: string): React.ReactNode[] {
  return items.map((it, i) => (
    <li key={`${keyBase}i${i}`} className={it.checked !== null ? 'md-check' : undefined}>
      {it.checked !== null && (
        <input type="checkbox" checked={it.checked} disabled readOnly aria-label={it.checked ? 'Done' : 'To do'} />
      )}
      <span className="md-li-text">{inlineNodes(it.text, `${keyBase}i${i}t`)}</span>
      {it.children.map((c, ci) => (
        <React.Fragment key={`${keyBase}i${i}c${ci}`}>
          {c.ordered ? <ol>{renderListItems(c.items, `${keyBase}i${i}c${ci}`)}</ol> : <ul>{renderListItems(c.items, `${keyBase}i${i}c${ci}`)}</ul>}
        </React.Fragment>
      ))}
    </li>
  ))
}

function renderBlock(b: Block, key: string, interactive: boolean): React.ReactNode {
  switch (b.t) {
    case 'h':
      return (
        <React.Fragment key={key}>
          {b.level === 1 ? (
            <h1>{inlineNodes(b.text, `${key}t`)}</h1>
          ) : b.level === 2 ? (
            <h2>{inlineNodes(b.text, `${key}t`)}</h2>
          ) : b.level === 3 ? (
            <h3>{inlineNodes(b.text, `${key}t`)}</h3>
          ) : (
            <h4>{inlineNodes(b.text, `${key}t`)}</h4>
          )}
        </React.Fragment>
      )
    case 'hr':
      return <hr key={key} />
    case 'code':
      return <MarkdownCodeBlock key={key} lang={b.lang} code={b.code} interactive={interactive} />
    case 'quote':
      return (
        <blockquote key={key} className={b.variant ? `md-callout md-${b.variant}` : undefined}>
          {b.title && <p className="md-callout-title">{b.title}</p>}
          <p>{inlineNodes(b.body, `${key}q`)}</p>
        </blockquote>
      )
    case 'table': {
      const align = (idx: number): 'left' | 'center' | 'right' => b.align[idx] ?? 'left'
      return (
        <div key={key} className="md-table-wrap">
          <table>
            <thead>
              <tr>
                {b.head.map((c, ci) => (
                  <th key={ci} style={{ textAlign: align(ci) }}>
                    {inlineNodes(c, `${key}h${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((c, ci) => (
                    <td key={ci} style={{ textAlign: align(ci) }}>
                      {inlineNodes(c, `${key}r${ri}c${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    case 'list':
      return (
        <React.Fragment key={key}>
          {b.ordered ? <ol>{renderListItems(b.items, `${key}l`)}</ol> : <ul>{renderListItems(b.items, `${key}l`)}</ul>}
        </React.Fragment>
      )
    case 'p':
      return <p key={key}>{inlineNodes(b.text, `${key}p`)}</p>
  }
}

export function MarkdownDocument({
  blocks,
  interactive = true,
}: {
  blocks: Block[]
  interactive?: boolean
}) {
  return <>{blocks.map((b, i) => renderBlock(b, `b${i}`, interactive))}</>
}

/** String API (kept for tests / non-React consumers). */
export function renderMarkdown(md: string): string {
  try {
    return renderToStaticMarkup(<MarkdownDocument blocks={parseBlocks(md ?? '')} interactive={false} />)
  } catch {
    return ''
  }
}

export function MarkdownPreview({ content }: { content: string }) {
  let body: React.ReactNode
  try {
    body = <MarkdownDocument blocks={parseBlocks(content ?? '')} />
  } catch {
    body = (
      <div className="md-render-error" role="alert">
        <p className="md-render-error-title">Unable to render the task description.</p>
        <p>You can still edit the Markdown source.</p>
      </div>
    )
  }
  return <div className="markdown-preview">{body}</div>
}
