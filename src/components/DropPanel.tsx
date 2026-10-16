import { primaryButtonClassName, secondaryButtonClassName } from '../buttonStyles'
import { joinNodesAsList, localizePath, translate, translateWithNodes, useT } from '../i18n'
import type { MessageKey } from '../i18n'
import { getFormatCapabilities, getOtherReleasedFormats } from '../whatsNew'
import { Notice, REJECTED_FILE_TOAST_SECONDS, useIsPhone } from './Messages'
import ModalDialog from './ModalDialog'
import NewBadge from './NewBadge'
import type { useFileIntake } from '../useFileIntake'
import { supportedExtensions, viewers } from '../viewers'
import type { Viewer } from '../viewers'

const EXTENSION_COLOR_COUNT = 10

function shuffle<Item>(items: Item[]) {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

const COLOR_ORDER_STORAGE_KEY = 'extensionColorOrder'

function isValidColorOrder(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === EXTENSION_COLOR_COUNT &&
    new Set(value).size === EXTENSION_COLOR_COUNT &&
    value.every((colorNumber) => Number.isInteger(colorNumber) && colorNumber >= 1 && colorNumber <= EXTENSION_COLOR_COUNT)
  )
}

// Random per browser session: the shuffled order is kept in sessionStorage, so it stays the same on every visit
// (reloads, coming back from a file) until the tab or browser session ends.
function loadOrCreateColorOrder() {
  try {
    const savedOrder: unknown = JSON.parse(sessionStorage.getItem(COLOR_ORDER_STORAGE_KEY) ?? 'null')
    if (isValidColorOrder(savedOrder)) return savedOrder
  } catch {
    // Storage is blocked or holds something unreadable, so fall through to a fresh shuffle.
  }
  const newOrder = shuffle(Array.from({ length: EXTENSION_COLOR_COUNT }, (_, index) => index + 1))
  try {
    sessionStorage.setItem(COLOR_ORDER_STORAGE_KEY, JSON.stringify(newOrder))
  } catch {
    // The colors still work for this page load; they just will not be remembered.
  }
  return newOrder
}

// Each accepted extension gets its own color from the session's shuffled order.
const shuffledColorNumbers = loadOrCreateColorOrder()
const colorNumberByExtension = new Map(
  supportedExtensions.map((extension, index) => [extension, shuffledColorNumbers[index % EXTENSION_COLOR_COUNT]]),
)

export function ExtensionPill({ extension }: { extension: string }) {
  return (
    <span
      dir="ltr"
      style={{ backgroundColor: `var(--ext-${colorNumberByExtension.get(extension)})` }}
      className="control-shape px-2.5 py-0.5 font-mono text-sm font-medium text-on-accent"
    >
      {extension}
    </span>
  )
}

// What a format can do, read from the registry: "View and edit", "View", or a "Coming soon" tag.
export function FormatCapabilities({ idPrefix, viewerId }: { idPrefix: string; viewerId: Viewer['id'] }) {
  const { t } = useT()
  const capabilities = getFormatCapabilities(viewerId)
  if (!capabilities) return null
  if (capabilities.isComingSoon) {
    return <span id={`${idPrefix}-${viewerId}`} className="control-shape inline-block border border-rule px-2 text-xs">{t('formats.comingSoon')}</span>
  }
  return <span id={`${idPrefix}-${viewerId}`}>{t(capabilities.canEdit ? 'formats.viewAndEdit' : 'formats.viewOnly')}</span>
}

function ExtensionList({ id, className, shownViewers }: { id: string; className: string; shownViewers: Viewer[] }) {
  return (
    <ul id={id} className={className}>
      {shownViewers.filter((viewer) => getFormatCapabilities(viewer.id)).map((viewer) => (
        <li key={viewer.id} id={`extension-row-${viewer.id}`} className="grid grid-cols-[6rem_1fr] items-start gap-x-3">
          <span className="py-0.5 text-sm text-ink-soft">
            {viewer.label}
            <NewBadge viewerId={viewer.id} />
            <span className="mt-0.5 block text-xs">
              <FormatCapabilities idPrefix="extension-capabilities" viewerId={viewer.id} />
            </span>
          </span>
          <span className="flex flex-wrap gap-1.5">
            {viewer.extensions.map((extension) => (
              <ExtensionPill key={extension} extension={extension} />
            ))}
          </span>
        </li>
      ))}
    </ul>
  )
}

const stepKeys = ['drop.step1', 'drop.step2', 'drop.step3'] as const

// The big centered drop panel plus the slim three-step strip. The whole home screen is the drop target (see HomePage);
// this panel is where the prompt, the accepted types and the Choose a file button live.
// `shownViewers` are the formats listed: all of them on the home page, one on a format's own page.
type DropPanelProps = {
  intake: ReturnType<typeof useFileIntake>
  shownViewers?: Viewer[]
  // Set on a format's own page: that format is left out of the "Also works with" line.
  currentViewerId?: Viewer['id']
  onNavigate?: (path: string) => void
  // The "Open it in the ... viewer" button: gives the same File to that viewer's page.
  onOpenInViewer?: (file: File, toolPath: string) => void
}

