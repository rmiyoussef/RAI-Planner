export type Theme = 'light' | 'dark'

export function getStoredTheme(): Theme {
  try {
    const t = localStorage.getItem('rai-theme') as Theme | null
    if (t === 'dark' || t === 'light') return t
    // system preference on first visit
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch {}
  return 'light'
}

export function applyTheme(theme: Theme) {
  if (theme === 'dark') document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')
  try { document.documentElement.style.colorScheme = theme } catch {}
}

export function setStoredTheme(theme: Theme) {
  try { localStorage.setItem('rai-theme', theme) } catch {}
  applyTheme(theme)
}

// keep in sync with system when no explicit choice
export function initTheme(): Theme {
  const stored = (() => {
    try { return localStorage.getItem('rai-theme') as Theme | null } catch { return null }
  })()
  const theme: Theme = stored === 'dark' || stored === 'light' ? stored : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  applyTheme(theme)
  return theme
}
