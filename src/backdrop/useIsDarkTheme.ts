import { useSyncExternalStore } from 'react'

function subscribeToThemeClass(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

// True while the page is in dark mode; follows the theme toggle without a reload. False in the build's server render (and in the
// first browser render that takes over its markup), which cannot know the visitor's theme.
export function useIsDarkTheme() {
  return useSyncExternalStore(subscribeToThemeClass, () => document.documentElement.classList.contains('dark'), () => false)
}
