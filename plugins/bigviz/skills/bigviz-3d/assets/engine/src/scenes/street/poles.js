// Street pack - pole furniture: smart lamp pole (智慧灯杆: road + footway LED arms, camera,
// sensor, speaker, info screen, 5G radio), e-police enforcement pole (电子警察 F-pole with
// camera heads per lane), guidance VMS (诱导屏), road-name sign, signal cabinet.
// All local frames: pole at the origin, arm / heads toward local +z.

import * as THREE from 'three'
import { colorMat, lightMat } from '../../render/materials.js'
import { makeCanvas } from '../../render/textures.js'
import { box, cyl, group } from '../../prefabs/kit.js'

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const POLE = () => colorMat('#3d4247', 0.45, 0.7)
const GALV = () => colorMat('#9aa1a6', 0.38, 0.85)
const DARK = () => colorMat('#1f2225', 0.5, 0.4)

function textPlane(w, h, draw, { emissive = false, px = 128 } = {}) {
  const c = makeCanvas(Math.round(w * px), Math.round(h * px))
  draw(c.getContext('2d'), c.width, c.height)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  const m = new THREE.MeshStandardMaterial(emissive ? { color: '#0a0a0a', map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.9, roughness: 0.35 } : { map: t, roughness: 0.5 })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m)
  mesh.userData.keep = true
  return mesh
}

let screenMesh = null
function infoScreen() {
  screenMesh ??= textPlane(0.62, 1.1, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h)
    gr.addColorStop(0, '#0f3a66'); gr.addColorStop(1, '#14233d')
    g.fillStyle = gr; g.fillRect(0, 0, w, h)
    g.fillStyle = '#9fd3ff'; g.font = `bold ${w * 0.13}px sans-serif`; g.textAlign = 'center'
    g.fillText('智慧城市', w / 2, h * 0.14)
    g.fillStyle = '#ffffff'; g.font = `bold ${w * 0.3}px sans-serif`
    g.fillText('3°C', w / 2, h * 0.4)
    g.font = `${w * 0.11}px sans-serif`; g.fillStyle = '#cfe3f7'
    g.fillText('小雨 湿度 92%', w / 2, h * 0.52)
    g.fillText('PM2.5  38  优', w / 2, h * 0.62)
    g.fillStyle = '#ffd36b'; g.fillText('雨天路滑 注意慢行', w / 2, h * 0.8)
  }, { emissive: true, px: 200 })
  return screenMesh.clone()
}

/** smart lamp pole, road arm toward local +z (reach `arm`), footway arm toward -z */
export function smartPole({ h = 10, arm = 2.6, screen = true } = {}) {
  const P = POLE()
  const g = group(
    box(0.62, 0.32, 0.62, colorMat('#5b5f63', 0.7, 0.3), { base: true }),
    cyl(0.2, 0.2, 2.2, P, { base: true, y: 0.32, seg: 12 }),
    cyl(0.12, 0.17, h - 2.5, P, { base: true, y: 2.5, seg: 12 }),
    box(0.06, 0.6, 0.02, colorMat('#c9ccce', 0.4, 0.6), { y: 1.3, z: 0.2 }),
    // sensor pod, speaker, camera dome, 5G radio
    box(0.26, 0.34, 0.26, colorMat('#e6e6e2', 0.5, 0.2), { y: 4.4, z: 0.12 }),
    box(0.22, 0.36, 0.16, DARK(), { y: 5.1, z: -0.14 }),
    cyl(0.16, 0.16, 0.12, colorMat('#e9e9e6', 0.4, 0.3), { y: 6.0, z: 0.2, seg: 12 }),
    cyl(0.12, 0.12, 0.12, colorMat('#15181b', 0.2, 0.2), { y: 5.9, z: 0.2, seg: 12 }),
    cyl(0.14, 0.14, 1.4, colorMat('#e3e3df', 0.45, 0.2), { base: true, y: h - 0.2, seg: 10 })
  )
  // road arm + head, footway arm + small head
  g.add(box(0.1, 0.1, arm, P, { y: h - 0.4, z: arm / 2 }), box(0.07, 0.07, arm * 0.6, P, { y: h - 0.9, z: arm * 0.3, rx: -0.38 }))
  g.add(box(0.42, 0.12, 0.9, colorMat('#4b5157', 0.4, 0.6), { y: h - 0.42, z: arm + 0.3 }), box(0.34, 0.03, 0.74, lightMat('#f6eedd', 3.4, 'street'), { y: h - 0.49, z: arm + 0.3, cast: false }))
  g.add(box(0.08, 0.08, 1.2, P, { y: 5.6, z: -0.6 }), box(0.3, 0.1, 0.5, colorMat('#4b5157', 0.4, 0.6), { y: 5.58, z: -1.25 }), box(0.24, 0.03, 0.4, lightMat('#ffe6c0', 2.6, 'street'), { y: 5.52, z: -1.25, cast: false }))
  if (screen) {
    const s = infoScreen()
    s.position.set(0, 3.0, -0.215)
    s.rotation.y = Math.PI
    g.add(box(0.7, 1.2, 0.18, DARK(), { y: 3.0, z: -0.12 }), s)
  }
  return {
    object: g,
    glows: [
      { pos: V(0, h - 0.6, arm + 0.3), group: 'street', color: '#ffeccd', size: 4, pool: 8 },
      { pos: V(0, 5.4, -1.25), group: 'street', color: '#ffdcae', size: 2.2, pool: 3.5 }
    ]
  }
}

