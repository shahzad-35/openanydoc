import { useEffect, useRef } from 'react'
import { WebGLRenderer } from 'three'
import type { SceneColors, SceneFactory } from './sceneTypes'
import { useIsDarkTheme } from './useIsDarkTheme'

const FILE_COLOR_NAMES = ['--type-csv', '--type-excel', '--type-word', '--type-pdf', '--type-powerpoint']

function readSceneColors(element: HTMLElement, isDark: boolean): SceneColors {
  const style = getComputedStyle(element)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    isDark,
    paperRaised: read('--paper-raised', '#ffffff'),
    ink: read('--ink', '#111111'),
    inkSoft: read('--ink-soft', '#666666'),
    accent: read('--accent', '#3355ff'),
    fileColors: FILE_COLOR_NAMES.map((name) => read(name, '#888888')),
  }
}

// Draws one Three.js scene into a transparent canvas that fills its container. It is decorative: hidden from screen
// readers, a single still frame under reduced motion, paused while off-screen or in a background tab, and rebuilt when
// the theme changes so the colors follow.
export default function ThreeCanvas({ createScene, className }: { createScene: SceneFactory; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDark = useIsDarkTheme()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      return // No WebGL on this device: the page works the same, just without the scene.
    }
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    const canvas = renderer.domElement
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    container.appendChild(canvas)

    const scene = createScene(renderer, readSceneColors(container, isDark))
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const pointer = { x: 0, y: 0 }
    const startTime = performance.now()
    let isVisible = true
    let animationFrameId = 0

    function drawFrame() {
      scene.render(prefersReducedMotion ? 0 : (performance.now() - startTime) / 1000, pointer)
    }

    function loop() {
      animationFrameId = 0
      if (!isVisible || document.hidden) return
      drawFrame()
      animationFrameId = requestAnimationFrame(loop)
    }

    function startLoop() {
      if (!prefersReducedMotion && animationFrameId === 0) animationFrameId = requestAnimationFrame(loop)
    }

    function resize() {
      const { width, height } = container!.getBoundingClientRect()
      if (width === 0 || height === 0) return
      renderer.setSize(width, height, false)
      scene.resize(width, height)
      drawFrame()
    }

    function updatePointer(event: PointerEvent) {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.y = -((event.clientY / window.innerHeight) * 2 - 1)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting
      if (isVisible) startLoop()
    })
    visibilityObserver.observe(container)
    window.addEventListener('pointermove', updatePointer)
    document.addEventListener('visibilitychange', startLoop)
    resize()
    startLoop()

    return () => {
      cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
      visibilityObserver.disconnect()
      window.removeEventListener('pointermove', updatePointer)
      document.removeEventListener('visibilitychange', startLoop)
      scene.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    }
  }, [createScene, isDark])

  return <div ref={containerRef} className={className} />
}
