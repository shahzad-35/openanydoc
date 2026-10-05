export default function ViewerPlaceholderPage({ viewerLabel }: { viewerLabel: string }) {
  return (
    <>
      <h1 className="text-3xl font-bold">{viewerLabel} viewer</h1>
      <p className="mt-4 text-slate-700 dark:text-slate-300">
        Coming soon. Files you open here will be processed in your browser and never uploaded.
      </p>
    </>
  )
}
