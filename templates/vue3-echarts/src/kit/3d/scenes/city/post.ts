/**
 * Post-processing: scene → (optional) UnrealBloom at reduced resolution → OutputPass (tone mapping
 * and sRGB conversion). The scene renders into a half-float target, so emissive values above 1
 * bloom instead of clipping.
 */
import { HalfFloatType, Vector2, WebGLRenderTarget, type Camera, type Scene, type WebGLRenderer } from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

/** Bloom works on this fraction of the canvas resolution (it is blurred anyway) */
const BLOOM_SCALE = 0.5

export interface PostOptions {
  bloom: boolean
  /** Bloom strength / radius / threshold */
  strength?: number
  radius?: number
  threshold?: number
}

export interface Post {
  render(): void
  resize(width: number, height: number, pixelRatio: number): void
  dispose(): void
}

export function createPost(renderer: WebGLRenderer, scene: Scene, camera: Camera, opts: PostOptions): Post {
  const size = renderer.getSize(new Vector2())
  const ratio = renderer.getPixelRatio()
  // MSAA on the scene target: the default framebuffer's antialias does not apply to composer targets
  const target = new WebGLRenderTarget(size.x * ratio, size.y * ratio, {
    type: HalfFloatType,
    samples: ratio < 1.5 ? 4 : 0
  })
  const composer = new EffectComposer(renderer, target)
  composer.addPass(new RenderPass(scene, camera))

  let bloom: UnrealBloomPass | null = null
  if (opts.bloom) {
    bloom = new UnrealBloomPass(new Vector2(size.x, size.y), opts.strength ?? 0.7, opts.radius ?? 0.45, opts.threshold ?? 0.9)
    // Run the blur chain at reduced resolution
    const setSize = bloom.setSize.bind(bloom)
    bloom.setSize = (w: number, h: number) => setSize(Math.max(1, Math.round(w * BLOOM_SCALE)), Math.max(1, Math.round(h * BLOOM_SCALE)))
    composer.addPass(bloom)
  }
  composer.addPass(new OutputPass())

  return {
    render: () => composer.render(),
    resize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio)
      composer.setSize(width, height)
    },
    dispose() {
      for (const pass of composer.passes) pass.dispose()
      composer.dispose()
      target.dispose()
    }
  }
}
