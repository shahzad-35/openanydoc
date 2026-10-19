import { joinNodesAsList, localizePath, translate, translateWithNodes, useT } from '../i18n'
import type { MessageKey } from '../i18n'
import { getFormatCapabilities, getOtherReleasedFormats } from '../whatsNew'
import { Notice, REJECTED_FILE_TOAST_SECONDS, useIsPhone } from './Messages'
import ModalDialog from './ModalDialog'
import NewBadge from './NewBadge'
import type { useFileIntake } from '../useFileIntake'
import { supportedExtensions, viewers } from '../viewers'
import type { Viewer } from '../viewers'

// One class per pill position (written out in full so Tailwind finds them). Each --ext-pill-N is pointed at a hue in the session's
// shuffled order by public/theme-init.js before the first paint, so the server markup, the first browser render and the colours
// the visitor sees all agree. A class, not a style attribute: the Content-Security-Policy blocks style attributes in the HTML.
const extensionColorClasses = ['bg-(--ext-pill-1)', 'bg-(--ext-pill-2)', 'bg-(--ext-pill-3)', 'bg-(--ext-pill-4)', 'bg-(--ext-pill-5)', 'bg-(--ext-pill-6)', 'bg-(--ext-pill-7)', 'bg-(--ext-pill-8)', 'bg-(--ext-pill-9)', 'bg-(--ext-pill-10)']

export function ExtensionPill({ extension }: { extension: string }) {
  const colorClass = extensionColorClasses[supportedExtensions.indexOf(extension) % extensionColorClasses.length]
  return (
    <span dir="ltr" className={`control-shape ${colorClass} px-2.5 py-0.5 font-mono text-sm font-medium text-on-accent`}>
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

// The hero's controls: the Choose a file button, the paste hint and the messages a dropped file can cause. The whole screen is
// the drop target (see HomePage). `shownViewers` are the formats listed on a format's own page; the home page lists its formats
// in its own grid (home/HomeSections.tsx) and passes `showExtensions={false}` and its own `pasteHint`.
type DropPanelProps = {
  intake: ReturnType<typeof useFileIntake>
  shownViewers?: Viewer[]
  // Set on a format's own page: that format is left out of the "Also works with" line.
  currentViewerId?: Viewer['id']
  onNavigate?: (path: string) => void
  // The "Open it in the ... viewer" button: gives the same File to that viewer's page.
  onOpenInViewer?: (file: File, toolPath: string) => void
  showExtensions?: boolean
  pasteHint?: string
}

export default function DropPanel({ intake, shownViewers = viewers, currentViewerId, onNavigate, onOpenInViewer, showExtensions = true, pasteHint }: DropPanelProps) {
  const { locale, t } = useT()
  const otherFormats = currentViewerId ? getOtherReleasedFormats(currentViewerId) : []
  const suggestion = intake.redirectSuggestion
  const isPhone = useIsPhone()
  const wrongFileMessage = suggestion ? translate(locale, `redirect.looksLike.${suggestion.viewer.id}` as MessageKey) : ''
  const openSuggestedViewer = () => suggestion && onOpenInViewer?.(suggestion.file, localizePath(locale, suggestion.viewer.toolPath as string))
  return (
    <>
      <div id="drop-panel" className="text-center">
        {showExtensions && <ExtensionList id="supported-extensions" shownViewers={shownViewers} className="mx-auto mb-6 grid max-w-2xl gap-x-8 gap-y-3 text-start md:grid-cols-2" />}

        {intake.fileInput}
        <div className="flex flex-wrap justify-center gap-3">
          <button id="choose-file-button" type="button" disabled={intake.isReading} onClick={intake.openFilePicker} className="btn btn--primary btn--hero press">
            {t('drop.chooseFile')}
          </button>
          {currentViewerId === 'json' && (
            <button id="open-sample-json-button" type="button" disabled={intake.isReading} onClick={intake.openSampleJson} className="btn btn--quiet btn--hero press">
              {t('drop.trySampleJson')}
            </button>
          )}
        </div>
        {intake.acceptsPastedText && <p id="paste-hint" className="mt-4 text-sm text-ink-soft">{pasteHint ?? t(currentViewerId === 'json' ? 'drop.pasteHintJson' : 'drop.pasteHint')}</p>}
        {showExtensions && <p id="privacy-note" className="mt-1 text-sm text-ink-soft">{t('drop.privacyNote')}</p>}

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
              <button id="open-in-viewer-button" type="button" onClick={openSuggestedViewer} className="btn btn--quiet press">
                {t('redirect.open', { format: suggestion.viewer.label })}
              </button>
            </div>
          )}
          {suggestion && isPhone && (
            <ModalDialog id="dialog-wrong-file" title={wrongFileMessage} onClose={intake.clearRedirectSuggestion}>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button id="open-in-viewer-button" type="button" autoFocus onClick={openSuggestedViewer} className="btn btn--primary press">
                  {t('redirect.open', { format: suggestion.viewer.label })}
                </button>
                <button id="wrong-file-close-button" type="button" onClick={intake.clearRedirectSuggestion} className="btn btn--quiet press">
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
    </>
  )
}
