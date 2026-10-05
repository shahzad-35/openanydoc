# OpenAnyDoc design standard

This is the default for every page, component and feature. Follow it unless there is a clear reason not to. If you deviate, write down what changed and why in the relevant section of this file, with the date, before building it.

The code is the source of truth for values: color tokens, fonts and shared utilities live in `src/index.css`; the page is `src/pages/HomePage.tsx`. If this file and the code disagree, fix whichever is wrong in the same change.

## Character
A calm night-sky tool (design "Aurora Dust", chosen from ten Three.js options). The whole home screen is one drop target: a slow field of drifting particles behind a centered headline and one large drop panel, with the three steps as a slim strip underneath. The page is soft sky blue in light mode and deep night blue in dark mode with one blue accent; the file types keep their colors, one hue each: CSV violet, Excel green, Word blue, PDF rose and PowerPoint orange-red. Content leads; the interface stays out of the way.

## Typography
| Role | Font | Notes |
|---|---|---|
| Wordmark, headings, buttons | Geometric system stack (`--font-display`) | Avenir Next, Avenir, Century Gothic, Gill Sans, Trebuchet MS, system-ui. Weight 700, tracking -0.02em. The old rounded stack (`font-rounded`) is only the fallback. |
| Body text, lists, FAQ | System sans (`font-sans`) | SF Pro Display, -apple-system, Helvetica Neue, Segoe UI, Roboto, Arial. |
| File extensions | System mono (`font-mono`) | Only for extensions, code and data. |

Never load fonts from a third-party host and never ship font files.

Scale: page title (h1) `type-h1`, fluid 2.4rem to 3rem; headings and the wordmark `type-h3`, 1.4rem; buttons `type-button`, 1.05rem; body 18px; small print 14px. Rounded type is for short text only; paragraphs stay in the system sans. Sentence case everywhere; no all-caps labels, no eyebrow text.

## Color
Use the named tokens only. Never use default Tailwind palette classes and never raw hex in components (the favicon is the one exception).

**Neutral base** (the page chrome carries no brand color):

| Token | Light | Dark | Use |
|---|---|---|---|
| `paper` | `#eef3fb` | `#0a1128` | Page background, inactive step badge |
| `paper-raised` | `#ffffff` | `#121c3a` | Step panels, hover fills |
| `ink` | `#0f1a33` | `#e8eeff` | Text, secondary-button outline |
| `ink-soft` | `#4a5878` | `#a3b1d6` | Secondary text |
| `rule` | `#d4dcec` | `#26335c` | Panel outlines, dividers (decorative) |
| `accent` | `#2b50c8` | `#8fb0ff` | Primary button, focus ring, selection: the one blue accent |
| `on-accent` | `#ffffff` | `#0a1128` | Text on `accent` and on file-type colors |
| `danger` | `#b3261e` | `#ff8a80` | Errors only |
| `edit-mark` | `#b45309` | `#fbbf24` | Edited cells in the CSV editor only: the corner marker and the edited-cells chip |

**File-type colors** (one hue each, similar strength so they sit well together):

| Type | Token | Light | Dark |
|---|---|---|---|
| CSV | `--type-csv` | `#6a46b0` violet | `#b79bff` |
| Excel | `--type-excel` | `#1b7a43` green | `#5fd08b` |
| Word | `--type-word` | `#2459b5` blue | `#7fb0ff` |
| PDF | `--type-pdf` | `#b0214f` rose | `#ff7a9f` |
| PowerPoint | `--type-powerpoint` | `#c2441a` orange-red | `#ff8f66` |

- Put `data-file-type="csv|excel|word|pdf|powerpoint"` on an element and everything inside it can use `--file-color` (for example `bg-(--file-color)` with `text-on-accent`, or `border-(--file-color)`). Use `FileTypeChip` for the colored label. Never hard-code a type color in a component.
- Type colors mark file types only: the chips, the file page's header chip and the CSV table's header rule. Do not use them for buttons, links or decoration. The one exception is the extension pills in the "Choose a file" box (see Components), which use their own random palette.
- Otherwise one blue accent, no gradients and no shadows. The home screen uses translucent panels (`paper-raised` at 80–90% with a light blur) over the particles; that is the only place glass is allowed.
- Text contrast at least 4.5:1 in both themes (worked out by hand, not measured with a tool). White text on each light type color and dark text on each dark type color pass. Check any new pairing before using it. Never put text on `rule`.
- Dark mode is a class (`.dark` on `<html>`). It follows the OS by default and the visitor's choice is saved in `localStorage` under `theme`. Both themes must always work.

