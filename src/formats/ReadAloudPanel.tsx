// Read aloud with the browser's speech, shared by the Word and PowerPoint viewers. One part (a paragraph, a slide's text) per
// utterance; a part with Arabic letters uses the Arabic voice. Only voices on this device are offered (localService): network
// voices, such as Chrome's "Google …" ones, would send the text to a speech service. A part without a voice for its language is
// skipped. Speech stops when `resetKey` changes (another file, another view) and when the panel closes.
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useT } from '../i18n'

export type ReadAloudPart = { text: string; element?: HTMLElement; onStart?: () => void }

const SPEECH_RATES = [0.75, 1, 1.25, 1.5]
const ARABIC_LETTER = /[؀-ۿݐ-ݿࢠ-ࣿ]/

type ReadAloudPanelProps = {
  // Read when Play is pressed, so it always reads what is shown then.
  readParts: () => ReadAloudPart[]
  resetKey: unknown
  isReady: boolean
  // Choices of what to read, drawn above the voices (PowerPoint: slide text or notes, this slide or to the end).
  children?: ReactNode
}

export default function ReadAloudPanel({ readParts, resetKey, isReady, children }: ReadAloudPanelProps) {
  const { t } = useT()
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [englishVoiceUri, setEnglishVoiceUri] = useState('')
  const [arabicVoiceUri, setArabicVoiceUri] = useState('')
  const [rate, setRate] = useState(1)
  const [playState, setPlayState] = useState<'stopped' | 'playing' | 'paused'>('stopped')
  const [readingPosition, setReadingPosition] = useState<{ current: number; total: number } | null>(null)
  const runRef = useRef(0)
  const markedElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isSupported) return
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices().filter((voice) => voice.localService))
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [isSupported])

  const englishVoices = voices.filter((voice) => /^en/i.test(voice.lang))
  const arabicVoices = voices.filter((voice) => /^ar/i.test(voice.lang))
  const englishVoice = englishVoices.find((voice) => voice.voiceURI === englishVoiceUri) ?? englishVoices[0]
  const arabicVoice = arabicVoices.find((voice) => voice.voiceURI === arabicVoiceUri) ?? arabicVoices[0]

  function unmarkElement() {
    markedElementRef.current?.classList.remove('is-read-aloud')
    markedElementRef.current = null
  }
  function stop() {
    runRef.current++
    if (isSupported) window.speechSynthesis.cancel()
    unmarkElement()
    setPlayState('stopped')
    setReadingPosition(null)
  }
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => stop, [resetKey])

  function play() {
    stop()
    const run = runRef.current
    const parts = readParts().filter((part) => part.text.trim() !== '')
    const speakPart = (position: number) => {
      if (run !== runRef.current) return
      if (position >= parts.length) {
        stop()
        return
      }
      const part = parts[position]
      const voice = ARABIC_LETTER.test(part.text) ? arabicVoice : englishVoice
      if (!voice) {
        speakPart(position + 1)
        return
      }
      part.onStart?.()
      unmarkElement()
      if (part.element) {
        part.element.classList.add('is-read-aloud')
        markedElementRef.current = part.element
        part.element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
      setReadingPosition({ current: position + 1, total: parts.length })
      const utterance = new SpeechSynthesisUtterance(part.text)
      utterance.voice = voice
      utterance.lang = voice.lang
      utterance.rate = rate
      utterance.onend = () => speakPart(position + 1)
      utterance.onerror = () => speakPart(position + 1)
      window.speechSynthesis.speak(utterance)
    }
    setPlayState('playing')
    speakPart(0)
  }
  function pauseOrResume() {
    if (playState === 'playing') {
      window.speechSynthesis.pause()
      setPlayState('paused')
    } else {
      window.speechSynthesis.resume()
      setPlayState('playing')
    }
  }

  if (!isSupported) return <p className="read-aloud-note">{t('readAloud.unsupported')}</p>
  const voiceOptions = (list: SpeechSynthesisVoice[]) =>
    list.map((voice) => (
      <option key={voice.voiceURI} value={voice.voiceURI}>
        {voice.name} ({voice.lang})
      </option>
    ))
  return (
    <div className="sec read-aloud">
      <p className="read-aloud-note">{t('readAloud.localOnly')}</p>
      {children}
      <label className="read-aloud-field">
        <span>{t('readAloud.englishVoice')}</span>
        <select id="read-aloud-voice-en-select" value={englishVoice?.voiceURI ?? ''} disabled={englishVoices.length === 0} onChange={(event) => setEnglishVoiceUri(event.target.value)}>
          {voiceOptions(englishVoices)}
        </select>
      </label>
      {englishVoices.length === 0 && (
        <p className="read-aloud-note" id="read-aloud-no-english-voice">
          {t('readAloud.noEnglishVoice')}
        </p>
      )}
      <label className="read-aloud-field">
        <span>{t('readAloud.arabicVoice')}</span>
        <select id="read-aloud-voice-ar-select" value={arabicVoice?.voiceURI ?? ''} disabled={arabicVoices.length === 0} onChange={(event) => setArabicVoiceUri(event.target.value)}>
          {voiceOptions(arabicVoices)}
        </select>
      </label>
      {arabicVoices.length === 0 && (
        <p className="read-aloud-note" id="read-aloud-no-arabic-voice">
          {t('readAloud.noArabicVoice')}
        </p>
      )}
      <label className="read-aloud-field">
        <span>{t('readAloud.rate')}</span>
        <select id="read-aloud-rate-select" value={rate} disabled={playState !== 'stopped'} onChange={(event) => setRate(Number(event.target.value))}>
          {SPEECH_RATES.map((speechRate) => (
            <option key={speechRate} value={speechRate}>
              {speechRate}×
            </option>
          ))}
        </select>
      </label>
      <div className="read-aloud-buttons">
        <button className="btn primary sm" id="read-aloud-play-button" type="button" disabled={!isReady || (englishVoices.length === 0 && arabicVoices.length === 0)} onClick={play}>
          {t('readAloud.play')}
        </button>
        <button className="btn sm" id="read-aloud-pause-button" type="button" disabled={playState === 'stopped'} onClick={pauseOrResume}>
          {playState === 'paused' ? t('readAloud.resume') : t('readAloud.pause')}
        </button>
        <button className="btn sm" id="read-aloud-stop-button" type="button" disabled={playState === 'stopped'} onClick={stop}>
          {t('readAloud.stop')}
        </button>
      </div>
      <p className="read-aloud-note" id="read-aloud-position" aria-live="polite">
        {readingPosition ? t('readAloud.position', { current: readingPosition.current.toLocaleString('en-US'), total: readingPosition.total.toLocaleString('en-US') }) : ''}
      </p>
    </div>
  )
}
