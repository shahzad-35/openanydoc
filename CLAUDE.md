# OpenAnyDoc

Name: **OpenAnyDoc**. Use lowercase `openanydoc` for the repo, the Cloudflare Pages project, and the domain.

## What it is
A free, privacy-first viewer for CSV, Excel, Word, and PowerPoint files. All files are processed in the browser and never uploaded.

## Stack
- Vite + React + TypeScript + Tailwind
- CSV: PapaParse
- Excel: SheetJS (installed from cdn.sheetjs.com, not npm)
- Word: docx-preview
- PowerPoint: pptx-preview

## Hosting
- Code: GitHub (repo `openanydoc`)
- Deploy: Cloudflare Pages (project `openanydoc`)
- Domain: openanydoc.com (not bought yet)

## Routes
- `/` — home
- `/csv-viewer`
- `/excel-viewer`
- `/word-viewer`
- `/pptx-viewer`

## Decisions log
<!-- One line per entry: YYYY-MM-DD — decision -->
- 2026-10-05 — Tailwind v4 via `@tailwindcss/vite` (no config file).
- 2026-10-05 — Routing with `react-router-dom` (`BrowserRouter`); the viewer list lives in `src/viewers.ts` and drives both the nav and the home cards.
- 2026-10-05 — Dark mode is class-based (`.dark` on `<html>`), follows the OS by default, choice saved in `localStorage`.
- 2026-10-05 — One `ViewerPlaceholderPage` component serves all four viewer routes until real viewers are built.

## How to work with me
- Whenever we make or change a decision (library, name, structure, feature scope), add a dated one-line entry to the Decisions log and update the relevant section above.
- When I say "wrap up", first teach me what I learned in this session: 3-5 short bullets in plain language, each covering a concept or tool we used, why we did it that way, and one thing to try or read next. Then add an entry for this week to LOG.md with three lines: Built, Hard, Learned, based on what we did in this session. Use the recap to propose the "Learned" line, and ask me to confirm or correct it.
- Never put real customer or work data in this project.
