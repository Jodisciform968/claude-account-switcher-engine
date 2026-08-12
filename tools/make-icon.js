'use strict'

// Renders assets/icon.png from scratch — no image libraries.
// Shapes are drawn from signed distance fields, so edges are antialiased
// analytically rather than by supersampling.

const zlib = require('node:zlib')
const fs = require('node:fs')
const path = require('node:path')

const SIZE = 1024

// Indigo plate, warm overlapping discs: reads as "accounts", and stays clearly
// distinct from Claude's own icon at Dock size.
const BG_TOP = [0x33, 0x2C, 0x5B]
const BG_BOTTOM = [0x5A, 0x42, 0x7A]
const DISC_BACK = [0xEF, 0xE8, 0xDD]
const DISC_FRONT = [0xD9, 0x77, 0x57]

// ------------------------------------------------------------------ shapes ---

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

/** Signed distance to a rounded rectangle centred at (cx, cy). */
function sdRoundRect (x, y, cx, cy, hw, hh, r) {
  const dx = Math.abs(x - cx) - (hw - r)
  const dy = Math.abs(y - cy) - (hh - r)
  const ax = Math.max(dx, 0)
  const ay = Math.max(dy, 0)
  return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0) - r
}

const sdCircle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r

/** Pixel coverage for a signed distance: 1 inside, 0 outside, soft across the edge. */
const coverage = d => clamp(0.5 - d, 0, 1)

/** Straight-alpha source-over. */
function over (dst, i, rgb, a) {
  if (a <= 0) return
  const inv = 1 - a
  dst[i] = rgb[0] * a + dst[i] * inv
  dst[i + 1] = rgb[1] * a + dst[i + 1] * inv
  dst[i + 2] = rgb[2] * a + dst[i + 2] * inv
  dst[i + 3] = 255 * a + dst[i + 3] * inv
}

function render (size) {
  const px = new Float64Array(size * size * 4)
  const s = size / 1024

  const plate = { cx: size / 2, cy: size / 2, hw: 448 * s, hh: 448 * s, r: 229 * s }
  const back = { cx: 424 * s, cy: 430 * s, r: 176 * s }
  const front = { cx: 606 * s, cy: 596 * s, r: 208 * s }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const cx = x + 0.5
      const cy = y + 0.5

      const plateA = coverage(sdRoundRect(cx, cy, plate.cx, plate.cy, plate.hw, plate.hh, plate.r))
      if (plateA <= 0) continue

      const t = clamp((cy - (plate.cy - plate.hh)) / (plate.hh * 2), 0, 1)
      const bg = [
        BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t,
        BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t,
        BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t
      ]
      over(px, i, bg, plateA)

      // Back disc, clipped to the plate.
      over(px, i, DISC_BACK, coverage(sdCircle(cx, cy, back.cx, back.cy, back.r)) * plateA)

      // Dark separation ring, then the front disc on top of it.
      const ringA = coverage(sdCircle(cx, cy, front.cx, front.cy, front.r + 22 * s)) * plateA
      over(px, i, [0x2A, 0x24, 0x4C], ringA * 0.85)
      over(px, i, DISC_FRONT, coverage(sdCircle(cx, cy, front.cx, front.cy, front.r)) * plateA)
    }
  }

  const out = Buffer.alloc(size * size * 4)
  for (let i = 0; i < px.length; i++) out[i] = clamp(Math.round(px[i]), 0, 255)
  return out
}

// --------------------------------------------------------------- png output ---

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32 (buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk (type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng (size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8    // bit depth
  ihdr[9] = 6    // truecolour with alpha
  // 10..12 stay zero: deflate, adaptive filtering, no interlace

  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ----------------------------------------------------------- tray template ---

// A menu-bar icon is monochrome and tiny, so it gets its own drawing rather
// than a scaled-down app icon: a filled disc over an outlined one, which stays
// legible at 16px where two filled discs would merge into a blob.
// Black + alpha only — macOS treats it as a template and inverts it as needed.
function renderTray (size) {
  const px = new Float64Array(size * size * 4)
  const s = size / 32

  const back = { cx: 12.2 * s, cy: 13 * s, r: 8.0 * s }
  const front = { cx: 20.4 * s, cy: 19.2 * s, r: 8.2 * s }
  const stroke = 2.2 * s

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const cx = x + 0.5
      const cy = y + 0.5

      // Outlined back disc: the ring only, and not where the front disc covers it.
      const dBack = Math.abs(sdCircle(cx, cy, back.cx, back.cy, back.r)) - stroke / 2
      const ringA = coverage(dBack) * (1 - coverage(sdCircle(cx, cy, front.cx, front.cy, front.r + stroke * 0.55)))

      // Front disc, solid.
      const frontA = coverage(sdCircle(cx, cy, front.cx, front.cy, front.r))

      const a = Math.min(1, ringA + frontA)
      if (a <= 0) continue
      px[i] = 0; px[i + 1] = 0; px[i + 2] = 0
      px[i + 3] = 255 * a
    }
  }

  const out = Buffer.alloc(size * size * 4)
  for (let i = 0; i < px.length; i++) out[i] = clamp(Math.round(px[i]), 0, 255)
  return out
}

// --------------------------------------------------------------------- main ---

const dest = path.join(__dirname, '..', 'assets', 'icon.png')
fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.writeFileSync(dest, encodePng(SIZE, render(SIZE)))
console.log(`icon: ${path.relative(process.cwd(), dest)} (${SIZE}×${SIZE})`)

// Tray images ship inside src/ so they are packaged with the app.
const trayDir = path.join(__dirname, '..', 'src', 'assets')
fs.mkdirSync(trayDir, { recursive: true })
for (const [px, name] of [[16, 'trayTemplate.png'], [32, 'trayTemplate@2x.png']]) {
  const f = path.join(trayDir, name)
  fs.writeFileSync(f, encodePng(px, renderTray(px)))
  console.log(`tray: ${path.relative(process.cwd(), f)} (${px}x${px})`)
}
