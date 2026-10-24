// Shared PBR material library. Prefabs ask for materials by role ("paint.yellow", "steel",
// "glass") so a scene can be re-skinned by editing this palette, not every prefab.
// Emissive materials register as "night lit": the EnvironmentSystem scales them with dusk.

import * as THREE from 'three'
import { surface } from './textures.js'
import { realSurface, wearTexture } from './textures-real.js'

const cache = new Map()
/** @type {{ material: THREE.MeshStandardMaterial, base: number, group: string }[]} */
export const nightLit = []

export const PALETTE = {
  'paint.yellow': { color: '#f2b51c', roughness: 0.42, metalness: 0.15 },
  'paint.orange': { color: '#ef7d22', roughness: 0.45, metalness: 0.12 },
  'paint.red': { color: '#c9392b', roughness: 0.45, metalness: 0.12 },
  'paint.white': { color: '#eef0ee', roughness: 0.4, metalness: 0.08 },
  'paint.blue': { color: '#2f66b3', roughness: 0.45, metalness: 0.12 },
  'paint.green': { color: '#3e8a5a', roughness: 0.5, metalness: 0.1 },
  'paint.grey': { color: '#8b9197', roughness: 0.5, metalness: 0.2 },
  'paint.dark': { color: '#2b2f35', roughness: 0.55, metalness: 0.2 },
  steel: { color: '#9aa2aa', roughness: 0.35, metalness: 0.85 },
  'steel.dark': { color: '#4b5158', roughness: 0.45, metalness: 0.8 },
  chrome: { color: '#d8dde2', roughness: 0.15, metalness: 1 },
  rubber: { color: '#1d1e20', roughness: 0.9, metalness: 0 },
  rebar: { color: '#7a4d32', roughness: 0.7, metalness: 0.6 },
  rust: { color: '#8a5634', roughness: 0.8, metalness: 0.3 },
  'concrete.wet': { color: '#7d7a74', roughness: 0.35, metalness: 0 },
  'concrete.fresh': { color: '#a8a49c', roughness: 0.8, metalness: 0 },
  timber: { color: '#c79a5e', roughness: 0.75, metalness: 0 },
  plywood: { color: '#d6b27a', roughness: 0.7, metalness: 0 },
  formwork: { color: '#b8613a', roughness: 0.6, metalness: 0 },
  glass: { color: '#7fa7c4', roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.72 },
  'glass.dark': { color: '#2c3e50', roughness: 0.1, metalness: 0.7 },
  facade: { color: '#e9e4da', roughness: 0.65, metalness: 0.02 },
  'facade.accent': { color: '#556270', roughness: 0.5, metalness: 0.3 },
  brick: { color: '#a5583e', roughness: 0.85, metalness: 0 },
  foliage: { color: '#4f8c3a', roughness: 0.85, metalness: 0 },
  'foliage.light': { color: '#79ac4a', roughness: 0.85, metalness: 0 },
  bark: { color: '#6b4a32', roughness: 0.9, metalness: 0 },
  skin: { color: '#e2b48e', roughness: 0.7, metalness: 0 },
  'cloth.blue': { color: '#33508a', roughness: 0.85, metalness: 0 },
  'cloth.orange': { color: '#f08a24', roughness: 0.8, metalness: 0 },
  'cloth.dark': { color: '#33363b', roughness: 0.85, metalness: 0 },
  'vest.hiviz': { color: '#d6f02e', roughness: 0.6, metalness: 0 },
  'helmet.white': { color: '#f4f4f0', roughness: 0.35, metalness: 0 },
  'helmet.yellow': { color: '#f6c623', roughness: 0.35, metalness: 0 },
  'helmet.red': { color: '#d8452e', roughness: 0.35, metalness: 0 },
  'fence.blue': { color: '#2a5ea8', roughness: 0.55, metalness: 0.2 },
  'fence.white': { color: '#f0f0ea', roughness: 0.55, metalness: 0.1 },
  container: { color: '#c0503a', roughness: 0.55, metalness: 0.45 },
  tarp: { color: '#3d6fb3', roughness: 0.85, metalness: 0 },
  sand: { color: '#cfb27e', roughness: 0.95, metalness: 0 },
  gravel: { color: '#8e8a82', roughness: 0.95, metalness: 0 },
  marking: { color: '#f1efe6', roughness: 0.6, metalness: 0 },
  'marking.yellow': { color: '#f2c230', roughness: 0.6, metalness: 0 },
  paper: { color: '#f2ede1', roughness: 0.9, metalness: 0 },
  ceramic: { color: '#f3f1ec', roughness: 0.25, metalness: 0 },
  water: { color: '#2f6f8f', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 },
  net: { color: '#2e8b57', roughness: 0.9, metalness: 0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }
}

