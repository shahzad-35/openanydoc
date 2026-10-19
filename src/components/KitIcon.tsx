import type { ReactNode } from 'react'

// The Toy Blocks kit's 24px stroke icons, drawn inline so they take the text colour.
export const uiIconShapes = {
  'arrow-left': <path d="M19 12H5m6-6-6 6 6 6" />,
  'arrow-right': <path d="M5 12h14m-6-6 6 6-6 6" />,
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.8 2.8L16 10" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
      <path d="M15.5 8.5v-2A2.5 2.5 0 0 0 13 4H6.5A2.5 2.5 0 0 0 4 6.5V13a2.5 2.5 0 0 0 2.5 2.5h2" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 15v2.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V15" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  filter: <path d="M4 5h16l-6 7.5V19l-4 1.5v-8z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="3" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  redo: (
    <>
      <path d="m15 5 4.5 4.5L15 14" />
      <path d="M19.5 9.5H10a5.5 5.5 0 0 0 0 11h3" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5" />
    </>
  ),
  sort: <path d="M7 4v16m-3.5-12.5L7 4l3.5 3.5M17 20V4m-3.5 12.5L17 20l3.5-3.5" />,
  sparkle: (
    <>
      <path d="M12 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5z" />
      <path d="M19 16v4M17 18h4" />
    </>
  ),
  warning: (
    <>
      <path d="M10.3 4.2 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4M12 17h.01" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4" />
      <path d="M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 15v2.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V15" />
    </>
  ),
  drop: (
    <>
      <path d="M12 3v11" />
      <path d="M7.5 9.5 12 14l4.5-4.5" />
      <rect x="3.5" y="16" width="17" height="5" rx="2.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  shield: (
    <>
      <path d="M12 3 5 6v5.5c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5V6z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  'no-cloud': (
    <>
      <path d="M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.6 9.1 4.5 4.5 0 0 0 7 18z" />
      <path d="M4 4l16 16" />
    </>
  ),
  undo: (
    <>
      <path d="M9 5 4.5 9.5 9 14" />
      <path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3" />
    </>
  ),
}

export type UiIconName = keyof typeof uiIconShapes

// With `label` the icon is read out; without it is decoration.
export function KitIcon({ name, size = 24, label, className }: { name: UiIconName; size?: number; label?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
    >
      {uiIconShapes[name]}
    </svg>
  )
}

// The kit's 24px format blocks: a face on a base, with the format's glyph.
export type MiniFormat = 'csv' | 'xlsx' | 'json' | 'txt' | 'unsupported'

const miniGlyphs: Record<MiniFormat, ReactNode> = {
  csv: <path d="M7 9h10M7 12.5h10M7 16h10M12 7.5v10" />,
  xlsx: (
    <>
      <rect x="6.5" y="7" width="11" height="10" rx="1.5" />
      <path d="M6.5 10.5h11M10.5 7v10" />
    </>
  ),
  json: <path d="M9.5 7.5c-1.5 0-2 .7-2 2v.8c0 .9-.5 1.5-1.3 1.7.8.2 1.3.8 1.3 1.7v.8c0 1.3.5 2 2 2M14.5 7.5c1.5 0 2 .7 2 2v.8c0 .9.5 1.5 1.3 1.7-.8.2-1.3.8-1.3 1.7v.8c0 1.3-.5 2-2 2" />,
  txt: <path d="M7 8.5h10M7 12h10M7 15.5h6" />,
  unsupported: <path d="M10 9.5a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.5M12 15.5h.01" />,
}

const miniColors: Record<MiniFormat, { face: string; base: string; ink: string }> = {
  csv: { face: 'var(--csv)', base: 'var(--csv-base)', ink: 'var(--csv-ink)' },
  xlsx: { face: 'var(--xlsx)', base: 'var(--xlsx-base)', ink: 'var(--xlsx-ink)' },
  json: { face: 'var(--json)', base: 'var(--json-base)', ink: '#ffffff' },
  txt: { face: 'var(--txt)', base: 'var(--txt-base)', ink: 'var(--txt-ink)' },
  unsupported: { face: 'var(--warn)', base: 'var(--warn-base)', ink: 'var(--warn-ink)' },
}

export function MiniFormatIcon({ format, size = 24, className }: { format: MiniFormat; size?: number; className?: string }) {
  const colors = miniColors[format]
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={className}>
      <rect x="2" y="4" width="20" height="19" rx="5.5" fill={colors.base} />
      <rect x="2" y="1.5" width="20" height="19" rx="5.5" fill={colors.face} />
      <g fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" transform="translate(0 -1)">
        {miniGlyphs[format]}
      </g>
    </svg>
  )
}

// The wordmark: lowercase display type with "any" in the accent colour.
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span dir="ltr" className={`wordmark ${className}`}>
      open<span className="text-accent">any</span>doc
    </span>
  )
}