## Layout and spacing
- Header: wordmark left, theme toggle right, `max-w-5xl`. Main content: `max-w-5xl`, `px-4`, left-aligned. Footer: small text on a 1px `rule` line.
- Home order: a full-height centered screen (title, subtitle, drop panel, step strip), then the About content in a translucent panel in two columns (left: why it is private, supported files, features; right: questions).
- **Two screens.** The home page (`/`) has the hero, the three steps and the About content. Reading a file moves the browser to the file page (`/view`), which replaces the whole screen with the file's content. See Components for both.
- The home screen is one drop target: `HomePage` puts the drop handlers on the whole page, so a file dropped anywhere opens, and a dashed accent outline with "Release to open" shows while dragging. `DropPanel` holds the prompt, the extension pills (two columns on desktop), the Choose a file button, the paste hint, the privacy line and status messages. The three steps are a slim centered strip below it, not cards.
- Backdrop: `src/backdrop/` draws the Aurora Dust particles with Three.js (`three`, bundled, no network) in a fixed, `aria-hidden` canvas behind the page. It pauses off-screen and in background tabs, draws one still frame under `prefers-reduced-motion`, follows the theme, and the page works the same without WebGL.
- Use `min-h-dvh`, never `100vh`. Mobile first; no horizontal scroll at 375px; panels stack on small screens.
- Shapes: panels `box-shape` (20px radius, 1px `rule` outline); buttons and badges `control-shape` (pill).

