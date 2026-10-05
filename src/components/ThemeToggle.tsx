import { useState } from 'react'
import RoughIcon from './RoughIcon'
import type { RoughSketch } from './RoughIcon'

const MOON_PATH = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'

function getSketchOptions(roughness: number) {
  return { seed: 5, roughness, strokeWidth: 1.6, stroke: 'currentColor' }
}

function drawSun(sketch: RoughSketch, roughness: number) {
  const options = getSketchOptions(roughness)
  const rays = Array.from({ length: 8 }, (_, rayIndex) => {
    const angle = (rayIndex * Math.PI) / 4
    return sketch.line(
      12 + 8 * Math.cos(angle),
      12 + 8 * Math.sin(angle),
      12 + 11.5 * Math.cos(angle),
      12 + 11.5 * Math.sin(angle),
      options,
    )
  })
  return [sketch.circle(12, 12, 10, options), ...rays]
}

function drawMoon(sketch: RoughSketch, roughness: number) {
  return [sketch.path(MOON_PATH, getSketchOptions(roughness))]
}

// `compact` is for the file page: smaller on a mouse, still 44px on touch screens.
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
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

  // The icon shows the mode a click switches to: a sun while dark, a moon while light.
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`control-shape solid-box grid cursor-pointer place-items-center ${compact ? 'min-h-9 min-w-9 pointer-coarse:min-h-11 pointer-coarse:min-w-11' : 'min-h-11 min-w-11'} border-ink bg-paper text-ink transition-colors duration-200 hover:bg-paper-raised active:scale-[0.98]`}
    >
      <RoughIcon drawShapes={isDark ? drawSun : drawMoon} className={`${compact ? 'size-5 pointer-coarse:size-7' : 'size-7'} overflow-visible`} />
    </button>
  )
}
