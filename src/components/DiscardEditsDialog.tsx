import { primaryButtonClassName, secondaryButtonClassName } from '../buttonStyles'
import { useT } from '../i18n'
import ModalDialog from './ModalDialog'

type DiscardEditsDialogProps = {
  onKeepEditing: () => void
  onDiscard: () => void
}

// Esc and a click on the backdrop both mean "Keep editing", the safe choice.
export default function DiscardEditsDialog({ onKeepEditing, onDiscard }: DiscardEditsDialogProps) {
  const { t } = useT()
  return (
    <ModalDialog id="dialog-discard-your-edits" title={t('discard.title')} describedById="discard-edits-description" onClose={onKeepEditing}>
      <p id="discard-edits-description" className="mt-3 text-ink-soft">
        {t('discard.text')}
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button id="keep-editing-button" type="button" autoFocus onClick={onKeepEditing} className={primaryButtonClassName}>
          {t('discard.keepEditing')}
        </button>
        <button id="discard-edits-button" type="button" onClick={onDiscard} className={secondaryButtonClassName}>
          {t('discard.discard')}
        </button>
      </div>
    </ModalDialog>
  )
}
