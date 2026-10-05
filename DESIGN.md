# OpenAnyDoc design standard

This is the default for every page, component and feature. Follow it unless there is a clear reason not to. If you deviate, add a dated entry to the Decisions log in CLAUDE.md saying what changed and why, then update this file if the deviation becomes the new rule.

The code is the source of truth for values: color tokens live in `src/index.css`, page structure in `src/components/Layout.tsx`. If this file and the code disagree, fix whichever is wrong in the same change.

## Character
Minimal, quiet and typographic, like a well-set document. Content leads; the interface stays out of the way. No decoration that does not carry information.

## Typography
| Role | Font | Notes |
|---|---|---|
| Headings, wordmark | Newsreader Variable (`font-display`) | Weight 500; wordmark 600. Self-hosted via `@fontsource-variable/newsreader`. |
| Body, UI | Geist Variable (`font-sans`) | Self-hosted via `@fontsource-variable/geist`. |
| File types, code, data | System monospace (`font-mono`) | Only for file extensions, code and data. |

Never load fonts from a third-party host: no Google Fonts, no CDN.

Scale (Tailwind classes in use):
- Page title (h1): `text-5xl`, `sm:text-7xl` on the home hero, `sm:text-6xl` on inner pages. Leading 1.05, tracking `-0.02em`, `text-balance`.
- Section heading (h2): `text-4xl`. Sub-heading (h3): `text-2xl`. List-row title: `text-3xl`, tracking `-0.01em`.
- Lead paragraph: `text-lg`, `leading-relaxed`. Body: base size, `leading-relaxed`. Small print: `text-sm`.
- Letter-spacing never tighter than `-0.03em`. Display size never above 6rem except the home hero.
- Line length: 65ch for body, 55ch for list descriptions, 45ch for short intros.
- Sentence case everywhere. No all-caps labels, no eyebrow text above headings.

## Color
Use the named tokens only. Never use default Tailwind palette classes (`stone-*`, `teal-*`, `blue-*`, and so on) and never raw hex in components.

| Token | Light | Dark | Use |
|---|---|---|---|
| `paper` | `#f4f1ea` | `#171512` | Page background |
| `paper-raised` | `#ebe6da` | `#201d19` | Hover and raised surfaces |
| `ink` | `#1c1a17` | `#f1ede4` | Primary text |
| `ink-soft` | `#4a453e` | `#b8b1a5` | Secondary text, control borders |
| `rule` | `#cdc5b5` | `#3a362f` | Hairline dividers |
| `accent` | `#a8381a` | `#e8845f` | Links, actions, focus ring, selection |

- One accent only. No gradients, no gradient text, no glass or blur.
- Text contrast at least 4.5:1 in both themes. Check any new pairing before using it. `accent` text is allowed on `paper` and `paper-raised` only.
- Dark mode is a class (`.dark` on `<html>`). It follows the OS by default and the visitor's choice is saved in `localStorage` under `theme`. Both themes must always work.

## Layout and spacing
- Page container: `max-w-6xl`, `px-5`, centered. Main content `pt-14 sm:pt-24 pb-24`. Header `py-4`; footer `py-6`.
- Structure with whitespace and 1px `rule` dividers. Do not use cards, nested boxes, shadows or heavy borders.
- Lists of items are ruled rows, not card grids.
- Left-align text. Do not center body content.
- Use `min-h-dvh`, never `100vh`. Mobile first; no horizontal scroll at 375px.
- Radius: `rounded-lg` on controls. No pills, no large rounded containers.

## Components
- **Header:** wordmark left, viewer nav, theme toggle. Active nav link: `ink` text with an `accent` underline.
- **List row (viewer link):** grid of file type, title with description, and action. Whole row is the link; hover shows `paper-raised`.
- **Buttons:** 44px minimum height and width, 1px `ink-soft` border, `cursor-pointer`, hover `paper-raised`, press scales to 0.98.
- **Drop zone (`FileDropZone`):** the one place a dashed 1px `ink-soft` border is allowed, because a drop target must be visible. Dragging over switches to an `accent` border and `paper-raised` fill. Status, warnings and errors are plain text in an `aria-live` region; errors use `accent` and always say what to do. Use this component on every viewer page; do not build a second upload control.
- **Icons:** drawn SVG in one 1.75 stroke, `currentColor`, `aria-hidden` when decorative. No emoji or Unicode glyphs as icons.
- **FAQ and definitions:** plain `dl` list with dividers. No accordions.

## Motion
- Transitions 200ms on interactive elements. Animate `transform` and `opacity` only.
- One entrance animation, the hero `animate-rise` (0.6s, `cubic-bezier(0.16, 1, 0.3, 1)`). Do not add entrance animations elsewhere.
- Everything above is disabled under `prefers-reduced-motion` (handled globally in `src/index.css`).

## Accessibility (required)
- WCAG AA. Semantic `header`, `nav`, `main`, `footer`; one `h1` per page.
- "Skip to content" link first. Visible focus: 2px `accent` outline, 2px offset. Never remove it.
- Every button and input labelled. Active nav item has `aria-current="page"`.
- Touch targets at least 44px.

## Content rules
- Plain, specific language. Describe the product only as it actually is: free, processed in the browser, never uploaded, view only. Do not state features that are not built.
- No marketing filler, no exclamation marks, no placeholder text, no "coming soon" hype beyond a short honest note.
- Nothing visible to visitors, in page text, markup, metadata or file names, may refer to how the site was made or imply AI involvement.

## Privacy (design constraint)
No third-party requests from the page: no external fonts, images, scripts, analytics or embeds. Everything ships from our own domain.

## Never
Default Tailwind colors, card grids, shadows, gradients, glass or blur, emoji or glyph icons, accordions, eyebrow labels, section numbers for decoration, stock or placeholder images, third-party fonts.

## Adding a new page or component
1. Reuse existing tokens, type scale, list-row and button patterns.
2. Check light and dark mode, 375px width, and keyboard focus.
3. Run `npm run build` and `npm run lint`.
4. Log any deviation in CLAUDE.md first.
