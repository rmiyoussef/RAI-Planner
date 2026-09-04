import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MarkdownPreview, parseBlocks, renderMarkdown } from '../components/Markdown'

function html(content: string): string {
  const { container } = render(<MarkdownPreview content={content} />)
  return container.innerHTML
}

describe('MarkdownDocument parser', () => {
  it('renders headings, bold, paragraphs', () => {
    const out = html('# Title\n\nBody with **bold** and *italic*.')
    expect(out).toContain('<h1>')
    expect(out).toContain('<strong>bold</strong>')
    expect(out).toContain('<em>italic</em>')
  })

  it('renders nested unordered lists with depth', () => {
    const out = html('- Backend\n  - FastAPI\n    - Deep\n- Frontend')
    const lis = out.match(/<li/g) ?? []
    expect(lis.length).toBe(4)
    expect(out).toContain('<ul>')
    // nested <ul> inside a parent <li>
    expect(out).toMatch(/<li[^>]*>.*<ul>/s)
  })

  it('wraps ordered lists in <ol>', () => {
    const out = html('1. First\n2. Second')
    expect(out).toContain('<ol>')
    expect(out.match(/<li/g)?.length).toBe(2)
  })

  it('renders checklists as read-only checkboxes', () => {
    const out = html('- [ ] todo\n- [x] done')
    expect(out).toContain('type="checkbox"')
    expect(out).toContain('disabled')
    expect(out).toContain('checked')
    expect(out).not.toContain('☐')
  })

  it('renders fenced code with language label and copy button', () => {
    const out = html('```typescript\nconst a = 1;\n```')
    expect(out).toContain('TypeScript')
    expect(out).toContain('Copy')
    expect(out).toContain('const a = 1;')
  })

  it('renders tables with alignment', () => {
    const out = html('| A | B |\n| --- | ---: |\n| 1 | 2 |')
    expect(out).toContain('<table>')
    expect(out).toContain('<th')
    expect(out).toContain('text-align: right')
  })

  it('renders safe images and drops javascript: URLs', () => {
    const good = html('![alt](https://example.com/a.png)')
    expect(good).toContain('<img')
    expect(good).toContain('https://example.com/a.png')
    const bad = html('![x](javascript:alert(1))')
    expect(bad).not.toContain('<img')
  })

  it('detects standalone section titles as h3', () => {
    const blocks = parseBlocks('Intro line.\n\nProblem\n\nBody here.')
    expect(blocks.some((b) => b.t === 'h' && b.level === 3 && b.text === 'Problem')).toBe(true)
  })

  it('styles Note callouts without inventing syntax', () => {
    const out = html('> **Note**\n> Async operation.')
    expect(out).toContain('md-note')
    expect(out).toContain('Note')
    expect(out).toContain('Async operation.')
  })

  it('escapes raw HTML', () => {
    const out = html('<script>alert(1)</script>')
    expect(out).not.toContain('<script>')
  })

  it('renderMarkdown keeps the legacy string contract', () => {
    const out = renderMarkdown('# Hello\n**bold**')
    expect(out).toContain('<h1>Hello</h1>')
    expect(out).toContain('<strong>bold</strong>')
  })
})
