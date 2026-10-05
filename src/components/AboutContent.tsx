import { FaqSection, FeaturesSection, PrivacySection, SupportedFilesSection } from './AboutSections'

export default function AboutContent() {
  return (
    <div className="grid gap-12 md:grid-cols-2">
      <div className="space-y-12">
        <PrivacySection />
        <SupportedFilesSection />
        <FeaturesSection />
      </div>
      <FaqSection />
    </div>
  )
}