/** e-police pole: F-pole, arm toward local +z over `lanes` lane offsets (local z) */
export function policePole({ heads = [3, 6.5, 9.7, 13], reach = 15 } = {}) {
  const G = GALV()
  const g = group(
    box(0.9, 0.3, 0.9, colorMat('#8e8b83', 0.85), { base: true }),
    cyl(0.17, 0.24, 7.2, G, { base: true, y: 0.3, seg: 10 }),
    box(0.16, 0.24, reach, G, { y: 6.7, z: reach / 2 }),
    box(0.1, 0.12, reach * 0.55, G, { y: 7.3, z: reach * 0.25, rx: -0.09 }),
    box(0.6, 1.2, 0.45, colorMat('#c9cbc8', 0.5, 0.4), { base: true, x: 0.6, z: -0.5 })
  )
  for (const z of heads) {
    // camera housing + IR flash, slightly down-tilted toward oncoming traffic (local +x)
    g.add(box(0.06, 0.25, 0.06, G, { y: 6.45, z }))
    g.add(box(0.62, 0.24, 0.26, colorMat('#e5e6e3', 0.4, 0.3), { x: 0.18, y: 6.25, z, rz: -0.12 }))
    g.add(box(0.04, 0.16, 0.16, colorMat('#101215', 0.15, 0.4), { x: 0.5, y: 6.21, z, rz: -0.12 }))
    g.add(box(0.2, 0.24, 0.3, DARK(), { x: 0.06, y: 6.22, z: z + 0.42 }))
    g.add(box(0.02, 0.18, 0.24, lightMat('#ffe8c8', 0.6, 'street'), { x: 0.17, y: 6.22, z: z + 0.42, cast: false }))
  }
  return { object: g }
}

// guidance screen: canvas redrawn by the pack (route names + congestion colours)
export const VMS = { canvas: null, tex: null }
function vmsMaterial() {
  if (VMS.tex) return VMS.mat
  VMS.canvas = makeCanvas(640, 256)
  VMS.tex = new THREE.CanvasTexture(VMS.canvas)
  VMS.tex.colorSpace = THREE.SRGBColorSpace
  VMS.mat = new THREE.MeshStandardMaterial({ color: '#050505', map: VMS.tex, emissive: '#ffffff', emissiveMap: VMS.tex, emissiveIntensity: 1.25, roughness: 0.3 })
  drawVMS({ E: 0.2, W: 0.4, N: 0.6, S: 0.3 })
  return VMS.mat
}

