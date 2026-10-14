import type { Viewer } from '../viewers'

// `label` replaces the viewer's name when the file is a more specific kind, e.g. TSV inside the table viewer.
export default function FileTypeChip({ viewer, label = viewer.label }: { viewer: Viewer; label?: string }) {
  return (
    <span
      data-file-type={viewer.id}
      className="control-shape inline-flex items-center bg-(--file-color) px-3 py-0.5 text-sm font-medium text-on-accent"
    >
      {label}
    </span>
  )
}