## Components
- **Step panels:** `paper-raised` fill, 1px `rule` outline. While a file is dragged over step 1 the fill takes a faint neutral tint. Under the "Choose a file" button a small line says "Opened in your browser — the file is never uploaded." There is no opened-file state on the home page: as soon as a file is read, the app moves to the file page.
- **File type chips (`FileTypeChip`):** a pill filled with the type color and `on-accent` text. Shown next to the accepted extensions in step 1, in the Supported files list, and in the file page header.
- **Extension pills (home page, step 1):** every accepted extension (`.csv`, `.tsv`, `.tab`, `.txt`, `.xlsx`, `.xls`, `.docx`, `.pdf`, `.pptx`) is its own pill, grouped under a plain gray type name (CSV, Excel, Word, PDF, PowerPoint). Each pill has a different color from a ten-color palette (`--ext-1` to `--ext-10`, light and dark values in `src/index.css`, each passing 4.5:1 with `on-accent` text). The assignment is random per browser session: it is shuffled once and kept in `sessionStorage` under `extensionColorOrder`, so it stays the same on every visit (reloads, coming back from a file) until the tab or browser session ends, and a damaged or blocked storage value falls back to a fresh shuffle. These colors are decoration only and deliberately differ from the file-type colors used everywhere else; the extension text carries the meaning. Do not use `--ext-*` anywhere else, and add a new `--ext-N` (in both themes) before accepting more than ten extensions.
- **Primary button:** one per view at most. `accent` fill with `on-accent` text, pill shape, 44px minimum, hover fills `ink-soft`, press scales to 0.98. Currently "Choose a file".
- **Secondary button / theme toggle:** 1px `ink` outline, pill shape, 44px minimum, hover `paper-raised`.
- **Icons:** `RoughIcon` draws Rough.js shapes in `currentColor` (the sun/moon theme toggle). The wobble is set by `--icon-roughness` in `src/index.css` and is 0, so icons are crisp. No emoji or Unicode glyph icons. Rough.js (MIT) runs in the browser and makes no requests.
- **File page (`FileViewPage`, path `/view`) and its header (`FileViewHeader`):** one bar (`paper-raised`, 1px `rule` underline, full width) with the wordmark button, the file type chip, the file name as the page `h1`, the size, the viewer's own controls, "Open another file" and the theme toggle. On desktop it is one row; on phones the wordmark and toggle share the first row, the file name gets its own row and the controls scroll sideways in a third. The wordmark returns home through `onBeforeClear`; "Open another file" opens the system file chooser (see below). The page title becomes "<file name> – OpenAnyDoc" and focus moves to the file name. CSV files get the full-page editor; the other types get a `box-shape` panel saying previewing that type is coming soon, plus the 50 MB warning if it applies. The wrapper carries `data-file-type`.
- **`onBeforeClear`:** `FileViewPage` and `FileViewHeader` accept `onBeforeClear?: () => boolean | Promise<boolean>`. It runs before "Open another file" or the wordmark leaves the page; returning `false` stops it. `CsvViewer` adds its own unsaved-edits confirmation in front of any hook passed in. Browser Back is not guarded.
- **View / Edit (file page):** formats registered for editing show a sliding View / Edit switch (a pill with an accent thumb and plain (not hand-drawn) eye and pencil icons only, no visible text; the names are a tooltip and visually hidden text; buttons with `aria-pressed`) and a live counter ("3 edited cells", edit-mark dot, `role=status`) in the header. Edit mode adds a toolbar row under the header: Undo, Redo, Revert all, the format's own tools, then Download (primary button that opens the Download panel, see below, files named `<name>-edited.<ext>`). Formats not registered for editing show no toggle. **Discard dialog:** a native modal dialog, `box-shape` on `paper-raised`, title "Discard your edits?", one plain sentence, primary "Keep editing" (focused first) and secondary "Discard and start over"; Esc and a click outside also keep editing.
- **Open another file (file page):** the header button opens the system's file chooser directly (no dialog of ours). The chosen file goes through the same checks as on the home screen; a rejected file or a read error shows as a danger-colored line under the header (`role=alert`) and the open file stays. A valid file replaces the current one on the same page; unsaved edits ask first through the discard dialog.
- **Navigation and memory:** the file lives only in memory. Reading a file pushes `/view` onto the browser history; Back or the wordmark returns to `/` and drops the file; "Open another file" swaps the file in place without touching the history; Forward, or reloading `/view`, lands on the home page. There is no router package: `App.tsx` handles this with the History API.
- **CSV editor (`CsvViewer`):** the whole file page for CSV-like files (`.csv`, `.tsv`, `.tab`, `.txt`), `h-dvh` in five stacked parts, wrapped in `data-file-type="csv"`. It is modelled on a spreadsheet-style reference in function (edit cells, see edits, download) but has its own look.
  - *App bar* (`FileViewHeader`): brand, type chip, file name (`h1`), size, "Open another file", theme toggle.
  - *Edit bar* (a `paper` strip under the app bar): a cell address box (`B6`, spreadsheet style, never with thousands separators), a value field that shows the selected cell's full content and edits it (the cell mirrors what is typed, Enter commits and moves down, Escape cancels), the search input with a `/` key hint (pressing `/` anywhere focuses it), the edits chip, "Revert all" and the primary "Download". The strip scrolls sideways on phones.
  - *Edit toolbar tools (CSV):* Find and replace, Add row, Delete row, Clear cell, Revert cell (column actions live in the column menu, below). A row is added below the selected cell (at the end when nothing is selected), shows "new" as its row number and the edit-mark tint, and is selected and scrolled into view. Deleted rows disappear; Undo brings them back.
  - *Column header:* `[letter] [name] [sort arrow]`. Sorting happens only from the arrow icon button (`aria-label` "Sort by NAME", cycles ascending, descending, off; `aria-sort` is on the header). In View mode the name is plain text. In Edit mode the name is a button that opens the column menu (a popover in the top layer, right under the header): Rename column (disabled while "First row is header" is off), Add column after, Delete column (disabled for the last column); arrow keys move, Enter picks, Esc or a click outside closes. The actions apply to the clicked column, not the selected cell. Renaming edits the name in place (Enter or Tab saves, Esc cancels). Keys typed inside any text box in the grid never reach the grid's own key handler.
  - *Find and replace bar* (under the toolbar): Find, Replace with, Match case, a live count ("2 cells match" in a status region), Replace all (one undo step, then "Replaced in N cells") and Close; matching cells get a faint accent tint; Esc closes it.
  - *Download:* an icon-only button (a tray arrow, 36px square, 44px on touch, accent fill, tooltip and `aria-label` such as "Download CSV: visible rows (2)", no visible text) at the right end of the edit toolbar. One click downloads right away, with no dialog and no other options: CSV (original delimiter and extension) with the edits, the current sort order and only the rows the search leaves, a UTF-8 BOM when the file has one or contains non-ASCII text, named `<name>-edited.<ext>` (the original name when nothing changed).
  - *Changes dialog:* the Review changes button opens a modal dialog (same `ModalDialog` as the others) listing the first 200 edited cells: address and column name, the old value struck through, the new value, "Revert" for that cell and a tap to go to it (focus moves to the table after the dialog closes), a summary of added and deleted rows and columns, "Revert all", and Close. 
  - *Table:* full bleed on a `paper-raised` background, with no margins, radius or outer border, filling the space between the edit bar and the status bar. Columns share the full width evenly (minimum 180px, horizontal scroll beyond that), so there is never an empty strip at the right. Header row on `paper` with a 2px `--file-color` rule, sticky, each header showing the column letter, name and a drawn sort chevron; row-number gutter sticky on the left, wide enough for the largest number, showing the row's position in the file (the header is row 1). The selected cell, its row number and its column header share a 14% `--file-color` tint; the selected cell also has a 2px `--file-color` outline. Edited cells get a 10% `edit-mark` tint and a 3px `edit-mark` bar on their left edge (no corner triangles). Faint column and row lines (`rule` at 60-70%). Only visible rows are rendered (TanStack Virtual) and are positioned with `top`, never `transform`, which the reduced-motion rule disables. Cells use `dir="auto"` so Arabic aligns right and Latin left.
  - *Editing keys:* click selects; arrows move; double-click, Enter or F2 edits; typing a character starts an edit; Enter commits and moves down, Tab commits and moves right, Escape cancels, blur commits; Delete clears. Sorting and search read the edits as they were when the sort or search last changed, so a row never jumps away while it is being edited. Download writes a CSV with the edits, using the file's delimiter, adding a byte order mark when the source had one or the text is non-ASCII, and naming the file `<name>-edited.<ext>`.
  - *Safety:* the brand and a newly chosen file ask for confirmation (the discard dialog) while there are edits; the browser's leave-page prompt is on while there are edits; changing the delimiter (which re-reads the file) asks first.
  - *Status bar* (`paper`): row and column counts ("37 of 120,000 rows" while searching), the Delimiter select, the "First row is header" checkbox, the detected encoding and a key hint. Notices (uneven rows, unclosed quote, the 50 MB warning) sit in a slim `rule`-underlined strip under the edit bar. Fatal problems show a `danger`-outlined box that says what is wrong and what to do.
