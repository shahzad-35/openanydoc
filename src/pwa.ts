import { useSyncExternalStore } from 'react'

// The installable app: the service worker (src/sw.ts), the browser's install offer, files opened from the desktop (launchQueue)
// and files shared from Android (share target). Browser-only: everything here runs after the page has started, never on import.

type InstallPromptEvent = Event & { prompt: () => Promise<unknown> }
type LaunchParams = { files: FileSystemFileHandle[] }
type LaunchQueue = { setConsumer: (consumer: (launchParams: LaunchParams) => void) => void }

let installPromptEvent: InstallPromptEvent | null = null
let isPageAvailableOffline = false
const appStateListeners = new Set<() => void>()

function notifyAppStateListeners() {
  appStateListeners.forEach((listener) => listener())
}

function subscribeToAppState(listener: () => void) {
  appStateListeners.add(listener)
  return () => appStateListeners.delete(listener)
}

// Called once from main.tsx in the built site (no service worker in dev, where every file changes all the time).
export function registerServiceWorker() {
  // Chrome and Edge offer an install; the event is kept so the footer's Install app button can show the browser's dialog.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installPromptEvent = event as InstallPromptEvent
    notifyAppStateListeners()
  })
  window.addEventListener('appinstalled', () => {
    installPromptEvent = null
    notifyAppStateListeners()
  })
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

// After a page has fetched what it needs (App's idle preload), the service worker is asked to keep this page and every script,
// model and pdf.js file it has loaded so far: those loaded before the worker took over the page went past it.
export async function keepPageForOffline() {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.ready
  if (!navigator.serviceWorker.controller) {
    await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }))
  }
  const loadedFileUrls = performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((url) => url.startsWith(`${location.origin}/assets/`) || url.startsWith(`${location.origin}/models/`) || url.startsWith(`${location.origin}/pdfjs/`))
  const urlsToCache = [location.pathname, ...new Set(loadedFileUrls)]
  // workbox-routing answers a CACHE_URLS message on the given port once each address is cached by its route.
  const cachingChannel = new MessageChannel()
  const cachingDone = new Promise((resolve) => (cachingChannel.port1.onmessage = resolve))
  registration.active?.postMessage({ type: 'CACHE_URLS', payload: { urlsToCache } }, [cachingChannel.port2])
  await cachingDone
  isPageAvailableOffline = true
  notifyAppStateListeners()
}

// Files opened with the installed app from Finder or Explorer (desktop Chrome and Edge, manifest file_handlers).
export function takeLaunchedFiles(openLaunchedFile: (file: File) => void) {
  const launchQueue = (window as Window & { launchQueue?: LaunchQueue }).launchQueue
  launchQueue?.setConsumer(async (launchParams) => {
    const firstFileHandle = launchParams.files[0]
    if (firstFileHandle) openLaunchedFile(await firstFileHandle.getFile())
  })
}

// A file shared to the app on Android: src/sw.ts kept it in the shared-files cache and sent the page here with ?shared=1. It is
// read once and removed, so it never stays on the device.
export async function takeSharedFile() {
  const sharedFilesCache = await caches.open('shared-files')
  const sharedFileResponse = await sharedFilesCache.match('/shared-file')
  await caches.delete('shared-files')
  if (!sharedFileResponse) return null
  const fileName = decodeURIComponent(sharedFileResponse.headers.get('X-File-Name') ?? 'shared-file')
  const fileType = sharedFileResponse.headers.get('Content-Type') ?? ''
  return new File([await sharedFileResponse.blob()], fileName, { type: fileType })
}

export function useIsAvailableOffline() {
  return useSyncExternalStore(subscribeToAppState, () => isPageAvailableOffline, () => false)
}

// iPhone and iPad have no install dialog: Safari's Share menu has Add to Home Screen. iPadOS reports a Mac, with touch.
function isAppleTouchDevice() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

function isRunningAsInstalledApp() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

type InstallOption = 'prompt' | 'apple' | 'none'

function readInstallOption(): InstallOption {
  if (isRunningAsInstalledApp()) return 'none'
  if (installPromptEvent) return 'prompt'
  return isAppleTouchDevice() ? 'apple' : 'none'
}

export function useInstallOption() {
  const installOption = useSyncExternalStore(subscribeToAppState, readInstallOption, (): InstallOption => 'none')
  async function showInstallDialog() {
    await installPromptEvent?.prompt()
    installPromptEvent = null
    notifyAppStateListeners()
  }
  return { installOption, showInstallDialog }
}
