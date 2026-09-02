export type Theme = 'light' | 'dark'

export function getStoredTheme(): Theme {
  try {
    const t = localStorage.getItem('rai-theme') as Theme | null
    if (t === 'dark' || t === 'light') return t
  } catch {}
  return 'light'
}

export function setStoredTheme(theme: Theme) {
  localStorage.setItem('rai-theme', theme)
  if (theme === 'dark') document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')
}
