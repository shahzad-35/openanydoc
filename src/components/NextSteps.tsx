import { useState } from 'react'
import { useT } from '../i18n'

export type NextStep = { id: string; label: string; onSelect: () => void }

// Under a viewer's top bar once a file is open: the two or three things people most often do next with that format, one tap each
// (the same actions as the viewer's own menus). It shows once per opened file and goes away after a choice or its close button.
// It is drawn as soon as the viewer opens, with its buttons off until the file is read (`isReady`): appearing later pushed the file
// down (a layout shift of 0.1 to 0.2 on a phone).
export default function NextSteps({ steps, isReady }: { steps: NextStep[]; isReady: boolean }) {
  const { t } = useT()
  const [isHidden, setIsHidden] = useState(false)
  if (isHidden || steps.length === 0) return null
  return (
    <nav id="next-steps" aria-label={t('nextSteps.label')}>
      {/* Only this part scrolls sideways on a phone, so the close button stays in view. */}
      <div id="next-steps-list">
        <span id="next-steps-title">{t('nextSteps.title')}</span>
        {steps.map((step) => (
          <button
            key={step.id}
            id={`next-step-${step.id}`}
            type="button"
            className="next-step-button"
            disabled={!isReady}
            onClick={() => {
              setIsHidden(true)
              step.onSelect()
            }}
          >
            {step.label}
          </button>
        ))}
      </div>
      <button id="next-steps-close-button" type="button" aria-label={t('nextSteps.close')} className="next-steps-close" onClick={() => setIsHidden(true)}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </nav>
  )
}
