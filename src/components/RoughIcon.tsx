import { useEffect, useRef } from 'react'
import type rough from 'roughjs'

export type RoughSketch = ReturnType<typeof rough.svg>

type RoughIconProps = {
  drawShapes: (sketch: RoughSketch, roughness: number) => SVGElement[]
  viewBox?: string
  className?: string
}

const DEFAULT_ROUGHNESS = 1.2

// Rough.js is fetched by the first icon after the page has appeared, so the first load does not wait for it.
let roughLibrary: Promise<typeof rough> | null = null

export default function RoughIcon({ drawShapes, viewBox = '0 0 24 24', className }: RoughIconProps) {
  const iconRef = useRef<SVGSVGElement>(null)

  // Redraws on every render: the icon is tiny, and its shapes and wobble follow the current design.
  useEffect(() => {
    let isCurrent = true
    function drawIcon(library: typeof rough) {
      const icon = iconRef.current
      if (!icon || !isCurrent) return
      const designRoughness = Number.parseFloat(getComputedStyle(icon).getPropertyValue('--icon-roughness'))
      const roughness = Number.isNaN(designRoughness) ? DEFAULT_ROUGHNESS : designRoughness
      icon.replaceChildren(...drawShapes(library.svg(icon), roughness))
    }
    roughLibrary ??= import('roughjs').then((roughModule) => roughModule.default)
    void roughLibrary.then(drawIcon)
    return () => {
      isCurrent = false
    }
  })

  return <svg ref={iconRef} aria-hidden="true" viewBox={viewBox} className={className} fill="none" />
}