/** state per direction 0 (free) .. 1 (jammed) */
export function drawVMS(load) {
  if (!VMS.canvas) return
  const g = VMS.canvas.getContext('2d')
  const W = 640
  const H = 256
  const col = (v) => (v < 0.35 ? '#2ee86a' : v < 0.7 ? '#ffc21a' : '#ff3b2a')
  g.fillStyle = '#000'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#ffd36b'
  g.font = 'bold 30px sans-serif'
  g.textAlign = 'left'
  g.fillText('前方路况', 20, 40)
  g.fillStyle = '#9fd3ff'
  g.font = '22px sans-serif'
  g.fillText('雨天路滑 保持车距', 400, 40)
  // cross-shaped map: 中山路 horizontal, 解放路 vertical
  g.lineCap = 'round'
  const seg = (x0, y0, x1, y1, v) => { g.strokeStyle = col(v); g.lineWidth = 22; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke() }
  seg(60, 150, 300, 150, load.W)
  seg(340, 150, 590, 150, load.E)
  seg(320, 64, 320, 128, load.N)
  seg(320, 172, 320, 240, load.S)
  g.fillStyle = '#ffffff'
  g.font = 'bold 24px sans-serif'
  g.fillText('中山路', 80, 196)
  g.fillText('中山路', 470, 196)
  g.fillText('解放路', 340, 92)
  VMS.tex.needsUpdate = true
}

/** VMS gantry: pole at the origin, board over the lanes at local +z */
export function vmsGantry({ reach = 9 } = {}) {
  const G = GALV()
  const g = group(
    box(1, 0.3, 1, colorMat('#8e8b83', 0.85), { base: true }),
    cyl(0.26, 0.32, 8.4, G, { base: true, y: 0.3, seg: 12 }),
    box(0.3, 0.4, reach + 0.6, G, { y: 8.1, z: (reach + 0.6) / 2 }),
    box(0.22, 0.26, reach * 0.7, G, { y: 7.2, z: reach * 0.35 }),
    box(0.4, 2.3, 5.6, DARK(), { x: 0.05, y: 7.0, z: reach })
  )
  // board faces local +x (oncoming drivers)
  const face = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 2.1), vmsMaterial())
  face.position.set(0.26, 7.0, reach)
  face.rotation.y = Math.PI / 2
  face.userData.keep = true
  g.add(face)
  return { object: g }
}

/** blue road-name sign on a post, faces local +z */
export function nameSign({ cn = '中山路', en = 'ZHONGSHAN RD', dir = '→' } = {}) {
  const board = textPlane(1.6, 0.52, (g, w, h) => {
    g.fillStyle = '#1d4f9c'; g.fillRect(0, 0, w, h)
    g.strokeStyle = '#ffffff'; g.lineWidth = h * 0.04; g.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1)
    g.fillStyle = '#ffffff'; g.textAlign = 'center'
    g.font = `bold ${h * 0.42}px sans-serif`; g.fillText(cn, w * 0.45, h * 0.52)
    g.font = `${h * 0.17}px sans-serif`; g.fillText(en, w * 0.45, h * 0.82)
    g.font = `bold ${h * 0.4}px sans-serif`; g.fillText(dir, w * 0.88, h * 0.55)
  })
  board.position.set(0, 2.6, 0.03)
  const back = board.clone()
  back.position.z = -0.03
  back.rotation.y = Math.PI
  return { object: group(cyl(0.04, 0.05, 3.0, GALV(), { base: true, seg: 8 }), box(1.62, 0.54, 0.04, colorMat('#d8dadc', 0.4, 0.6), { y: 2.6 }), board, back) }
}

/** signal / communications cabinet */
export function cabinet({ w = 1.1 } = {}) {
  return { object: group(box(w + 0.1, 0.12, 0.7, colorMat('#8e8b83', 0.85), { base: true }), box(w, 1.55, 0.6, colorMat('#b9bec2', 0.45, 0.5), { base: true, y: 0.12 }), box(w + 0.06, 0.06, 0.66, colorMat('#9ea3a7', 0.4, 0.5), { y: 1.7 }), box(0.3, 0.2, 0.01, colorMat('#f2c230', 0.5), { y: 1.25, z: 0.305 })) }
}
