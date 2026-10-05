import { Link, NavLink, Outlet } from 'react-router-dom'
import { viewers } from '../viewers'
import ThemeToggle from './ThemeToggle'

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-blue-700 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header className="border-b border-slate-300 dark:border-slate-700">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3">
          <Link to="/" className="text-xl font-bold">
            OpenAnyDoc
          </Link>
          <nav aria-label="Viewers" className="order-last w-full sm:order-none sm:w-auto">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {viewers.map((viewer) => (
                <li key={viewer.path}>
                  <NavLink
                    to={viewer.path}
                    className="font-medium text-blue-700 underline-offset-4 hover:underline aria-[current=page]:text-slate-900 aria-[current=page]:underline dark:text-blue-300 dark:aria-[current=page]:text-slate-50"
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

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <Outlet />
      </main>

      <footer className="border-t border-slate-300 dark:border-slate-700">
        <p className="mx-auto max-w-5xl px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
          OpenAnyDoc is free. Your files never leave your device.
        </p>
      </footer>
    </div>
  )
}
