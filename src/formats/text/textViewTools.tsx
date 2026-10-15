// The font list and size defaults live beside the component because the viewer and the toolbar both need them together.
/* oxlint-disable react/only-export-components */
import { toElementId } from '../../elementId'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Icon, IconButton, IconMenuButton } from '../../components/ToolbarControls'

// The reading controls of a text file: font, size, wrap lines, line numbers and copy. They change how the page looks, not the
// file, so they are shown in both View and Edit mode: the viewer draws them in View mode, and the edit toolbar adds them in Edit
// mode (both draw this component).

// Font names (Arial, Georgia ...) are the same in every language; only the three generic families have a translated name.
type FontChoice = { key: string; label: string; labelKey?: MessageKey; css: string }

export const TEXT_FONT_CHOICES: FontChoice[] = [
  { key: 'mono', label: 'Monospace', labelKey: 'text.font.mono', css: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
  { key: 'sans', label: 'Sans-serif', labelKey: 'text.font.sans', css: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { key: 'serif', label: 'Serif', labelKey: 'text.font.serif', css: 'Georgia, "Times New Roman", serif' },
  { key: 'arial', label: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { key: 'verdana', label: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
  { key: 'tahoma', label: 'Tahoma', css: 'Tahoma, Geneva, sans-serif' },
  { key: 'georgia', label: 'Georgia', css: 'Georgia, serif' },
  { key: 'times', label: 'Times New Roman', css: '"Times New Roman", Times, serif' },
  { key: 'courier', label: 'Courier New', css: '"Courier New", Courier, monospace' },
]

export const TEXT_SIZE_CHOICES_PX = [10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28]
export const DEFAULT_TEXT_SIZE_PX = 15
export const DEFAULT_TEXT_FONT_KEY = 'mono'

export type TextViewSettings = {
  fontKey: string
  textSizePx: number
  wrapLines: boolean
  showLineNumbers: boolean
  // Line numbers need one row per line, so while editing they are available only without wrapping (and in smaller files).
  lineNumbersAvailable: boolean
}

export type TextViewActions = {
  setFontKey: (fontKey: string) => void
  setTextSize: (textSizePx: number) => void
  toggleWrapLines: () => void
  toggleLineNumbers: () => void
  copyAllText: () => void
}

export function TextViewTools({ settings, actions }: { settings: TextViewSettings; actions: TextViewActions }) {
  const { t, idFor } = useT()
  const fontLabel = (font: FontChoice) => (font.labelKey ? t(font.labelKey) : font.label)
  const withCurrentMark = (label: string, isCurrent: boolean) => (isCurrent ? t('text.view.current', { label }) : label)
  const currentFont = TEXT_FONT_CHOICES.find((font) => font.key === settings.fontKey) ?? TEXT_FONT_CHOICES[0]
  return (
    <>
      <IconMenuButton
        id={`toolbar-${idFor('text.view.font')}`}
        label={t('text.view.font')}
        items={TEXT_FONT_CHOICES.map((font) => ({ id: toElementId(font.label), label: withCurrentMark(fontLabel(font), font.key === currentFont.key), onSelect: () => actions.setFontKey(font.key) }))}
      >
        <span className="max-w-24 truncate text-[12px] font-semibold">{fontLabel(currentFont)}</span>
      </IconMenuButton>
      <IconMenuButton
        id={`toolbar-${idFor('text.view.textSize')}`}
        label={t('text.view.textSize')}
        items={TEXT_SIZE_CHOICES_PX.map((size) => ({ id: `${size}-px`, label: withCurrentMark(t('text.view.sizePx', { size }), size === settings.textSizePx), onSelect: () => actions.setTextSize(size) }))}
      >
        <span className="text-[12px] font-semibold tabular-nums">{settings.textSizePx}</span>
      </IconMenuButton>
      <IconButton id={`toolbar-${idFor('text.view.wrapLines')}`} label={t('text.view.wrapLines')} isPressed={settings.wrapLines} onClick={actions.toggleWrapLines}>
        <Icon>
          <path d="M4 6h16M4 12h12a3 3 0 0 1 0 6h-4" />
          <path d="m14 15-2 3 2 3M4 18h4" />
        </Icon>
      </IconButton>
      <IconButton
        id={`toolbar-${idFor('text.view.lineNumbers')}`}
        label={settings.lineNumbersAvailable ? t('text.view.lineNumbers') : t('text.view.lineNumbersDisabled')}
        isPressed={settings.showLineNumbers}
        isDisabled={!settings.lineNumbersAvailable}
        onClick={actions.toggleLineNumbers}
      >
        <Icon>
          <path d="M10 6h10M10 12h10M10 18h10" />
          <path d="M4 5.5 5.5 4.5V9M4 19h3M4.2 14.2c.4-.7 2.6-.9 2.6.6 0 1-1.4 1.4-2.6 2.2" />
        </Icon>
      </IconButton>
      <IconButton id={`toolbar-${idFor('text.view.copyAll')}`} label={t('text.view.copyAll')} onClick={actions.copyAllText}>
        <Icon>
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </Icon>
      </IconButton>
    </>
  )
}
