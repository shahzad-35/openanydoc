import { Link } from 'react-router-dom'
import { viewers } from '../viewers'

export default function HomePage() {
  return (
    <>
      <section className="mb-16 max-w-4xl animate-rise sm:mb-24">
        <h1 className="text-balance font-display text-5xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-7xl">
          View CSV, Excel, Word and PowerPoint files online — free, instant, private.
        </h1>
        <p className="mt-8 max-w-[65ch] text-lg leading-relaxed text-ink-soft">
          Your files never leave your device.
        </p>
      </section>

      <section aria-labelledby="viewers-heading">
        <h2 id="viewers-heading" className="sr-only">
          Choose a viewer
        </h2>
        <ul className="border-b border-rule">
          {viewers.map((viewer) => (
            <li key={viewer.path} className="border-t border-rule">
              <Link
                to={viewer.path}
                className="group grid gap-x-8 gap-y-2 px-2 py-7 transition-colors duration-200 hover:bg-paper-raised sm:grid-cols-[9rem_1fr_auto] sm:items-baseline"
              >
                <span className="font-mono text-sm text-ink-soft">{viewer.extensions.join('  ')}</span>
                <span>
                  <span className="block font-display text-3xl font-medium tracking-[-0.01em]">
                    {viewer.label} viewer
                  </span>
                  <span className="mt-2 block max-w-[55ch] text-ink-soft">{viewer.description}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 pt-1 font-medium text-accent">
                  Open
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="about" aria-labelledby="about-heading" className="mt-24 grid gap-x-16 gap-y-10 lg:grid-cols-[1fr_2fr]">
        <div>
          <h2 id="about-heading" className="font-display text-4xl font-medium tracking-[-0.02em]">
            About OpenAnyDoc
          </h2>
          <p className="mt-4 max-w-[45ch] leading-relaxed text-ink-soft">
            OpenAnyDoc opens CSV, Excel, Word and PowerPoint files in your browser. Pick a file, read it, close the tab.
          </p>
        </div>

        <div className="space-y-12">
          <div>
            <h3 className="font-display text-2xl font-medium">Private by design</h3>
            <p className="mt-3 max-w-[65ch] leading-relaxed text-ink-soft">
              Many online viewers send your file to a server before showing it. OpenAnyDoc does not. Your browser reads the
              file and displays it on your own screen, and the file is never uploaded anywhere.
            </p>
          </div>

          <div>
            <h3 className="font-display text-2xl font-medium">How it works</h3>
            <ol className="mt-3 max-w-[65ch] list-decimal space-y-2 pl-5 leading-relaxed text-ink-soft marker:text-ink">
              <li>Choose a file from your device.</li>
              <li>Your browser reads it locally. Nothing is sent over the network.</li>
              <li>The contents appear on the page. Close the tab and nothing is kept.</li>
            </ol>
          </div>

          <div>
            <h3 className="font-display text-2xl font-medium">Supported files</h3>
            <ul className="mt-3 grid max-w-[65ch] gap-2 text-ink-soft sm:grid-cols-2">
              {viewers.map((viewer) => (
                <li key={viewer.path}>
                  {viewer.label}: <span className="font-mono text-sm">{viewer.extensions.join('  ')}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-display text-2xl font-medium">Questions</h3>
            <dl className="mt-3 max-w-[65ch] divide-y divide-rule border-y border-rule">
              <div className="py-4">
                <dt className="font-medium">Is OpenAnyDoc free?</dt>
                <dd className="mt-1 leading-relaxed text-ink-soft">Yes.</dd>
              </div>
              <div className="py-4">
                <dt className="font-medium">Does my file leave my device?</dt>
                <dd className="mt-1 leading-relaxed text-ink-soft">
                  No. Files are opened and displayed by your browser only.
                </dd>
              </div>
              <div className="py-4">
                <dt className="font-medium">Can I edit my file here?</dt>
                <dd className="mt-1 leading-relaxed text-ink-soft">
                  No. OpenAnyDoc is a viewer. It shows your file and does not change or save it.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </>
  )
}
