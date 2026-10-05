import { Link } from 'react-router-dom'
import { viewers } from '../viewers'

export default function HomePage() {
  return (
    <>
      <section className="mb-12 text-center">
        <h1 className="text-3xl font-bold sm:text-5xl">
          View CSV, Excel, Word and PowerPoint files online — free, instant, private.
        </h1>
        <p className="mt-4 text-lg text-slate-700 dark:text-slate-300">
          Your files never leave your device.
        </p>
      </section>

      <section aria-labelledby="viewers-heading">
        <h2 id="viewers-heading" className="sr-only">
          Choose a viewer
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {viewers.map((viewer) => (
            <li key={viewer.path}>
              <Link
                to={viewer.path}
                className="block h-full rounded-lg border border-slate-300 bg-slate-50 p-5 hover:border-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-300"
              >
                <span className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                  {viewer.label} viewer
                </span>
                <span className="mt-2 block text-slate-700 dark:text-slate-300">
                  {viewer.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
