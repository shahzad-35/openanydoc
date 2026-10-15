import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { compactSecondaryButtonClassName, primaryButtonClassName, secondaryButtonClassName } from '../buttonStyles'
import { useT } from '../i18n'
import ModalDialog from './ModalDialog'

// How messages reach a visitor on a phone. On a wide screen every message stays the inline banner or status line it always was.
// On a phone (narrower than Tailwind's `sm`) the same messages would push the layout around or sit off screen, so quick notices
// become toasts (`Notice`, `useToast`) and blocking errors become a modal dialog (`FatalFileError`).

export type ToastKind = 'error' | 'warning' | 'info' | 'success'
type ToastAction = { label: string; onClick: () => void }
// `message` is the toast's one-line title; `description` is the grey line under it.
// `seconds` overrides how long it stays (see TOAST_SECONDS for the defaults).
type Toast = { id: number; message: string; description?: string; kind: ToastKind; action?: ToastAction; seconds?: number }

const PHONE_QUERY = '(max-width: 639px)'
// A rejected file's toast is only a nudge: it goes away by itself after 3 seconds (or when dismissed).
// oxlint-disable-next-line react/only-export-components
export const REJECTED_FILE_TOAST_SECONDS = 3
// After its time is up a toast fades out over this long before it is removed (no animation under reduced motion).
const TOAST_FADE_MILLISECONDS = 1000
const MAX_VISIBLE_TOASTS = 3
// How long a toast stays: errors and warnings are read more slowly, and a toast with a button waits longest (then goes, because
// what the button acts on may have changed).
const TOAST_SECONDS: Record<ToastKind, number> = { success: 3, info: 5, warning: 8, error: 8 }
const ACTION_TOAST_SECONDS = 15

// The hooks live next to the components that use them; fast refresh only matters while developing.
// oxlint-disable-next-line react/only-export-components
export function useIsPhone() {
  const [isPhone, setIsPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches)
  useEffect(() => {
    const phoneQuery = window.matchMedia(PHONE_QUERY)
    const updateIsPhone = () => setIsPhone(phoneQuery.matches)
    phoneQuery.addEventListener('change', updateIsPhone)
    return () => phoneQuery.removeEventListener('change', updateIsPhone)
  }, [])
  return isPhone
}

type ToastControls = { showToast: (toast: Omit<Toast, 'id'>) => number; dismissToast: (toastId: number) => void }
const ToastContext = createContext<ToastControls>({ showToast: () => 0, dismissToast: () => {} })

// oxlint-disable-next-line react/only-export-components
export const useToast = () => useContext(ToastContext)

// Filled round icons (one path each, the symbol is cut out of the disc).
const CIRCLE = 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z'
const toastIconPaths: Record<ToastKind, string> = {
  error: `${CIRCLE}M11 7h2v6h-2V7Zm0 8h2v2h-2v-2Z`,
  warning: `${CIRCLE}M11 7h2v6h-2V7Zm0 8h2v2h-2v-2Z`,
  info: `${CIRCLE}M11 7h2v2h-2V7Zm0 4h2v6h-2v-6Z`,
  success: `${CIRCLE}m10.8 15.6-3.2-3.2 1.4-1.4 1.8 1.8 4.2-4.2 1.4 1.4-5.6 5.6Z`,
}

