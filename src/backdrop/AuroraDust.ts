import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, NormalBlending, PerspectiveCamera, Points, PointsMaterial, Scene } from 'three'
import type { SceneFactory } from './sceneTypes'
import { smoothTowards } from './sceneHelpers'

const PARTICLE_COUNT = 1600

// Calm: a slow cloud of particles in the accent and file-type colors, drifting past the camera.
export const createAuroraDust: SceneFactory = (renderer, colors) => {
  const scene = new Scene()
  const camera = new PerspectiveCamera(55, 1, 0.1, 100)
  camera.position.z = 8

  const palette = [colors.accent, ...colors.fileColors].map((color) => new Color(color))
  const positions = new Float32Array(PARTICLE_COUNT * 3)
  const particleColors = new Float32Array(PARTICLE_COUNT * 3)
  for (let index = 0; index < PARTICLE_COUNT; index++) {
    positions.set([(Math.random() - 0.5) * 22, (Math.random() - 0.5) * 13, (Math.random() - 0.5) * 10], index * 3)
    const color = palette[index % palette.length]
    particleColors.set([color.r, color.g, color.b], index * 3)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(particleColors, 3))
  const material = new PointsMaterial({
    size: 0.07,
    vertexColors: true,
    transparent: true,
    opacity: colors.isDark ? 0.9 : 0.75,
    depthWrite: false,
    blending: colors.isDark ? AdditiveBlending : NormalBlending,
  })
  const dust = new Points(geometry, material)
  scene.add(dust)

  return {
    resize(width, height) {
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    },
    render(seconds, pointer) {
      dust.rotation.y = seconds * 0.03
      dust.rotation.x = Math.sin(seconds * 0.1) * 0.1
      camera.position.x = smoothTowards(camera.position.x, pointer.x * 0.8, 0.03)
      camera.position.y = smoothTowards(camera.position.y, pointer.y * 0.5, 0.03)
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
