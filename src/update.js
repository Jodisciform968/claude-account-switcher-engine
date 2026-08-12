'use strict'

// Self-update from GitHub releases.
//
// Electron's own autoUpdater is not an option here: on macOS it goes through
// Squirrel, which refuses anything without a Developer ID signature. This app
// is ad-hoc signed, so the update is done by hand — download the release zip,
// check it against the checksum published beside it, unpack it, and swap the
// bundle while the app is on its way out.
//
// One useful side effect of downloading it ourselves: the quarantine flag is
// applied by whatever downloads a file, and Electron's net stack does not set
// it. So updates install cleanly even though the *first* download, made in a
// browser, needs Gatekeeper talked round. See README.
//
// Everything here is opt-in and reversible: the old bundle is moved aside, not
// deleted, and put back if the copy fails.

const { app, net } = require('electron')
const { execFile, spawn } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

const macos = require('./macos')

const REPO = repoFromPackage()
const API = `https://api.github.com/repos/${REPO}/releases/latest`
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`

function repoFromPackage () {
  try {
    const url = require('../package.json').repository?.url || ''
    const m = url.match(/github\.com[/:]([^/]+\/[^/.]+)/)
    if (m) return m[1]
  } catch {}
  return 'pstarostka/claude-account-switcher-engine'
}

// ------------------------------------------------------------------ version ---

/** Compare dotted numeric versions. Any pre-release suffix loses to the release. */
function compareVersions (a, b) {
  const parse = v => String(v).replace(/^v/, '').split(/[-+]/)[0].split('.').map(n => parseInt(n, 10) || 0)
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d < 0 ? -1 : 1
  }
  const pre = v => (/-/.test(String(v)) ? 0 : 1)
  return pre(a) - pre(b)
}

// -------------------------------------------------------------------- fetch ---

async function getJson (url) {
  const res = await net.fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `CASE/${app.getVersion()}` }
  })
  if (!res.ok) {
    const err = new Error(`GitHub returned ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

async function getText (url) {
  const res = await net.fetch(url, { headers: { 'User-Agent': `CASE/${app.getVersion()}` } })
  if (!res.ok) throw new Error(`GitHub returned ${res.status}`)
  return res.text()
}

/**
 * What the latest release is, and whether it is newer than what is running.
 * Never throws at the caller: a check that cannot reach GitHub is not an error
 * worth interrupting anyone over.
 */
async function check () {
  const current = app.getVersion()
  try {
    const rel = await getJson(API)
    if (rel.draft) return { ok: true, available: false, current }

    const version = String(rel.tag_name || '').replace(/^v/, '')
    const asset = (rel.assets || []).find(a => /\.zip$/i.test(a.name))
    const sum = (rel.assets || []).find(a => /\.zip\.sha256$/i.test(a.name))

    return {
      ok: true,
      current,
      version,
      available: Boolean(asset) && compareVersions(version, current) > 0,
      notes: String(rel.body || '').slice(0, 2000),
      publishedAt: rel.published_at ? Date.parse(rel.published_at) : null,
      url: asset?.browser_download_url || null,
      bytes: asset?.size || null,
      sha256Url: sum?.browser_download_url || null,
      page: rel.html_url || RELEASES_PAGE
    }
  } catch (e) {
    // A repo with no releases yet answers 404 here. GitHub was reached and
    // answered honestly, so reporting it as unreachable would be a lie.
    if (e.status === 404) {
      return { ok: true, current, available: false, none: true, page: RELEASES_PAGE }
    }
    return { ok: false, current, error: e.message, page: RELEASES_PAGE }
  }
}

// ----------------------------------------------------------------- download ---

function sha256 (file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256')
    fs.createReadStream(file)
      .on('data', d => h.update(d))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')))
  })
}

const runp = (cmd, args) => new Promise((resolve, reject) =>
  execFile(cmd, args, { maxBuffer: 1 << 20 }, (err, out) => (err ? reject(err) : resolve(String(out)))))

/**
 * Fetch the release zip and prove it is what the release says it is. Without a
 * Developer ID signature to lean on, the published checksum is the only thing
 * standing between a download and running whatever arrived — so a release with
 * no .sha256 beside it is refused rather than trusted.
 */
