import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// minimal smoke tests per spec: verify theme, markdown, etc.
import { renderMarkdown } from '../components/Markdown'
import { getStoredTheme } from '../utils/theme'

describe('RAI Planner frontend', () => {
  it('markdown renderer escapes html', () => {
    const html = renderMarkdown('# Hello\n**bold**')
    expect(html).toContain('<h1>Hello</h1>')
    expect(html).toContain('<strong>bold</strong>')
  })
  it('markdown escapes unsafe html', () => {
    const html = renderMarkdown('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
  })
  it('theme defaults to light', () => {
    localStorage.clear()
    expect(getStoredTheme()).toBe('light')
  })
})
