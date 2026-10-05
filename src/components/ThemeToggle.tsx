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
      className="min-h-11 min-w-11 cursor-pointer rounded-lg border border-ink-soft px-4 text-sm font-medium text-ink transition duration-200 hover:bg-paper-raised active:scale-[0.98]"
    >
      <span aria-hidden="true">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  )
}
