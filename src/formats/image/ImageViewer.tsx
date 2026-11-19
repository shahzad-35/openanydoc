// Shows a picture: JPG, PNG, WebP, AVIF, GIF, BMP, HEIC (the browser or libheif-js), TIFF and SVG, with zoom, fit to the window, a
// checkerboard behind transparency and what the file says about itself (camera, date, GPS location) read with exifr. Everything
// runs in this tab; the "Open in OpenStreetMap" link is the visitor's own choice to leave the page.
import { useEffect, useRef, useState } from 'react'
import MenuBar from '../../components/MenuBar'
import type { MenuDefinition } from '../../components/MenuBar'
import { FatalFileError } from '../../components/Messages'
import NextSteps from '../../components/NextSteps'
import { localizePath, useT } from '../../i18n'
import { formatFileSize } from '../../useFileIntake'
import { downloadTextFile } from '../registry'
import type { FormatViewerProps } from '../registry'
import { Icon, SheetIconSprite, Toolbar, ToolbarButton, ToolbarSeparator, TopBar, useIsNarrowScreen, useThemeToggle } from '../sheet/SheetChrome'
import { findLiveTool } from '../../tools/registry'
import { ImageReadError, decodeImage, extensionOf, readImageMetadata } from './imageFiles'
import type { ImageMetadata } from './imageFiles'
import '../sheet/sheetChrome.css'
import './imageViewer.css'

const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 8]

