import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { useT } from '../i18n'

type ModalDialogProps = {
  title: string
  // The dialog's id, the same in every language: "dialog-add-sheet" (use `dialog-${idFor('some.key')}` from useT).
  id: string
  // The id of the element inside `children` that describes the dialog, for screen readers.
  describedById?: string
  // Esc, a click on the backdrop and the dialog's own Close buttons all end up here.
  onClose: () => void
  widthClassName?: string
  // Inside the CSV or Excel workbench: the workbench's own dialog look (sheetChrome.css), a title row with a Close button, and
  // `children` that bring their own .dlg-body and .dlg-foot.
  inWorkbench?: boolean
  children: ReactNode
}

// The two design systems a control can live in: the site's pages (index.css: .btn--primary, rounded fields), and the file
// viewers' workbench (sheetChrome.css under #csv-workbench, #excel-workbench, #docs-workbench, which restyles .btn). A dialog or
// panel shown in both takes its classes from here, so nothing renders unstyled in the other system.
export type ControlLook = 'page' | 'workbench'
export const CONTROL_CLASSES: Record<ControlLook, { box: string; label: string; select: string; textarea: string; primaryButton: string; secondaryButton: string }> = {
  page: {
    box: 'space-y-4 rounded-[22px] border-2 border-rule bg-paper-raised p-5 text-start',
    label: 'block text-sm font-semibold',
    select: 'mt-1 block w-full rounded-[12px] border-2 border-rule bg-paper-raised px-3 py-2 text-sm pointer-coarse:min-h-11',
    textarea: 'w-full rounded-[14px] border-2 border-rule bg-surface p-3 font-mono text-sm',
    primaryButton: 'btn btn--primary btn--compact press',
    secondaryButton: 'btn btn--quiet btn--compact press',
  },
  workbench: { box: 'grid gap-3 text-start', label: 'field', select: '', textarea: '', primaryButton: 'btn primary', secondaryButton: 'btn outline' },
}

export const FOCUSABLE_SELECTOR = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]'

// A native modal <dialog>. It is drawn in the browser's top layer, so nothing on the page can cover it or clip it, and the
// page behind is inert. Tab stays inside, Esc and a click on the backdrop close it, and focus goes back to what opened it.
export default function ModalDialog({ title, id, describedById, onClose, widthClassName = 'w-[min(32rem,calc(100vw-2rem))]', inWorkbench = false, children }: ModalDialogProps) {
  const { t } = useT()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.showModal()
    return () => {
      // Give focus back to what opened the dialog, unless the dialog's action already moved it somewhere on purpose.
      const focusMovedElsewhere = document.activeElement !== document.body && !dialog?.contains(document.activeElement)
      dialog?.close()
      if (!focusMovedElsewhere && opener?.isConnected) opener.focus()
    }
  }, [])

  return (
    <dialog
      id={id}
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={describedById}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const focusableElements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]
        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }}
      className={inWorkbench ? 'm-auto max-h-[calc(100dvh-2rem)] overflow-auto' : `box-shape solid-box m-auto max-h-[calc(100dvh-2rem)] ${widthClassName} overflow-auto border-rule bg-paper-raised p-6 text-ink backdrop:bg-black/50`}
    >
      {inWorkbench ? (
        <div className="dlg-head">
          <h2 id={titleId}>{title}</h2>
          <span className="spacer" />
          <button className="btn icon" id={`${id}-close-button`} type="button" aria-label={t('find.close')} onClick={onClose}>
            <svg className="ico" aria-hidden="true">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
      ) : (
        <h2 id={titleId} className="type-h3">
          {title}
        </h2>
      )}
      {children}
    </dialog>
  )
}
