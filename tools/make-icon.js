'use strict'

// Produces the two image assets the app ships:
//
//  * assets/icon.png       — the Dock icon, rasterised from assets/icon.svg,
//                            which is the source of truth for the artwork.
//  * src/assets/tray*.png  — the menu-bar icon, drawn here instead. A 16px
//                            monochrome glyph is not a shrunken app icon; the
//                            arrows and the </> turn to mud at that size, so
//                            the tray keeps only the two-tile motif.
//
// The tray drawing uses signed distance fields, so its edges are antialiased
// analytically rather than by supersampling. No image libraries either way.

const { execFileSync } = require('node:child_process')
const zlib = require('node:zlib')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const SIZE = 1024

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

/** Pixel coverage for a signed distance: 1 inside, 0 outside, soft across the edge. */
const coverage = d => clamp(0.5 - d, 0, 1)

// ----------------------------------------------------------- tray template ---

// An outlined tile behind a filled one: at 16px two filled tiles merge into a
// single blob, and two outlined ones lose their edges entirely.
// Black + alpha only — macOS treats it as a template and inverts it as needed.
function renderTray (size) {
  const px = new Float64Array(size * size * 4)
  const s = size / 32

  const back = { cx: 12.4 * s, cy: 12.4 * s, hw: 8.2 * s, r: 2.9 * s }
  const front = { cx: 20.2 * s, cy: 20.2 * s, hw: 8.2 * s, r: 2.9 * s }
  const stroke = 2.3 * s

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const cx = x + 0.5
      const cy = y + 0.5

      // Ring of the back tile, minus where the front tile (plus a gap) covers it.
      const ring = Math.abs(sdRoundRect(cx, cy, back.cx, back.cy, back.hw, back.hw, back.r)) - stroke / 2
      const cut = coverage(sdRoundRect(cx, cy, front.cx, front.cy,
        front.hw + stroke * 0.6, front.hw + stroke * 0.6, front.r + stroke * 0.6))
      const ringA = coverage(ring) * (1 - cut)

      const frontA = coverage(sdRoundRect(cx, cy, front.cx, front.cy, front.hw, front.hw, front.r))

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

// --------------------------------------------------------------------- main ---

const svg = path.join(ROOT, 'assets', 'icon.svg')
const dest = path.join(ROOT, 'assets', 'icon.png')
fs.mkdirSync(path.dirname(dest), { recursive: true })

// require('electron') from Node resolves to the path of the binary, not the API.
const electron = require('electron')
execFileSync(electron, [path.join(__dirname, 'rasterize-icon.js'), svg, dest, String(SIZE)], {
  stdio: ['ignore', 'ignore', 'inherit'],
  cwd: ROOT
})
if (!fs.existsSync(dest)) throw new Error('icon rasterisation produced no file')
console.log(`icon: ${path.relative(process.cwd(), dest)} (${SIZE}×${SIZE}, from icon.svg)`)

// Tray images ship inside src/ so they are packaged with the app.
const trayDir = path.join(ROOT, 'src', 'assets')
fs.mkdirSync(trayDir, { recursive: true })
for (const [px, name] of [[16, 'trayTemplate.png'], [32, 'trayTemplate@2x.png']]) {
  const f = path.join(trayDir, name)
  fs.writeFileSync(f, encodePng(px, renderTray(px)))
  console.log(`tray: ${path.relative(process.cwd(), f)} (${px}x${px})`)
}