- **FAQ and definitions:** plain `dl` with 1px `rule` dividers. No accordions.
- **File intake:** all drop, browse, paste, validation and reading logic is the `useFileIntake` hook. Do not build a second upload control or reimplement this logic.
- No per-file-type routes or sections: every file goes through step 1 and opens on the same file page.

## Motion
- Transitions 200ms on interactive elements; animate color, `transform` and `opacity` only. No entrance animations.
- Everything is disabled under `prefers-reduced-motion` (handled globally in `src/index.css`).

## Accessibility (required)
- WCAG AA. Semantic `header`, `main`, `footer`; one `h1` per page; headings in order.
- "Skip to content" link first. Visible focus: 2px `accent` outline, 2px offset. Never remove it.
- Every button and input labelled; the icon-only theme button has an `aria-label`. Status, warnings and errors are in an `aria-live` region and say what to do.
- Touch targets at least 44px. The one exception is the file page (`/view`), which is compact for a mouse or trackpad (`pointer: fine`): buttons, text inputs, selects, the View / Edit switch and the theme toggle are about 36px high with 14px text and 16-20px icons (utilities `compact*ButtonClassName` and `textControlClassName` in `src/buttonStyles.ts`, the `pointer-coarse:` variant restores 44px). On touch screens (`pointer: coarse`) everything on the file page is 44px again, and the home page and dialog buttons stay 44px everywhere.

## Content rules
- Plain, specific language. Describe the product only as it actually is: free, processed in the browser, never uploaded, view only. Do not state features that are not built (previewing is still "coming soon").
- All copy lives in `src/content.ts`. No marketing filler, no exclamation marks, no placeholder text.
- Nothing visible to visitors, in page text, markup, metadata or file names, may refer to how the site was made or imply AI involvement.

## Privacy (design constraint)
No third-party requests from the page: no external fonts, images, scripts, analytics or embeds. Fonts and libraries are bundled or system fonts, and everything ships from our own domain. The code must never call `fetch`, XHR, `FormData` or similar with file data.

## Never
Default Tailwind colors, a brand color for the page chrome, type colors used for anything but file types, third-party fonts, gradients, shadows, glass or blur, emoji or glyph icons, accordions, eyebrow labels, stock or placeholder images, paragraphs in the rounded face, a second upload control.

## Adding a new section or component
1. Reuse the tokens, type utilities (`type-h1`, `type-h3`, `type-button`), `box-shape`, `control-shape`, `FileTypeChip` and the button styles in `src/buttonStyles.ts`. A new file type needs an entry in `src/viewers.ts`, a `--type-*` color for both themes and a `data-file-type` rule in `src/index.css`.
2. Check light and dark mode, 375px width, and keyboard focus.
3. Run `npm run build` and `npm run lint`.
4. Log any deviation in CLAUDE.md first.
