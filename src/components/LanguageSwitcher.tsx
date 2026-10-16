import { useContext } from 'react'
import { SwitchLanguageContext, localizePath, splitLocalePath, useT } from '../i18n'

// A link to the same page in the other language. It names the other language in that language ("العربية", "English").
// `compact` is for the file page's app bar, like ThemeToggle. `className` replaces the look (the JSON page uses its own buttons).
export default function LanguageSwitcher({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { locale, t } = useT()
  const switchLanguage = useContext(SwitchLanguageContext)
  const otherLocale = locale === 'en' ? 'ar' : 'en'
  const sameAddressInOtherLanguage = localizePath(otherLocale, splitLocalePath(window.location.pathname).path)

  return (
    <a
      id="language-switch-link"
      href={sameAddressInOtherLanguage}
      hrefLang={otherLocale}
      lang={otherLocale}
      aria-label={t('language.switchLabel')}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
        event.preventDefault()
        switchLanguage(otherLocale)
      }}
      className={
        className ??
        `control-shape solid-box grid cursor-pointer place-items-center ${compact ? 'min-h-8 pointer-coarse:min-h-11 text-[13px]' : 'min-h-11'} border-ink bg-paper px-4 font-medium text-ink transition-colors duration-200 hover:bg-paper-raised active:scale-[0.98]`
      }
    >
      {t('language.switch')}
    </a>
  )
}