// realistic style overrides: muted real-world colours, measured-ish roughness / metalness.
// wear: true adds a grime / scratch roughness map (only on roles that are not vertex-baked)
const REAL = {
  'paint.yellow': { color: '#c9962a', roughness: 0.5, metalness: 0.2 },
  'paint.orange': { color: '#b8642c', roughness: 0.52, metalness: 0.15 },
  'paint.red': { color: '#8f3329', roughness: 0.5, metalness: 0.15 },
  'paint.white': { color: '#cfd1cf', roughness: 0.45, metalness: 0.1 },
  'paint.blue': { color: '#2f4f78', roughness: 0.5, metalness: 0.15 },
  'paint.green': { color: '#3c5e48', roughness: 0.55, metalness: 0.1 },
  'paint.grey': { color: '#787d82', roughness: 0.55, metalness: 0.25 },
  'paint.dark': { color: '#25282c', roughness: 0.6, metalness: 0.25 },
  steel: { color: '#8c939a', roughness: 0.42, metalness: 0.9, wear: true },
  'steel.dark': { color: '#3f444a', roughness: 0.55, metalness: 0.85, wear: true },
  rebar: { color: '#5e3f2c', roughness: 0.8, metalness: 0.55 },
  rust: { color: '#6e4430', roughness: 0.85, metalness: 0.3 },
  'concrete.wet': { color: '#5f5d59', roughness: 0.22, metalness: 0 },
  'concrete.fresh': { color: '#9a978f', roughness: 0.88, metalness: 0, wear: true },
  timber: { color: '#a07d52', roughness: 0.8, metalness: 0 },
  plywood: { color: '#b39468', roughness: 0.78, metalness: 0 },
  formwork: { color: '#8a4b30', roughness: 0.62, metalness: 0 },
  // curtain wall: tinted, very smooth, reflections come from scene.environment (sky PMREM)
  glass: { color: '#4e6274', roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.88, envMapIntensity: 1.6 },
  'glass.dark': { color: '#1f2a33', roughness: 0.05, metalness: 0.9, envMapIntensity: 1.5 },
  facade: { color: '#b9b5ad', roughness: 0.75, metalness: 0.02, wear: true },
  'facade.accent': { color: '#4a525b', roughness: 0.4, metalness: 0.6 },
  brick: { color: '#80503d', roughness: 0.9, metalness: 0 },
  foliage: { color: '#3f5f2e', roughness: 0.9, metalness: 0 },
  'foliage.light': { color: '#5a7a3a', roughness: 0.9, metalness: 0 },
  bark: { color: '#4a3a2c', roughness: 0.95, metalness: 0 },
  skin: { color: '#b98e70', roughness: 0.6, metalness: 0 },
  'cloth.blue': { color: '#2c3f5e', roughness: 0.92, metalness: 0 },
  'cloth.orange': { color: '#b8682a', roughness: 0.9, metalness: 0 },
  'vest.hiviz': { color: '#b8cc3a', roughness: 0.7, metalness: 0 },
  'helmet.white': { color: '#d8d8d2', roughness: 0.4, metalness: 0 },
  'helmet.yellow': { color: '#d0a62a', roughness: 0.4, metalness: 0 },
  'helmet.red': { color: '#a83a2a', roughness: 0.4, metalness: 0 },
  'fence.blue': { color: '#2a4a78', roughness: 0.6, metalness: 0.3, wear: true },
  'fence.white': { color: '#c9cbc6', roughness: 0.6, metalness: 0.2, wear: true },
  container: { color: '#8c4535', roughness: 0.65, metalness: 0.5, wear: true },
  tarp: { color: '#33557e', roughness: 0.9, metalness: 0 },
  sand: { color: '#a8916a', roughness: 0.97, metalness: 0 },
  gravel: { color: '#76736d', roughness: 0.97, metalness: 0 },
  marking: { color: '#d4d2ca', roughness: 0.7, metalness: 0, wear: 'paint' },
  'marking.yellow': { color: '#c8a23a', roughness: 0.7, metalness: 0, wear: 'paint' },
  water: { color: '#24414e', roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.9 },
  // safety-green dense mesh netting (密目网)
  net: { color: '#2f5a37', roughness: 0.95, metalness: 0, transparent: true, opacity: 0.9, envMapIntensity: 0.4, side: THREE.DoubleSide, depthWrite: false }
}

let STYLE = 'diorama'
export const materialStyle = () => STYLE
/** vertex-colour batch materials (kit.bake) register here so the style can tune them */
export const vcMaterials = new Set()

const roleSpec = (role) => (STYLE === 'realistic' && REAL[role]) || PALETTE[role]

