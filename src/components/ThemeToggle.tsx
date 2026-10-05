import { useState } from 'react'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  function toggleTheme() {
    const nextIsDark = !isDark
    document.documentElement.classList.toggle('dark', nextIsDark)
    try {
      localStorage.setItem('theme', nextIsDark ? 'dark' : 'light')
    } catch {
      // Storage can be blocked; the theme still applies for this visit.
    }
    setIsDark(nextIsDark)
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="rounded-md border border-slate-400 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-50 dark:hover:bg-slate-800"
    >
      <span aria-hidden="true">{isDark ? '☀️ Light' : '🌙 Dark'}</span>
    </button>
  )
}