async function download (info, onProgress) {
  if (!info?.url) return { error: 'That release has no download attached.' }
  if (!info.sha256Url) return { error: 'That release has no checksum published, so it will not be installed.' }

  const stage = await fsp.mkdtemp(path.join(os.tmpdir(), 'case-update-'))
  const zip = path.join(stage, 'CASE.zip')

  const res = await net.fetch(info.url, { headers: { 'User-Agent': `CASE/${app.getVersion()}` } })
  if (!res.ok) return { error: `Download failed: GitHub returned ${res.status}` }

  const total = Number(res.headers.get('content-length')) || info.bytes || 0
  const out = fs.createWriteStream(zip)
  let seen = 0
  for await (const chunk of res.body) {
    seen += chunk.length
    out.write(Buffer.from(chunk))
    if (onProgress && total) onProgress(Math.min(1, seen / total))
  }
  await new Promise(r => out.end(r))

  const expected = (await getText(info.sha256Url)).trim().split(/\s+/)[0].toLowerCase()
  const actual = (await sha256(zip)).toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(expected) || expected !== actual) {
    await fsp.rm(stage, { recursive: true, force: true })
    return { error: 'The download did not match its published checksum, so it was discarded.' }
  }

  return { stage, zip }
}

// -------------------------------------------------------------------- apply ---

/**
 * Swap the bundle and relaunch.
 *
 * The replacement cannot happen in-process — the code doing it lives inside the
 * bundle being replaced — so it is handed to a detached shell script that waits
 * for this process to exit first. The old bundle is moved aside rather than
 * deleted, and moved back if the copy fails, so a failure here leaves a working
 * app rather than none.
 */
async function apply (staged) {
  if (!app.isPackaged) return { error: 'Updates only apply to an installed build, not to `npm start`.' }

  const dest = macos.bundlePath()
  if (!dest.endsWith('.app')) return { error: 'Could not work out where this app is installed.' }
  try {
    await fsp.access(path.dirname(dest), fs.constants.W_OK)
  } catch {
    return { error: `No permission to replace ${dest}. Move the app somewhere you own, such as ~/Applications.` }
  }

  const unpacked = path.join(staged.stage, 'unpacked')
  await fsp.mkdir(unpacked, { recursive: true })
  try {
    await runp('/usr/bin/ditto', ['-x', '-k', staged.zip, unpacked])
  } catch (e) {
    return { error: `Could not unpack the download: ${e.message}` }
  }

  const entries = await fsp.readdir(unpacked)
  const name = entries.find(n => n.endsWith('.app'))
  if (!name) return { error: 'The download did not contain an app.' }
  const fresh = path.join(unpacked, name)

  // Refuse anything that is not recognisably this app, however it got here.
  try {
    const plist = await fsp.readFile(path.join(fresh, 'Contents', 'Info.plist'), 'utf8')
    if (!plist.includes('local.launcher.case')) {
      return { error: 'The download is not CASE, so it was not installed.' }
    }
  } catch {
    return { error: 'The download does not look like a macOS app bundle.' }
  }

  const script = path.join(staged.stage, 'swap.sh')
  await fsp.writeFile(script, `#!/bin/sh
# Wait for CASE to exit before touching its own bundle.
for i in $(seq 1 200); do
  kill -0 ${process.pid} 2>/dev/null || break
  sleep 0.1
done

DEST=${JSON.stringify(dest)}
FRESH=${JSON.stringify(fresh)}
STAGE=${JSON.stringify(staged.stage)}

rm -rf "$DEST.old"
mv "$DEST" "$DEST.old" || exit 1
if ! cp -R "$FRESH" "$DEST"; then
  rm -rf "$DEST"
  mv "$DEST.old" "$DEST"
  exit 1
fi
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null
rm -rf "$DEST.old"
open "$DEST"
rm -rf "$STAGE"
`, { mode: 0o755 })

  spawn('/bin/sh', [script], { detached: true, stdio: 'ignore' }).unref()
  return { ok: true, relaunching: true }
}

module.exports = { check, download, apply, compareVersions, RELEASES_PAGE, REPO }
