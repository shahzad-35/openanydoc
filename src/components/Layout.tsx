import { Link, NavLink, Outlet } from 'react-router-dom'
import { viewers } from '../viewers'
import ThemeToggle from './ThemeToggle'

export default function Layout() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>

      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-4">
          <Link to="/" className="font-display text-2xl font-semibold tracking-[-0.02em]">
            OpenAnyDoc
          </Link>
          <nav aria-label="Viewers" className="order-last w-full sm:order-none sm:w-auto">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {viewers.map((viewer) => (
                <li key={viewer.path}>
                  <NavLink
                    to={viewer.path}
                    className="inline-flex min-h-11 items-center font-medium text-ink-soft decoration-accent decoration-2 underline-offset-8 transition-colors duration-200 hover:text-accent aria-[current=page]:text-ink aria-[current=page]:underline"
                  >
                    {viewer.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pb-24 pt-14 sm:pt-24">
        <Outlet />
      </main>

      <footer className="border-t border-rule">
        <p className="mx-auto max-w-6xl px-5 py-6 text-sm text-ink-soft">
          OpenAnyDoc is free. Your files never leave your device.
        </p>
      </footer>
    </div>
  )
}
