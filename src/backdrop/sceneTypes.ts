import type { WebGLRenderer } from 'three'

// The page's current colors, read from the theme, so every scene matches light and dark mode.
export type SceneColors = {
  isDark: boolean
  paperRaised: string
  ink: string
  inkSoft: string
  accent: string
  fileColors: string[]
}

export type SceneInstance = {
  resize: (width: number, height: number) => void
  render: (seconds: number, pointer: { x: number; y: number }) => void
  dispose: () => void
}

export type SceneFactory = (renderer: WebGLRenderer, colors: SceneColors) => SceneInstance
