import React from 'react'

// simple safe markdown renderer (supports headings, bold, code, lists, links limited)
function escapeHtml(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

export function renderMarkdown(md: string): string {
  let html = escapeHtml(md)
  // headings
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>')
  // bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  // code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
  // links [text](url) - only http/https
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  // unordered lists
  html = html.replace(/^\- (.*)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
  // checkboxes
  html = html.replace(/\[ \]/g, '☐').replace(/\[x\]/gi, '☑')
  // line breaks
  html = html.replace(/\n/g, '<br/>')
  return html
}

export function MarkdownPreview({ content }: { content: string }) {
  return <div className="markdown-preview" dangerouslySetInnerHTML={{__html: renderMarkdown(content)}} />
}
