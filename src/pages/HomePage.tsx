import { useEffect } from 'react'
import type { ReactNode } from 'react'
import AboutContent from '../components/AboutContent'
import DropPanel from '../components/DropPanel'
import ThemeToggle from '../components/ThemeToggle'
import ThreeCanvas from '../backdrop/ThreeCanvas'
import { createAuroraDust } from '../backdrop/AuroraDust'
import { footerText, heroSubtitle, heroTitle } from '../content'
import { useFileIntake } from '../useFileIntake'
import { supportedExtensions, viewers } from '../viewers'
import type { Viewer } from '../viewers'

const pagesWithOwnAddress = viewers.filter((viewer) => viewer.toolPath)

// A link that changes the page without reloading (the app has no router package); modified clicks open a new tab as usual.
function PageLink({ path, onNavigate, children }: { path: string; onNavigate: (path: string) => void; children: ReactNode }) {
  return (
    <a
      href={path}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
        event.preventDefault()
        onNavigate(path)
      }}
      className="underline underline-offset-2 hover:text-ink"
    >
      {children}
    </a>
  )
}

// The whole screen is the drop target: a file dropped anywhere on the page opens, over a slow field of drifting particles.
// With `toolViewer` it is that format's own page (/json-viewer ...): the same screen for one format.
export default function HomePage({
  onFileLoaded,
  onNavigate,
  toolViewer,
}: {
  onFileLoaded: (file: File, fileContents: ArrayBuffer) => void
  onNavigate: (path: string) => void
  toolViewer?: Viewer
}) {
  const intake = useFileIntake({ acceptedExtensions: toolViewer?.extensions ?? supportedExtensions, onFileLoaded })

  // Each format's page gets its own title and description for search results and browser tabs.
  useEffect(() => {
    if (!toolViewer) return
    const previousTitle = document.title
    const descriptionTag = document.querySelector('meta[name="description"]')
    const previousDescription = descriptionTag?.getAttribute('content') ?? ''
    document.title = `${toolViewer.label} viewer and editor online – OpenAnyDoc`
    descriptionTag?.setAttribute('content', `Open, view and edit ${toolViewer.label} files in your browser. Free and private: your file is never uploaded.`)
    return () => {
      document.title = previousTitle
      descriptionTag?.setAttribute('content', previousDescription)
    }
  }, [toolViewer])

  return (
    <div {...intake.dropTargetProps} className="relative min-h-dvh bg-paper font-sans text-[18px] leading-normal text-ink">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
        <ThreeCanvas createScene={createAuroraDust} className="h-full w-full" />
      </div>
      {intake.isDraggingOver && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-3 z-20 box-shape border-2 border-dashed border-accent" />
      )}

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>

      <div className="relative z-10">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
          <p className="type-h3">{toolViewer ? <PageLink path="/" onNavigate={onNavigate}>OpenAnyDoc</PageLink> : 'OpenAnyDoc'}</p>
          <ThemeToggle />
        </header>

        <main id="main" className="mx-auto max-w-5xl px-4 pb-20">
          <section className="flex min-h-[calc(100dvh-6rem)] flex-col justify-center py-8 text-center">
            <h1 className="type-h1 mx-auto max-w-3xl text-balance">{toolViewer ? `${toolViewer.label} viewer and editor` : heroTitle}</h1>
            <p className="mb-8 mt-3 text-ink-soft">{toolViewer ? `${toolViewer.description} ${heroSubtitle}` : heroSubtitle}</p>
            <DropPanel intake={intake} shownViewers={toolViewer ? [toolViewer] : viewers} />
          </section>

          <div className="box-shape mt-12 bg-paper-raised/90 p-6 backdrop-blur-md md:p-10">
            <AboutContent />
          </div>
        </main>

        <footer className="border-t border-rule">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-ink-soft">
            <p>{footerText}</p>
            <nav aria-label="File viewers" className="flex flex-wrap gap-x-4 gap-y-1">
              {toolViewer && (
                <PageLink path="/" onNavigate={onNavigate}>
                  All file types
                </PageLink>
              )}
              {pagesWithOwnAddress
                .filter((viewer) => viewer !== toolViewer)
                .map((viewer) => (
                  <PageLink key={viewer.id} path={viewer.toolPath as string} onNavigate={onNavigate}>
                    {viewer.label} viewer
                  </PageLink>
                ))}
            </nav>
          </div>
        </footer>
      </div>
    </div>
  )
}
