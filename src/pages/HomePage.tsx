import AboutContent from '../components/AboutContent'
import DropPanel from '../components/DropPanel'
import ThemeToggle from '../components/ThemeToggle'
import ThreeCanvas from '../backdrop/ThreeCanvas'
import { createAuroraDust } from '../backdrop/AuroraDust'
import { footerText, heroSubtitle, heroTitle } from '../content'
import { useFileIntake } from '../useFileIntake'
import { supportedExtensions } from '../viewers'

// The whole screen is the drop target: a file dropped anywhere on the page opens, over a slow field of drifting particles.
export default function HomePage({ onFileLoaded }: { onFileLoaded: (file: File, fileContents: ArrayBuffer) => void }) {
  const intake = useFileIntake({ acceptedExtensions: supportedExtensions, onFileLoaded })

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
          <p className="type-h3">OpenAnyDoc</p>
          <ThemeToggle />
        </header>

        <main id="main" className="mx-auto max-w-5xl px-4 pb-20">
          <section className="flex min-h-[calc(100dvh-6rem)] flex-col justify-center py-8 text-center">
            <h1 className="type-h1 mx-auto max-w-3xl text-balance">{heroTitle}</h1>
            <p className="mb-8 mt-3 text-ink-soft">{heroSubtitle}</p>
            <DropPanel intake={intake} />
          </section>

          <div className="box-shape mt-12 bg-paper-raised/90 p-6 backdrop-blur-md md:p-10">
            <AboutContent />
          </div>
        </main>

        <footer className="border-t border-rule">
          <p className="mx-auto max-w-5xl px-4 py-6 text-sm text-ink-soft">{footerText}</p>
        </footer>
      </div>
    </div>
  )
}
