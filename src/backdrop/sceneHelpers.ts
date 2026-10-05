import type { Material, Mesh, Object3D, Scene, Texture } from 'three'

function disposeMaterial(material: Material) {
  const mappedMaterial = material as Material & { map?: Texture | null }
  mappedMaterial.map?.dispose()
  material.dispose()
}

// Frees the GPU memory held by everything in a scene.
export function disposeScene(scene: Scene) {
  scene.traverse((object: Object3D) => {
    const mesh = object as Mesh
    mesh.geometry?.dispose()
    const material = mesh.material
    if (Array.isArray(material)) material.forEach(disposeMaterial)
    else if (material) disposeMaterial(material)
  })
}

export function smoothTowards(current: number, target: number, amount: number) {
  return current + (target - current) * amount
}