export default function ImageViewer({ openedFile, onOpenAnotherFile, onClose, onOpenInTool }: FormatViewerProps) {
  const { locale, t } = useT()
  const [isDark, toggleTheme] = useThemeToggle()
  const isNarrow = useIsNarrowScreen()
  const fileName = openedFile.file.name
  const [picture, setPicture] = useState<ImageBitmap | null>(null)
  const [problem, setProblem] = useState<'unreadable' | 'heic' | null>(null)
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null)
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const [isInfoShown, setIsInfoShown] = useState(!isNarrow)
  const [fitScale, setFitScale] = useState(1)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  // The decoded picture is freed when another file opens or the viewer closes.
  useEffect(() => {
    let isCurrent = true
    let decodedPicture: ImageBitmap | null = null
    decodeImage(openedFile.file).then(
      (decoded) => {
        decodedPicture = decoded
        if (isCurrent) setPicture(decoded)
        else decoded.close()
      },
      (error) => isCurrent && setProblem(error instanceof ImageReadError ? error.reason : 'unreadable'),
    )
    void readImageMetadata(openedFile.file).then((found) => isCurrent && setMetadata(found))
    return () => {
      isCurrent = false
      decodedPicture?.close()
    }
  }, [openedFile.file])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !picture) return
    canvas.width = picture.width
    canvas.height = picture.height
    canvas.getContext('2d')!.drawImage(picture, 0, 0)
  }, [picture])

  // "Fit" keeps the whole picture in view, never larger than its own size.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !picture) return
    const measure = () => setFitScale(Math.min(1, (stage.clientWidth - 32) / picture.width, (stage.clientHeight - 32) / picture.height))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [picture])

  const scale = zoom === 'fit' ? fitScale : zoom
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !picture) return
    canvas.style.width = `${Math.round(picture.width * scale)}px`
    canvas.style.height = `${Math.round(picture.height * scale)}px`
  }, [picture, scale])

  function zoomBy(direction: 1 | -1) {
    const next = direction > 0 ? ZOOM_STEPS.find((step) => step > scale + 0.001) : [...ZOOM_STEPS].reverse().find((step) => step < scale - 0.001)
    if (next) setZoom(next)
  }

  const isReady = picture !== null
  // JPG to PDF takes fewer formats than the viewer opens (no AVIF, GIF or BMP).
  const isTakenByJpgToPdf = findLiveTool('jpg-to-pdf')?.inputFormats.includes(`.${extensionOf(fileName)}`) ?? false
  const openIn = (toolPath: string) => onOpenInTool(openedFile.file, localizePath(locale, toolPath))
  const hasGps = metadata?.latitude !== undefined && metadata.longitude !== undefined
  const menus: MenuDefinition[] = [
    {
      id: 'file',
      label: t('menu.file'),
      items: [
        { id: 'open', label: t('menu.openAnother'), icon: 'open', onSelect: onOpenAnotherFile },
        { id: 'close', label: t('menu.close'), icon: 'x', onSelect: onClose },
      ],
    },
    {
      id: 'view',
      label: t('menu.view'),
      items: [
        { id: 'zoom-in', label: t('image.zoomIn'), icon: 'zoom-in', isDisabled: !isReady, onSelect: () => zoomBy(1) },
        { id: 'zoom-out', label: t('image.zoomOut'), icon: 'zoom-out', isDisabled: !isReady, onSelect: () => zoomBy(-1) },
        { id: 'fit', label: t('image.fit'), kind: 'radio', isChecked: zoom === 'fit', isDisabled: !isReady, onSelect: () => setZoom('fit') },
        { id: 'actual-size', label: t('image.actualSize'), kind: 'radio', isChecked: zoom === 1, isDisabled: !isReady, onSelect: () => setZoom(1) },
        'separator',
        { id: 'info', label: t('image.info.toggle'), kind: 'checkbox', isChecked: isInfoShown, onSelect: () => setIsInfoShown((isShown) => !isShown) },
      ],
    },
    {
      id: 'help',
      label: t('menu.help'),
      items: [
        { id: 'menu-link-privacy', label: t('legal.privacy'), icon: 'lock', href: localizePath(locale, '/privacy') },
        { id: 'menu-link-terms', label: t('legal.terms'), icon: 'file', href: localizePath(locale, '/terms') },
        { id: 'menu-disclaimer', note: t('legal.disclaimer') },
      ],
    },
  ]

  const infoRows: [string, string][] = metadata
    ? ([
        [t('image.info.size'), picture ? `${picture.width} × ${picture.height} px` : ''],
        [t('image.info.fileSize'), formatFileSize(openedFile.file.size)],
        [t('image.info.camera'), metadata.camera ?? ''],
        [t('image.info.lens'), metadata.lens ?? ''],
        [t('image.info.takenAt'), metadata.takenAt ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(metadata.takenAt) : ''],
        [t('image.info.software'), metadata.software ?? ''],
        [t('image.info.author'), metadata.author ?? ''],
      ] as [string, string][]).filter(([, value]) => value)
    : []

  return (
    <div id="docs-workbench" className="image-workbench">
      <SheetIconSprite />
      <TopBar
        format="image"
        fileName={fileName}
        fileSize={formatFileSize(openedFile.file.size)}
        isModified={false}
        canUndo={false}
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
        canDownload
        downloadLabel={t('toolbar.download')}
        downloadTip={t('image.downloadTip')}
        onDownload={() => downloadTextFile(fileName, openedFile.contents, openedFile.file.type || 'application/octet-stream')}
        onHome={onClose}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />
      <MenuBar menus={menus} isCompact={isNarrow} label={t('menu.bar')} />
      <Toolbar label={t('image.toolbar')}>
        <ToolbarButton id="image-zoom-out-button" label={t('image.zoomOut')} icon="zoom-out" isDisabled={!isReady} onClick={() => zoomBy(-1)} />
        <span id="image-zoom-value" className="zoom-value" dir="ltr" aria-live="polite">
          {Math.round(scale * 100)}%
        </span>
        <ToolbarButton id="image-zoom-in-button" label={t('image.zoomIn')} icon="zoom-in" isDisabled={!isReady} onClick={() => zoomBy(1)} />
        <ToolbarButton id="image-fit-button" label={t('image.fit')} icon="fit-width" isPressed={zoom === 'fit'} isDisabled={!isReady} onClick={() => setZoom('fit')} />
        <ToolbarSeparator />
        <ToolbarButton id="image-info-button" label={t('image.info.toggle')} icon="panel" isPressed={isInfoShown} onClick={() => setIsInfoShown((isShown) => !isShown)} />
      </Toolbar>
      {problem === null && (
        <NextSteps
          isReady={isReady}
          steps={[
            { id: 'compress-image', label: t('image.next.compress'), onSelect: () => openIn('/compress-image') },
            { id: 'resize-image', label: t('image.next.resize'), onSelect: () => openIn('/resize-image') },
            { id: 'remove-image-metadata', label: t('image.next.removeMetadata'), onSelect: () => openIn('/remove-image-metadata') },
            ...(isTakenByJpgToPdf ? [{ id: 'jpg-to-pdf', label: t('image.next.toPdf'), onSelect: () => openIn('/jpg-to-pdf') }] : []),
          ]}
        />
      )}
      <div className="image-layout">
        <main id="main" className="image-stage" ref={stageRef}>
          {problem === null && !picture && (
            <p id="image-loading" className="image-loading">
              {t('image.loading')}
            </p>
          )}
          {problem && <FatalFileError title={t('image.error.title')} reason={t(problem === 'heic' ? 'image.error.heic' : 'image.error.reason')} hint={t('image.error.hint')} onOpenAnotherFile={onOpenAnotherFile} />}
          {/* The picture itself stays left to right on an Arabic page. */}
          <div className="image-scroll" dir="ltr" hidden={problem !== null}>
            <canvas id="image-canvas" ref={canvasRef} className="image-canvas" role="img" aria-label={fileName} />
          </div>
        </main>
        {isInfoShown && (
          <aside id="image-info" className="image-info" aria-label={t('image.info.title')}>
            <h2 className="image-info-title">{t('image.info.title')}</h2>
            {metadata === null && <p className="image-info-note">{t('image.loading')}</p>}
            {metadata && (
              <dl id="image-info-list">
                {infoRows.map(([label, value]) => (
                  <div key={label} className="image-info-row">
                    <dt>{label}</dt>
                    <dd dir="auto">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {hasGps && metadata && (
              <div id="image-gps" className="image-gps" role="note">
                <p className="image-gps-warning">
                  <Icon name="lock" size="sm" /> {t('image.info.gpsFound')}
                </p>
                <p dir="ltr" className="image-gps-place">
                  {metadata.latitude!.toFixed(5)}, {metadata.longitude!.toFixed(5)}
                  {metadata.altitude !== undefined && ` · ${Math.round(metadata.altitude)} m`}
                </p>
                <a id="image-gps-map-link" className="link" href={`https://www.openstreetmap.org/?mlat=${metadata.latitude}&mlon=${metadata.longitude}#map=15/${metadata.latitude}/${metadata.longitude}`} target="_blank" rel="noopener noreferrer">
                  {t('image.info.openMap')}
                </a>
                <button id="image-remove-metadata-button" type="button" className="btn sm" onClick={() => openIn('/remove-image-metadata')}>
                  {t('image.next.removeMetadata')}
                </button>
              </div>
            )}
            {metadata && metadata.fieldCount === 0 && <p id="image-info-none" className="image-info-note">{t('image.info.none')}</p>}
          </aside>
        )}
      </div>
    </div>
  )
}
