// The look of the changelog page and the site footer, shared by the React components and the build script that writes the same page as
// plain HTML (scripts/build-static-pages.mjs). Tailwind only generates the classes it finds in src/, so they live here.

// Stable ids for the page's parts; a release is "release-1-3-0".
export const changelogIds = {
  page: 'changelog-page',
  header: 'changelog-header',
  brandLink: 'changelog-brand-link',
  languageLink: 'language-switch-link',
  main: 'main',
  heading: 'changelog-heading',
  intro: 'changelog-intro',
  timeline: 'changelog-timeline',
  backLink: 'changelog-home-link',
  release: (version: string) => `release-${version.replaceAll('.', '-')}`,
  releaseTitle: (version: string) => `release-${version.replaceAll('.', '-')}-title`,
  tryFormat: (version: string, viewerId: string) => `release-${version.replaceAll('.', '-')}-try-${viewerId}`,
} as const

export const changelogClasses = {
  page: 'min-h-dvh bg-paper font-sans text-[18px] leading-normal text-ink',
  header: 'mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-5',
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
  backLink: 'mt-12 inline-block text-sm underline underline-offset-2 hover:text-accent pointer-coarse:py-3',
} as const

// A check mark, drawn inside a 24 x 24 box.
export const CHECK_ICON_PATH = 'm5 13 4 4L19 7'

// The header's links to the viewer pages (src/components/SiteNav.tsx), on every content page; the build script writes the same nav
// into the changelog pages. On a phone the links fold into one disclosure on a row of their own; from md up the disclosure's
// content is always shown (::details-content) and its summary hidden.
export const navClasses = {
  nav: 'order-last w-full md:order-none md:w-auto',
  details: 'group md:[&::details-content]:[content-visibility:visible]',
  summary: 'control-shape solid-box inline-flex min-h-11 cursor-pointer list-none items-center gap-2 border-rule bg-paper-raised/80 px-4 text-sm font-medium md:hidden [&::-webkit-details-marker]:hidden',
  chevron: 'size-4 transition-transform duration-200 group-open:rotate-180',
  list: 'mt-2 flex flex-col md:mt-0 md:flex-row md:gap-x-5',
  link: 'inline-block py-1 text-ink-soft underline-offset-2 hover:text-ink hover:underline aria-[current=page]:font-semibold aria-[current=page]:text-ink pointer-coarse:py-3',
} as const

// A downward chevron, drawn inside a 24 x 24 box.
export const CHEVRON_ICON_PATH = 'm6 9 6 6 6-6'

// The site footer (src/components/SiteFooter.tsx). The build script writes the same footer as HTML into the changelog pages.
export const footerClasses = {
  footer: 'border-t border-rule bg-paper-raised/80 backdrop-blur-md',
  columns: 'mx-auto grid max-w-5xl gap-8 px-4 pt-10 pb-6 text-sm md:grid-cols-[2fr_1fr_1fr_1fr]',
  brand: 'type-h3',
  text: 'mt-2 max-w-xs text-ink-soft',
  heading: 'font-semibold',
  list: 'mt-3 space-y-2',
  item: 'flex items-center',
  link: 'text-ink-soft underline-offset-2 hover:text-ink hover:underline pointer-coarse:inline-block pointer-coarse:py-3',
  disclaimer: 'mx-auto max-w-5xl px-4 pb-8 text-xs text-ink-soft',
} as const

// The footer's "About and legal" links, in order: the page address and its element id.
export const legalFooterLinks = [
  { path: '/about', id: 'footer-link-about', labelKey: 'footer.about' },
  { path: '/privacy', id: 'footer-link-privacy', labelKey: 'legal.privacy' },
  { path: '/terms', id: 'footer-link-terms', labelKey: 'legal.terms' },
] as const
