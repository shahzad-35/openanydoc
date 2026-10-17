import { FaqSection, FeaturesSection, PrivacySection, ToolCardsSection } from './AboutSections'

export default function AboutContent({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className="grid gap-12 md:grid-cols-2">
      <div className="space-y-12">
        <ToolCardsSection onNavigate={onNavigate} />
        <PrivacySection />
        <FeaturesSection />
      </div>
      <FaqSection />
    </div>
  )
}
