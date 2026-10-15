// The look of the changelog page, shared by the React page (ChangelogPage.tsx) and the build script that writes the same page as
// plain HTML (scripts/build-static-pages.mjs). Tailwind only generates the classes it finds in src/, so they live here.

export const changelogClasses = {
  page: 'min-h-dvh bg-paper font-sans text-[18px] leading-normal text-ink',
  header: 'mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-5',
  brandLink: 'type-h3 hover:text-accent',
  languageLink: 'control-shape solid-box border-rule bg-paper-raised/80 px-4 py-1 text-sm font-medium transition-colors duration-200 hover:bg-paper-raised',
  main: 'mx-auto max-w-3xl px-4 pb-24',
  intro: 'py-8 md:py-12',
  heading: 'type-h1 text-balance',
  introText: 'mt-4 max-w-2xl text-ink-soft',
  timeline: 'relative mt-4 space-y-8 border-s-2 border-rule ps-6 md:ps-8',
  entry: 'relative',
  dot: 'absolute -start-[1.95rem] top-7 size-3 rounded-full bg-(--file-color) ring-4 ring-paper md:-start-[2.45rem]',
  card: 'box-shape solid-box border-rule bg-paper-raised/90 p-6 backdrop-blur-md md:p-8',
  meta: 'flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft',
  versionPill: 'control-shape bg-(--file-color) px-3 py-0.5 font-medium text-on-accent',
  entryTitle: 'type-h3 mt-3',
  items: 'mt-4 space-y-2',
  item: 'flex items-start gap-3',
  checkIcon: 'mt-1.5 size-4 shrink-0 text-(--file-color)',
  tryIt: 'mt-5 flex flex-wrap items-center gap-2 text-sm',
  tryItLabel: 'text-ink-soft',
  formatLink: 'control-shape solid-box inline-flex items-center border-rule px-3 py-1 font-medium transition-colors duration-200 hover:bg-paper',
  backLink: 'mt-12 inline-block text-sm underline underline-offset-2 hover:text-accent',
} as const

// A check mark, drawn inside a 24 x 24 box.
export const CHECK_ICON_PATH = 'm5 13 4 4L19 7'
