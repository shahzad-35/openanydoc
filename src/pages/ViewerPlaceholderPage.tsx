export default function ViewerPlaceholderPage({ viewerLabel }: { viewerLabel: string }) {
  return (
    <>
      <h1 className="font-display text-5xl font-medium tracking-[-0.02em] sm:text-6xl">{viewerLabel} viewer</h1>
      <p className="mt-6 max-w-[65ch] text-lg leading-relaxed text-ink-soft">
        Coming soon. Files you open here will be processed in your browser and never uploaded.
      </p>
    </>
  )
}