function applyRole(m, role) {
  const { wear, ...p } = roleSpec(role)
  m.color.set(p.color)
  m.roughness = p.roughness
  m.metalness = p.metalness
  m.envMapIntensity = p.envMapIntensity ?? 1
  if (p.opacity != null) m.opacity = p.opacity
  const w = STYLE === 'realistic' && wear ? wearTexture(wear === 'paint' ? 'paint' : 'grime') : null
  m.roughnessMap = w?.rough || null
  m.map = wear === 'paint' ? w?.map || null : null
  m.needsUpdate = true
}

/** Shared material by palette role */
export function mat(role) {
  if (cache.has(role)) return cache.get(role)
  const p = PALETTE[role]
  if (!p) throw new Error(`Unknown material role: ${role}`)
  const m = new THREE.MeshStandardMaterial({ ...p, emissive: p.emissive || '#000000' })
  m.name = role
  m.userData.role = role
  if (STYLE !== 'diorama') applyRole(m, role)
  cache.set(role, m)
  return m
}

/** Realistic: pull saturated toy colours toward real-world values (less chroma, less extreme L) */
export function tone(color, out = new THREE.Color()) {
  out.set(color)
  const hsl = out.getHSL({ h: 0, s: 0, l: 0 })
  return out.setHSL(hsl.h, hsl.s * 0.62, 0.1 + hsl.l * 0.78)
}

function applyColor(m) {
  const o = m.userData.orig
  m.color.copy(o.color)
  m.roughness = o.roughness
  if (STYLE === 'realistic') {
    tone(o.color, m.color)
    m.roughness = Math.min(1, o.roughness + 0.08)
  }
}

/** Ad-hoc colour material, cached by params */
export function colorMat(color, roughness = 0.6, metalness = 0) {
  const key = `c:${color}:${roughness}:${metalness}`
  if (!cache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness })
    m.userData.orig = { color: m.color.clone(), roughness }
    if (STYLE !== 'diorama') applyColor(m)
    cache.set(key, m)
  }
  return cache.get(key)
}

/**
 * Switch the palette ('diorama' | 'realistic'). Re-applies to every cached role / colour
 * material and vertex-colour batch material. Call before the scene is built: baked vertex
 * colours and procedural surfaces are captured at build time.
 */
export function setMaterialStyle(id) {
  STYLE = id === 'realistic' ? 'realistic' : 'diorama'
  for (const m of cache.values()) {
    if (m.userData.role) applyRole(m, m.userData.role)
    else if (m.userData.orig) applyColor(m)
  }
  for (const m of vcMaterials) styleVC(m)
}

/** Vertex-colour batches (vehicles, people, machines): grime roughness map in realistic */
export function styleVC(m) {
  const real = STYLE === 'realistic'
  const w = real ? wearTexture('grime') : null
  m.roughnessMap = w?.rough || null
  m.map = w?.map || null
  m.roughness = (m.userData.baseRough ??= m.roughness) + (real ? 0.08 : 0)
  m.needsUpdate = true
  return m
}

/** Textured PBR surface: concrete, asphalt, soil, grass, paving, wood, plinth */
export function surfaceMat(name, repeat = 1, tint = '#ffffff') {
  const key = `s:${name}:${repeat}:${tint}:${STYLE}`
  if (cache.has(key)) return cache.get(key)
  const t = STYLE === 'realistic' ? realSurface(name, repeat) : surface(name, repeat)
  const m = new THREE.MeshStandardMaterial({ color: tint, ...t, roughness: 1, metalness: 0, aoMapIntensity: 0.8 })
  m.name = `surface.${name}`
  cache.set(key, m)
  return m
}

/**
 * Emissive material that brightens at night (lamps, windows, beacons, head lights).
 * group lets systems toggle subsets ("street", "site", "windows", "vehicle").
 */
export function lightMat(color = '#ffd27a', intensity = 2.4, group = 'street') {
  const key = `l:${color}:${intensity}:${group}`
  if (cache.has(key)) return cache.get(key)
  const m = new THREE.MeshStandardMaterial({ color: '#2a2a2a', emissive: color, emissiveIntensity: 0.05, roughness: 0.4 })
  m.name = `light.${group}`
  nightLit.push({ material: m, base: intensity, group })
  cache.set(key, m)
  return m
}

/** Register a custom material (e.g. window pattern with emissiveMap) as night lit */
export function registerNightLit(material, base = 1.6, group = 'windows') {
  material.emissiveIntensity = 0.02
  nightLit.push({ material, base, group })
  return material
}

/** Always-on emissive (screens, beacons that blink in code) - not tied to night */
export function glowMat(color, intensity = 1.5) {
  const key = `g:${color}:${intensity}`
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color: '#111111', emissive: color, emissiveIntensity: intensity }))
  return cache.get(key)
}

/** Material clone that can be tinted per instance (e.g. selected highlight) */
export function own(m) {
  const c = m.clone()
  c.userData.owned = true
  return c
}
