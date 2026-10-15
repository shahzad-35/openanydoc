import { textControlClassName } from '../buttonStyles'

type FindReplaceBarProps = {
  findText: string
  replaceText: string
  matchCase: boolean
  matchCount: number
  // The match the selection is on (0-based), for "2 of 7"; omit when the format does not step through matches.
  matchPosition?: number
  resultMessage: string
  onFindChange: (newText: string) => void
  onReplaceChange: (newText: string) => void
  onMatchCaseChange: (newValue: boolean) => void
  onPrevious?: () => void
  onNext?: () => void
  onReplace?: () => void
  onReplaceAll: () => void
  onClose: () => void
}

const barButtonClassName =
  'control-shape solid-box min-h-8 pointer-coarse:min-h-11 cursor-pointer border-ink px-3 text-sm font-medium transition-colors duration-200 hover:bg-paper-raised disabled:cursor-not-allowed disabled:opacity-50'

// The find and replace row under the edit toolbar, for the formats whose find and replace works on text. Enter in the Find box
// goes to the next match (Shift+Enter the previous one) and Esc closes the row.
export default function FindReplaceBar({
  findText,
  replaceText,
  matchCase,
  matchCount,
  matchPosition,
  resultMessage,
  onFindChange,
  onReplaceChange,
  onMatchCaseChange,
  onPrevious,
  onNext,
  onReplace,
  onReplaceAll,
  onClose,
}: FindReplaceBarProps) {
  const matchMessage =
    matchCount === 0
      ? 'No matches'
      : matchPosition === undefined
        ? `${matchCount.toLocaleString()} ${matchCount === 1 ? 'match' : 'matches'}`
        : `${Math.min(matchPosition, matchCount - 1) + 1} of ${matchCount.toLocaleString()}`
  const countMessage = resultMessage || (findText === '' ? '' : matchMessage)
  return (
    <div
      id="find-replace-bar"
      role="search"
      aria-label="Find and replace"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
      className="flex flex-wrap items-center gap-2 border-b border-rule bg-paper px-4 py-2"
    >
      <label className="flex items-center gap-2">
        <span className="text-sm text-ink-soft">Find</span>
        <input
          id="find-input"
          autoFocus
          dir="auto"
          value={findText}
          onChange={(event) => onFindChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            if (event.shiftKey) onPrevious?.()
            else onNext?.()
          }}
          className={`${textControlClassName} w-44`}
        />
      </label>
      <label className="flex items-center gap-2">
        <span className="text-sm text-ink-soft">Replace with</span>
        <input id="replace-input" dir="auto" value={replaceText} onChange={(event) => onReplaceChange(event.target.value)} className={`${textControlClassName} w-44`} />
      </label>
      <label className="flex min-h-8 pointer-coarse:min-h-11 items-center gap-2 text-sm">
        <input id="match-case-checkbox" type="checkbox" checked={matchCase} onChange={(event) => onMatchCaseChange(event.target.checked)} className="size-4 pointer-coarse:size-5" />
        Match case
      </label>
      <p id="find-result" role="status" aria-live="polite" className="min-w-28 text-sm font-medium">
        {countMessage}
      </p>
      {onPrevious && (
        <button id="find-previous-button" type="button" disabled={matchCount === 0} onClick={onPrevious} className={barButtonClassName}>
          Previous
        </button>
      )}
      {onNext && (
        <button id="find-next-button" type="button" disabled={matchCount === 0} onClick={onNext} className={barButtonClassName}>
          Next
        </button>
      )}
      {onReplace && (
        <button id="replace-button" type="button" disabled={matchCount === 0} onClick={onReplace} className={barButtonClassName}>
          Replace
        </button>
      )}
      <button id="replace-all-button" type="button" disabled={findText === '' || matchCount === 0} onClick={onReplaceAll} className={barButtonClassName}>
        Replace all
      </button>
      <button id="find-close-button" type="button" onClick={onClose} className="control-shape min-h-8 pointer-coarse:min-h-11 cursor-pointer px-3 text-sm transition-colors duration-200 hover:bg-paper-raised">
        Close
      </button>
    </div>
  )
}
