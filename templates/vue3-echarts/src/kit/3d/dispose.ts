/**
 * GPU cleanup for three.js object trees. WebGL resources are not garbage collected: every geometry,
 * material and texture must be disposed explicitly or it leaks until the context dies.
 */
import type { Material, Object3D, Texture } from 'three'

const isTexture = (v: unknown): v is Texture => !!v && typeof v === 'object' && (v as Texture).isTexture === true

/** Dispose a material and every texture it references (map slots and shader uniforms) */
export function disposeMaterial(material: Material): void {
  for (const value of Object.values(material)) {
    if (isTexture(value)) value.dispose()
  }
  const uniforms = (material as Material & { uniforms?: Record<string, { value: unknown }> }).uniforms
  if (uniforms) {
    for (const u of Object.values(uniforms)) {
      if (isTexture(u.value)) u.value.dispose()
    }
  }
  material.dispose()
}

/** Dispose all geometries, materials and textures under `root` (each resource once) */
export function disposeObject(root: Object3D): void {
  const seen = new Set<unknown>()
  root.traverse((obj) => {
    const node = obj as Object3D & {
      geometry?: { dispose(): void }
      material?: Material | Material[]
      dispose?: () => void
    }
    if (node.geometry && !seen.has(node.geometry)) {
      seen.add(node.geometry)
      node.geometry.dispose()
    }
    const mats = Array.isArray(node.material) ? node.material : node.material ? [node.material] : []
    for (const m of mats) {
      if (seen.has(m)) continue
      seen.add(m)
      disposeMaterial(m)
    }
    // InstancedMesh / SkinnedMesh free their own buffers
    if (typeof node.dispose === 'function' && (node as { isInstancedMesh?: boolean }).isInstancedMesh) node.dispose()
  })
  root.clear()
}
