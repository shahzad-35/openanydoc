import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { useToast } from '../../components/Messages'
import { useT } from '../../i18n'

type MaskWorkbenchComponent = ComponentType<{ file: File | null; onClose?: () => void }>
const loadMaskWorkbench = () => import('./MaskWorkbench')

// The Mask Data drawer of a viewer. `openMaskDrawer` builds the open file as Download would save it (edits included), loads the
// mask code and shows the drawer; `maskDrawer` is the drawer to draw (null while closed). The code is fetched while the viewer is
// idle, so masking works offline once a file is open.
export function useMaskDrawer(buildFile: () => File | null | Promise<File | null>) {
  const { t } = useT()
  const { showToast } = useToast()
  const [openDrawer, setOpenDrawer] = useState<{ MaskWorkbench: MaskWorkbenchComponent; file: File } | null>(null)

  useEffect(() => {
    const prefetchTimer = window.setTimeout(() => {
      void Promise.all([loadMaskWorkbench(), import('./maskFiles').then((maskFiles) => maskFiles.warmUpMaskTool())]).catch(() => {})
    }, 2000)
    return () => window.clearTimeout(prefetchTimer)
  }, [])

  async function openMaskDrawer() {
    const file = await buildFile()
    if (!file) return
    try {
      const { default: MaskWorkbench } = await loadMaskWorkbench()
      setOpenDrawer({ MaskWorkbench, file })
    } catch {
      showToast({ message: t('app.loadFailed'), kind: 'error' })
    }
  }

  function closeMaskDrawer() {
    setOpenDrawer(null)
    document.getElementById('mask-button')?.focus()
  }

  const maskDrawer = openDrawer && <openDrawer.MaskWorkbench file={openDrawer.file} onClose={closeMaskDrawer} />
  return { openMaskDrawer, maskDrawer, isMaskDrawerOpen: openDrawer !== null }
}
