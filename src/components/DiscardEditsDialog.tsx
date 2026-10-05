import { primaryButtonClassName, secondaryButtonClassName } from '../buttonStyles'
import ModalDialog from './ModalDialog'

type DiscardEditsDialogProps = {
  onKeepEditing: () => void
  onDiscard: () => void
}

// Esc and a click on the backdrop both mean "Keep editing", the safe choice.
export default function DiscardEditsDialog({ onKeepEditing, onDiscard }: DiscardEditsDialogProps) {
  return (
    <ModalDialog title="Discard your edits?" describedById="discard-edits-description" onClose={onKeepEditing}>
      <p id="discard-edits-description" className="mt-3 text-ink-soft">
        The file on your device is untouched. The changes you made here are not saved anywhere, so they will be lost.
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" autoFocus onClick={onKeepEditing} className={primaryButtonClassName}>
          Keep editing
        </button>
        <button type="button" onClick={onDiscard} className={secondaryButtonClassName}>
          Discard and start over
        </button>
      </div>
    </ModalDialog>
  )
}