export default function DropPanel({ intake, shownViewers = viewers, currentViewerId, onNavigate, onOpenInViewer }: DropPanelProps) {
  const { locale, t } = useT()
  const otherFormats = currentViewerId ? getOtherReleasedFormats(currentViewerId) : []
  const suggestion = intake.redirectSuggestion
  const isPhone = useIsPhone()
  const wrongFileMessage = suggestion ? translate(locale, `redirect.looksLike.${suggestion.viewer.id}` as MessageKey) : ''
  const openSuggestedViewer = () => suggestion && onOpenInViewer?.(suggestion.file, localizePath(locale, suggestion.viewer.toolPath as string))
  return (
    <>
      <div
        id="drop-panel"
        className={`box-shape solid-box mx-auto w-full max-w-3xl bg-paper-raised/80 p-6 text-center backdrop-blur-md transition-colors duration-200 md:p-8 ${
          intake.isDraggingOver ? 'border-accent' : 'border-rule'
        }`}
      >
        <p id="drop-prompt" className="type-h3 text-3xl md:text-4xl">{intake.promptText}</p>
        <p id="drop-subprompt" className="mt-2 text-ink-soft">{t('drop.subprompt')}</p>

        <ExtensionList id="supported-extensions" shownViewers={shownViewers} className="mx-auto mt-6 grid max-w-2xl gap-x-8 gap-y-3 text-start md:grid-cols-2" />

        {intake.fileInput}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button id="choose-file-button" type="button" disabled={intake.isReading} onClick={intake.openFilePicker} className={primaryButtonClassName}>
            {t('drop.chooseFile')}
          </button>
          {currentViewerId === 'json' && (
            <button id="open-sample-json-button" type="button" disabled={intake.isReading} onClick={intake.openSampleJson} className={secondaryButtonClassName}>
              {t('drop.trySampleJson')}
            </button>
          )}
        </div>
        {intake.acceptsPastedText && <p id="paste-hint" className="mt-4 text-sm text-ink-soft">{t(currentViewerId === 'json' ? 'drop.pasteHintJson' : 'drop.pasteHint')}</p>}
        <p id="privacy-note" className="mt-1 text-sm text-ink-soft">{t('drop.privacyNote')}</p>

        <div id="drop-messages" aria-live="polite" className="mt-4 space-y-2">
          <Notice id="large-file-warning" kind="warning" message={intake.largeFileWarning ?? ''} />
          <Notice
            id="coming-soon-message"
            kind="info"
            alwaysToast
            seconds={REJECTED_FILE_TOAST_SECONDS}
            attempt={intake.attemptCount}
            message={intake.comingSoonViewer ? t('intake.comingSoon', { format: intake.comingSoonViewer.label }) : ''}
            detail={t('intake.tryThese')}
          />
          <Notice id="drop-error" kind={intake.errorDetail ? 'info' : 'error'} alwaysToast seconds={REJECTED_FILE_TOAST_SECONDS} attempt={intake.attemptCount} message={intake.errorMessage ?? ''} detail={intake.errorDetail ?? undefined} />
          {suggestion && !isPhone && (
            <div id="wrong-file-redirect" className="flex flex-col items-center gap-3">
              <p id="wrong-file-message" className="font-medium">{wrongFileMessage}</p>
              <button id="open-in-viewer-button" type="button" onClick={openSuggestedViewer} className={secondaryButtonClassName}>
                {t('redirect.open', { format: suggestion.viewer.label })}
              </button>
            </div>
          )}
          {suggestion && isPhone && (
            <ModalDialog id="dialog-wrong-file" title={wrongFileMessage} onClose={intake.clearRedirectSuggestion}>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button id="open-in-viewer-button" type="button" autoFocus onClick={openSuggestedViewer} className={primaryButtonClassName}>
                  {t('redirect.open', { format: suggestion.viewer.label })}
                </button>
                <button id="wrong-file-close-button" type="button" onClick={intake.clearRedirectSuggestion} className={secondaryButtonClassName}>
                  {t('find.close')}
                </button>
              </div>
            </ModalDialog>
          )}
        </div>
      </div>

      {otherFormats.length > 0 && (
        <p id="also-works-with" className="mt-6 text-center text-ink-soft">
          {translateWithNodes(locale, 'crossLinks.alsoWorks', {
            formats: joinNodesAsList(
              locale,
              otherFormats.map(({ viewer }) => (
                <a
                  key={viewer.id}
                  id={`also-works-link-${viewer.id}`}
                  href={localizePath(locale, viewer.toolPath as string)}
                  onClick={(event) => {
                    if (!onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
                    event.preventDefault()
                    onNavigate(localizePath(locale, viewer.toolPath as string))
                  }}
                  className="underline underline-offset-2 hover:text-ink"
                >
                  {viewer.label}
                </a>
              )),
            ),
          })}
        </p>
      )}

      <ol id="drop-steps" className="mt-6 flex flex-wrap justify-center gap-x-8 gap-y-2 text-ink-soft">
        {stepKeys.map((stepKey, index) => (
          <li key={stepKey} className="flex items-center gap-2">
            <span className="control-shape type-h3 grid size-8 place-items-center bg-paper-raised/80 text-sm text-ink">
              {index + 1}
            </span>
            {t(stepKey)}
          </li>
        ))}
      </ol>
    </>
  )
}