function ToastCard({ toast, dismissToast }: { toast: Toast; dismissToast: (toastId: number) => void }) {
  const { t } = useT()
  const onDismiss = useCallback(() => dismissToast(toast.id), [dismissToast, toast.id])
  const [isPaused, setIsPaused] = useState(false)
  const [isFading, setIsFading] = useState(false)
  // Pointing at it or focusing it stops the countdown and brings back a half-faded one.
  const pause = () => {
    setIsPaused(true)
    setIsFading(false)
  }
  const resume = () => setIsPaused(false)
  useEffect(() => {
    if (isPaused) return
    const milliseconds = (toast.seconds ?? (toast.action ? ACTION_TOAST_SECONDS : TOAST_SECONDS[toast.kind])) * 1000
    const fadeTimerId = window.setTimeout(() => setIsFading(true), milliseconds)
    const removeTimerId = window.setTimeout(onDismiss, milliseconds + TOAST_FADE_MILLISECONDS)
    return () => {
      window.clearTimeout(fadeTimerId)
      window.clearTimeout(removeTimerId)
    }
  }, [isPaused, toast, onDismiss])

  const isUrgent = toast.kind === 'error' || toast.kind === 'warning'
  return (
    <div
      id={`toast-${toast.id}`}
      role={isUrgent ? 'alert' : 'status'}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      className={`pointer-events-auto rounded-2xl bg-paper-raised py-3 ps-4 pe-2 text-ink shadow-[0_10px_32px_-8px_rgb(15_26_51/0.35)] transition-opacity duration-1000 ease-out ${isFading ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="flex items-start gap-2.5">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className={`mt-0.5 size-5 shrink-0 ${toast.kind === 'error' ? 'text-danger' : 'text-ink'}`}>
          <path d={toastIconPaths[toast.kind]} />
        </svg>
        <p id={`toast-title-${toast.id}`} dir="auto" className="min-w-0 flex-1 py-0.5 text-start text-[15px] font-semibold leading-snug">{toast.message}</p>
        <button
          id={`toast-dismiss-button-${toast.id}`}
          type="button"
          aria-label={t('toast.dismiss')}
          onClick={onDismiss}
          className="control-shape -mt-0.5 grid size-8 shrink-0 cursor-pointer place-items-center text-ink-soft transition-colors duration-200 hover:bg-paper hover:text-ink pointer-coarse:size-11"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      {toast.description && (
        <p id={`toast-description-${toast.id}`} dir="auto" className="-mt-1 pe-8 ps-[30px] text-start text-sm leading-snug text-ink-soft">{toast.description}</p>
      )}
      {toast.action && (
        <button
          id={`toast-action-button-${toast.id}`}
          type="button"
          onClick={() => {
            toast.action?.onClick()
            onDismiss()
          }}
          className={`${compactSecondaryButtonClassName} mt-2 ms-[30px]`}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}

// Holds the toasts and draws them in the browser's top layer (a manual popover), so they appear above an open modal dialog too. They
// sit at the bottom centre above the safe area, like a phone's own notices.
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useT()
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextToastId = useRef(1)
  const regionRef = useRef<HTMLDivElement>(null)

  const dismissToast = useCallback((toastId: number) => setToasts((current) => current.filter((toast) => toast.id !== toastId)), [])
  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const toastId = nextToastId.current++
    // The same words again replace the earlier toast instead of stacking up.
    setToasts((current) => [{ ...toast, id: toastId }, ...current.filter((existing) => existing.message !== toast.message)].slice(0, MAX_VISIBLE_TOASTS))
    return toastId
  }, [])
  const controls = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast])

  useEffect(() => {
    const region = regionRef.current
    if (!region) return
    if (toasts.length > 0 && !region.matches(':popover-open')) region.showPopover()
    if (toasts.length === 0 && region.matches(':popover-open')) region.hidePopover()
  }, [toasts.length])

  useEffect(() => {
    if (toasts.length === 0) return
    function dismissNewestOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setToasts((current) => current.slice(1))
    }
    window.addEventListener('keydown', dismissNewestOnEscape)
    return () => window.removeEventListener('keydown', dismissNewestOnEscape)
  }, [toasts.length])

  return (
    <ToastContext.Provider value={controls}>
      {children}
      <div
        ref={regionRef}
        id="toast-region"
        popover="manual"
        aria-label={t('toast.region')}
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1rem)] top-auto m-auto h-fit w-[min(26rem,calc(100vw-2rem))] overflow-visible border-0 bg-transparent p-0"
      >
        <div className="flex flex-col-reverse gap-2">
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} dismissToast={dismissToast} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

type NoticeProps = { id: string; kind: ToastKind; role?: 'alert' | 'status'; className?: string; message: string; detail?: string; alwaysToast?: boolean; seconds?: number }

// A message that is an inline line on a wide screen (exactly the paragraph it replaces: same id, role and classes) and a toast on a
// phone, shown once each time the text changes.
export function Notice({ id, kind, role, className, message, detail, alwaysToast = false, seconds }: NoticeProps) {
  const isPhone = useIsPhone()
  const { showToast } = useToast()
  useEffect(() => {
    if ((isPhone || alwaysToast) && message !== '') showToast({ message, description: detail, kind, seconds })
  }, [isPhone, alwaysToast, message, detail, kind, seconds, showToast])
  if (isPhone || alwaysToast || message === '') return null
  return (
    <p id={id} role={role} className={className}>
      {message}
    </p>
  )
}

type FatalFileErrorProps = { title: string; reason: string; hint: string; onOpenAnotherFile: () => void }

// "This file could not be read": the bordered box in the page on a wide screen; a modal dialog on a phone, with the way out as buttons.
// The hint points at the "Open another file" button above the page, so the dialog (which has its own buttons) leaves it out.
// Closing the dialog leaves the same box on the page.
export function FatalFileError({ title, reason, hint, onOpenAnotherFile }: FatalFileErrorProps) {
  const { t } = useT()
  const isPhone = useIsPhone()
  const [isDialogOpen, setIsDialogOpen] = useState(true)

  if (isPhone && isDialogOpen) {
    return (
      <ModalDialog id="dialog-file-error" title={title} onClose={() => setIsDialogOpen(false)}>
        <p id="file-error-reason" role="alert" className="mt-3">{reason}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            id="file-error-open-another-button"
            type="button"
            autoFocus
            onClick={() => {
              setIsDialogOpen(false)
              onOpenAnotherFile()
            }}
            className={primaryButtonClassName}
          >
            {t('file.openAnother')}
          </button>
          <button id="file-error-close-button" type="button" onClick={() => setIsDialogOpen(false)} className={secondaryButtonClassName}>
            {t('find.close')}
          </button>
        </div>
      </ModalDialog>
    )
  }
  return (
    <div id="file-error" role="alert" className="box-shape solid-box m-6 max-w-2xl border-danger p-6">
      <h2 className="type-h3">{title}</h2>
      <p className="mt-2">{reason}</p>
      <p className="mt-2 text-ink-soft">{hint}</p>
    </div>
  )
}
