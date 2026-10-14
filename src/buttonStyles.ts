export const primaryButtonClassName =
  'control-shape type-button min-h-11 min-w-11 cursor-pointer bg-accent px-7 text-on-accent transition duration-200 hover:bg-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'

export const secondaryButtonClassName =
  'control-shape solid-box type-button min-h-11 min-w-11 cursor-pointer border-ink px-5 text-ink transition duration-200 hover:bg-paper-raised active:scale-[0.98]'

// Text boxes and selects on the file page: compact for a mouse, the full 44px for touch screens.
export const textControlClassName =
  'control-shape solid-box min-h-8 pointer-coarse:min-h-11 border-ink-soft bg-paper-raised px-3 text-[13px] text-ink'

// Buttons on the file page, same sizing rule as textControlClassName.
export const compactSecondaryButtonClassName =
  'control-shape solid-box min-h-8 pointer-coarse:min-h-11 cursor-pointer border-ink px-3 text-[13px] font-medium text-ink transition duration-200 hover:bg-paper-raised active:scale-[0.98]'

// Toolbar buttons and segmented-control buttons of the text and JSON viewers.
export const viewerBarButtonClassName =
  'control-shape solid-box inline-flex min-h-8 pointer-coarse:min-h-11 min-w-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 border-rule px-2.5 text-[13px] font-medium transition-colors duration-200 hover:bg-paper-raised disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-(--file-color) aria-pressed:bg-(--file-color) aria-pressed:text-on-accent'
export const viewerSegmentButtonClassName =
  'control-shape inline-flex min-h-7 pointer-coarse:min-h-10 min-w-8 cursor-pointer items-center justify-center px-2.5 text-[13px] font-medium transition-colors duration-200 hover:bg-paper-raised disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:bg-(--file-color) aria-pressed:text-on-accent'
