import { useEffect, useRef } from 'react'
import rough from 'roughjs'

export type RoughSketch = ReturnType<typeof rough.svg>

type RoughIconProps = {
  drawShapes: (sketch: RoughSketch, roughness: number) => SVGElement[]
  viewBox?: string
  className?: string
}

const DEFAULT_ROUGHNESS = 1.2

export default function RoughIcon({ drawShapes, viewBox = '0 0 24 24', className }: RoughIconProps) {
  const iconRef = useRef<SVGSVGElement>(null)

  // Redraws on every render: the icon is tiny, and its shapes and wobble follow the current design.
  useEffect(() => {
    const icon = iconRef.current
    if (!icon) return
    const designRoughness = Number.parseFloat(getComputedStyle(icon).getPropertyValue('--icon-roughness'))
    const roughness = Number.isNaN(designRoughness) ? DEFAULT_ROUGHNESS : designRoughness
    icon.replaceChildren(...drawShapes(rough.svg(icon), roughness))
  })

  return <svg ref={iconRef} aria-hidden="true" viewBox={viewBox} className={className} fill="none" />
}
