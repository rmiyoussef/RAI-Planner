import React from 'react'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function renderMarkdown(md: string): string {
  if (!md) return ''
  let html = escapeHtml(md)

  // Code blocks first (before inline code)
  html = html.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_m, lang, code) => {
    const cls = lang ? ` class="language-${lang}"` : ''
    return `<pre><code${cls}>${code.trim()}</code></pre>`
  })
  // Headings
  html = html.replace(/^#### (.*)$/gm, '<h4>$1</h4>')
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>')
  // Horizontal rule
  html = html.replace(/^\s*---\s*$/gm, '<hr />')
  html = html.replace(/^\s*\*\*\*\s*$/gm, '<hr />')
  // Blockquote
  html = html.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>')
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '<br/>')
  // Bold + Italic (bold first)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Links [text](url) - only http/https
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  // Tables: detect markdown table rows
  html = html.replace(
    /((?:^\|.*\|.*\n)+)/gm,
    (match) => {
      const rows = match.trim().split('\n').filter(Boolean)
      if (rows.length < 2) return match
      // Check if second row is separator
      const isSeparator = /^\|[\s-|:]+\|/.test(rows[1])
      const headerRows = isSeparator ? [rows[0]] : []
      const bodyRows = isSeparator ? rows.slice(2) : rows
      let out = '<table>'
      if (headerRows.length) {
        const headers = headerRows[0]
          .split('|')
          .filter(Boolean)
          .map((c) => `<th>${c.trim()}</th>`)
          .join('')
        out += `<thead><tr>${headers}</tr></thead>`
      }
      if (bodyRows.length) {
        out += '<tbody>'
        for (const row of bodyRows) {
          const cells = row
            .split('|')
            .filter(Boolean)
            .map((c) => `<td>${c.trim()}</td>`)
            .join('')
          out += `<tr>${cells}</tr>`
        }
        out += '</tbody>'
      }
      out += '</table>'
      return out
    }
  )
  // Unordered lists: - item, * item, • item
  html = html.replace(/^[ \t]*[-*] (.*)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
  // Ordered lists: 1. item
  html = html.replace(/^[ \t]*\d+\. (.*)$/gm, '<li>$1</li>')
  // Checkboxes
  html = html.replace(/\[ \]/g, '☐').replace(/\[x\]/gi, '☑')
  // Line breaks (but not inside pre/code/table)
  html = html.replace(/\n/g, '<br/>')

  // Clean up: remove <br/> inside <pre>, <table>, <ul> boundaries
  html = html.replace(/<pre>([\s\S]*?)<\/pre>/g, (m, c) => m.replace(/<br\/>/g, '\n'))
  html = html.replace(/<table>([\s\S]*?)<\/table>/g, (m, c) => m.replace(/<br\/>/g, ''))
  // Stray breaks around block elements create phantom blank lines
  // (e.g. the newline after "# title" became margin + an extra empty line)
  html = html.replace(/(<\/(?:h1|h2|h3|h4|blockquote|ul|ol|table|pre)>|<hr\s*\/>)\s*<br\/>/g, '$1')
  html = html.replace(/<br\/>\s*(<(?:h1|h2|h3|h4|blockquote|ul|ol|table|hr|pre)[\s>])/g, '$1')
  // Breaks between list items are list spacing, not extra lines
  html = html.replace(/(<\/li>)\s*<br\/>\s*(<li>)/g, '$1$2')
  // Collapse 3+ consecutive breaks (extra blank lines) into a single blank line
  html = html.replace(/(<br\/>\s*){3,}/g, '<br/><br/>')
  // No leading/trailing blank lines
  html = html.replace(/^(<br\/>\s*)+/, '').replace(/(<br\/>\s*)+$/, '')

  return html
}

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <div
      className="markdown-preview prose prose-sm max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  )
}
