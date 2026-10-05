import type { Viewer } from '../viewers'

export default function FileTypeChip({ viewer }: { viewer: Viewer }) {
  return (
    <span
      data-file-type={viewer.id}
      className="control-shape inline-flex items-center bg-(--file-color) px-3 py-0.5 text-sm font-medium text-on-accent"
    >
      {viewer.label}
    </span>
  )
}
