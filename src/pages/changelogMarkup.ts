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
  page: 'toy-page min-h-dvh text-[17px] leading-normal text-ink',
  header: 'mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-5',
  brandLink: 'rounded-full',
  // On a phone the link's padding is pulled out, so its text ends where the nav card below does.
  languageLink: 'pill-link -me-4 text-[15px] md:me-0 md:px-3',
  main: 'mx-auto max-w-3xl px-5 pb-24',
  intro: 'py-8 md:py-12',
  heading: 'type-h1 text-balance',
  introText: 'mt-4 max-w-2xl text-ink-soft',
  timeline: 'relative mt-4 space-y-8 border-s-2 border-rule ps-6 md:ps-8',
  entry: 'relative',
  dot: 'absolute -start-[1.95rem] top-7 size-3 rounded-full bg-(--file-color) ring-4 ring-paper-raised md:-start-[2.45rem]',
  card: 'rounded-[22px] border-2 border-rule bg-paper-raised p-6 md:p-8',
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

// The footer's social logos (SOCIAL_PROFILES in src/seo.ts), filled paths in a 24 x 24 box, keyed by the profile id.
export const SOCIAL_ICON_PATHS: Record<string, string> = {
  x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  youtube: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
}

// The header's links to the viewer pages (src/components/SiteNav.tsx), on every content page; the build script writes the same nav
// into the changelog pages. On a phone the links fold into one disclosure that opens as a card, on the header's second row (after
// `headerRowBreak`); from md up the disclosure's content is always shown (::details-content) and its summary hidden.
// On a phone the header has two rows: the logo and the language and theme controls, then the nav and the page's action. This
// zero-height, full-width item (placed just before the nav) starts the second row; from md up everything is one row.
export const headerRowBreak = 'order-last h-0 basis-full md:hidden'

export const navClasses = {
  nav: 'relative order-last md:order-none md:mx-auto',
  details: 'group md:[&::details-content]:[content-visibility:visible]',
  summary: 'pill-link cursor-pointer list-none gap-2 border-2 border-line text-sm md:hidden [&::-webkit-details-marker]:hidden',
  chevron: 'size-4 transition-transform duration-200 group-open:rotate-180',
  list: 'absolute start-0 top-full z-30 mt-2 flex w-64 flex-col items-stretch rounded-2xl border-2 border-line bg-paper-raised p-2 shadow-lg md:static md:mt-0 md:w-auto md:flex-row md:items-center md:gap-x-1 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none',
  // 12 px sides on a wide screen (not the pill's 16 px), so the five header items fit beside the logo and the actions.
  link: 'pill-link text-[15px] md:px-3',
  // The Convert menu, the last item of the list: a dropdown card on a wide screen, an indented list inside the disclosure on a phone.
  convertDetails: 'group/convert relative',
  convertSummary: 'pill-link cursor-pointer list-none gap-1.5 text-[15px] md:px-3 [&::-webkit-details-marker]:hidden',
  convertChevron: 'size-4 transition-transform duration-200 group-open/convert:rotate-180',
  convertList: 'mt-1 flex flex-col items-start ps-4 md:absolute md:end-0 md:top-full md:z-30 md:mt-2 md:w-56 md:rounded-2xl md:border-2 md:border-line md:bg-paper-raised md:p-2 md:shadow-lg',
  convertLink: 'pill-link w-full text-[15px]',
} as const

// A downward chevron, drawn inside a 24 x 24 box.
export const CHEVRON_ICON_PATH = 'm6 9 6 6 6-6'

// The site footer (src/components/SiteFooter.tsx). The build script writes the same footer as HTML into the changelog pages.
// A soft band with a four-column grid (brand, File viewers, More file tools, About and legal) and a bottom bar for the disclaimer.
// A grid, not flex-wrap, so the columns keep their place in Arabic too. No `&` in any class: the static copy is not HTML-escaped.
export const footerClasses = {
  footer: 'mt-16 border-t border-line bg-surface-2',
  inner: 'mx-auto max-w-[1120px] px-5 pt-12 pb-6',
  columns: 'grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:gap-x-10',
  brand: 'col-span-2 md:col-span-1',
  brandMark: 'flex items-center',
  brandText: 'mt-4 max-w-[36ch] text-[15px] leading-relaxed text-ink-soft',
  heading: 'font-[family-name:var(--font-display)] text-[17px] font-medium text-ink',
  list: 'mt-4 space-y-1',
  item: 'flex items-center gap-2',
  link: 'inline-flex min-h-8 items-center text-[15px] text-ink-soft underline-offset-4 transition-colors duration-150 hover:text-accent hover:underline pointer-coarse:min-h-11',
  // The viewers column takes the whole width on a phone, so a viewer's name and its New badge stay on one line.
  viewersColumn: 'col-span-2 md:col-span-1',
  bottom: 'mt-10 border-t border-line pt-5',
  disclaimer: 'text-[13px] leading-relaxed text-ink-soft',
  socialList: 'mt-5 flex items-center gap-2',
  socialLink: 'inline-flex size-10 items-center justify-center rounded-full border border-line text-ink-soft transition-colors duration-150 hover:border-accent hover:text-accent pointer-coarse:size-11',
} as const

// The footer's "About and legal" links, in order: the page address and its element id.
export const legalFooterLinks = [
  { path: '/about', id: 'footer-link-about', labelKey: 'footer.about' },
  { path: '/privacy', id: 'footer-link-privacy', labelKey: 'legal.privacy' },
  { path: '/terms', id: 'footer-link-terms', labelKey: 'legal.terms' },
] as const
