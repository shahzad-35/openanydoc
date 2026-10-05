import FileDropZone from '../components/FileDropZone'
import type { Viewer } from '../viewers'

export default function ViewerPlaceholderPage({ viewer }: { viewer: Viewer }) {
  return (
    <>
      <h1 className="font-display text-5xl font-medium tracking-[-0.02em] sm:text-6xl">{viewer.label} viewer</h1>
      <p className="mt-6 max-w-[65ch] text-lg leading-relaxed text-ink-soft">
        Previewing is coming soon. Files you open here are read in your browser and never uploaded.
      </p>
      <div className="mt-10 max-w-3xl">
        <FileDropZone acceptedExtensions={viewer.extensions} acceptsPastedText={viewer.acceptsPastedText} />
      </div>
    </>
  )
}
