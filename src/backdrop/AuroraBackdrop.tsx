import { createAuroraDust } from './AuroraDust'
import ThreeCanvas from './ThreeCanvas'

// The home screen's drifting-particle scene, as one piece that HomePage loads after the page has appeared: Three.js is
// large, and the words and the drop zone must not wait for it.
export default function AuroraBackdrop() {
  return <ThreeCanvas createScene={createAuroraDust} className="h-full w-full" />
}
