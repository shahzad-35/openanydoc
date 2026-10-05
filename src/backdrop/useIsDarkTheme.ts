import { useSyncExternalStore } from 'react'

function subscribeToThemeClass(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

// True while the page is in dark mode; follows the theme toggle without a reload.
export function useIsDarkTheme() {
  return useSyncExternalStore(subscribeToThemeClass, () => document.documentElement.classList.contains('dark'))
}
