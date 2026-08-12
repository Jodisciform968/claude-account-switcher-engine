'use strict'

// Small macOS affordances that need the shell rather than an Electron API.

const path = require('node:path')
const { execFile } = require('node:child_process')

function run (cmd, args, timeout = 8000) {
  return new Promise(resolve => {
    execFile(cmd, args, { timeout }, (err, stdout, stderr) =>
      resolve({ ok: !err, out: stdout || '', err: stderr || '' }))
  })
}

/** This launcher's .app bundle, derived from the running executable. */
function bundlePath () {
  // …/Claude Accounts.app/Contents/MacOS/Claude Accounts → …/Claude Accounts.app
  return path.resolve(process.execPath, '..', '..', '..')
}

// -------------------------------------------------------------------- dock ---

async function isPinned () {
  const app = bundlePath()
  const { ok, out } = await run('/usr/bin/defaults', ['read', 'com.apple.dock', 'persistent-apps'])
  if (!ok) return false

  // The Dock rewrites entries percent-encoded ("Claude%20Accounts.app"), so a
  // literal path never matches what it stored. Decode before comparing.
  for (const m of out.matchAll(/"_CFURLString"\s*=\s*"([^"]+)"/g)) {
    let url = m[1]
    try { url = decodeURIComponent(url) } catch {}
    if (url.replace(/^file:\/\//, '').replace(/\/$/, '') === app) return true
  }
  return false
}

/**
 * Add the launcher to the Dock permanently. The Dock only re-reads its
 * preferences on restart, so `killall Dock` is part of the operation, not an
 * optional extra — without it the tile does not appear until the next login.
 */
async function pinToDock () {
  if (await isPinned()) return { ok: true, already: true }

  const app = bundlePath()
  const tile = '<dict><key>tile-data</key><dict><key>file-data</key><dict>' +
    `<key>_CFURLString</key><string>file://${encodeURI(app)}/</string>` +
    '<key>_CFURLStringType</key><integer>15</integer>' +
    '</dict></dict><key>tile-type</key><string>file-tile</string></dict>'

  const w = await run('/usr/bin/defaults', ['write', 'com.apple.dock', 'persistent-apps', '-array-add', tile])
  if (!w.ok) return { ok: false, error: 'Could not write Dock preferences.' }

  await run('/usr/bin/killall', ['Dock'])
  // The Dock takes a moment to come back and rewrite its plist.
  await new Promise(r => setTimeout(r, 1500))
  return { ok: await isPinned(), already: false }
}

// ---------------------------------------------------------------- processes ---

const MAIN_BINARY = /Claude\.app\/Contents\/MacOS\/Claude$/

/**
 * The Claude process holding a given profile directory.
 *
 * macOS hides process environments, so there is no way to ask a running Claude
 * which profile it uses — but the files it holds open give it away. Helper
 * processes turn up too, so the list is filtered down to the main binary; ending
 * that takes its helpers with it.
 */
async function pidsForProfile (dir, fsExists) {
  const probes = ['Cookies', 'Local Storage/leveldb/LOCK', 'Network Persistent State']
    .map(p => path.join(dir, p))
    .filter(fsExists)

  const found = new Set()
  for (const f of probes) {
    const { ok, out } = await run('/usr/sbin/lsof', ['-t', '--', f], 4000)
    if (!ok) continue
    for (const line of out.split('\n')) {
      const pid = parseInt(line.trim(), 10)
      if (pid) found.add(pid)
    }
  }
  if (!found.size) return []

  const { out } = await run('/bin/ps', ['-o', 'pid=,command=', '-p', [...found].join(',')])
  return out.split('\n')
    .map(l => l.trim().match(/^(\d+)\s+(.*)$/))
    .filter(m => m && MAIN_BINARY.test(m[2]))
    .map(m => Number(m[1]))
}

/** Ask one Claude instance to quit, leaving any other account running. */
async function quitProfile (dir, fsExists) {
  const pids = await pidsForProfile(dir, fsExists)
  if (!pids.length) return { ok: false, error: 'Could not find the process for that account.' }
  for (const pid of pids) {
    try { process.kill(pid, 'SIGTERM') } catch {}
  }
  return { ok: true, count: pids.length }
}

module.exports = { bundlePath, isPinned, pinToDock, pidsForProfile, quitProfile }
