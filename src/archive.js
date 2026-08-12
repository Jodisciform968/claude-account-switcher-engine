'use strict'

// Profile lifecycle: measure a profile, and move one aside without deleting it.
//
// Archiving is a rename inside the same directory, never a copy-then-delete.
// That matters for more than speed: a rename is atomic and reversible, so there
// is no window where the data exists in two half-states, and no path where a
// failure half-way through loses anything. A profile is 0.5–8 GB, so copying it
// would also be minutes of I/O to achieve strictly less.
//
// Nothing here deletes, with one exception that is named as such and sits behind
// its own confirmation.

const { execFile } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const SUFFIX = '.archived'

/** Disk usage in bytes. `du` beats walking the tree: 8 GB measured in ~110 ms. */
function size (dir) {
  return new Promise(resolve => {
    if (!fs.existsSync(dir)) return resolve(null)
    execFile('/usr/bin/du', ['-sk', dir], { timeout: 20000 }, (err, stdout) => {
      if (err) return resolve(null)
      const kb = Number(String(stdout).trim().split(/\s+/)[0])
      resolve(Number.isFinite(kb) ? kb * 1024 : null)
    })
  })
}

/** First free path of the form `base`, `base-2`, `base-3`… */
function freePath (base) {
  let p = base
  for (let i = 2; fs.existsSync(p); i++) p = `${base}-${i}`
  return p
}

const isArchivePath = name => name.includes(SUFFIX)

/**
 * Move a profile aside. Returns the record to store, or an error. The caller is
 * responsible for the guards that make this safe to offer at all — not the
 * default profile, not while it is running.
 */
function archive (account, bytes) {
  if (!fs.existsSync(account.dir)) return { error: 'That profile folder is no longer there.' }
  const dest = freePath(account.dir + SUFFIX)
  try {
    fs.renameSync(account.dir, dest)
  } catch (e) {
    return { error: `Could not move the profile aside: ${e.message}` }
  }
  return {
    record: {
      id: account.id,
      name: account.name,
      emoji: account.emoji,
      hue: account.hue,
      chrome: account.chrome,
      dir: dest,
      originalDir: account.dir,
      archivedAt: Date.now(),
      bytes: bytes ?? null
    }
  }
}

/**
 * Move an archived profile back. If something has since taken its old path — a
 * new account of the same name, say — it lands beside it rather than over it.
 */
function restore (record) {
  if (!fs.existsSync(record.dir)) return { error: 'The archived folder is no longer there.' }
  const dest = freePath(record.originalDir)
  try {
    fs.renameSync(record.dir, dest)
  } catch (e) {
    return { error: `Could not move the profile back: ${e.message}` }
  }
  return { dir: dest, renamed: dest !== record.originalDir }
}

/** The one destructive call here. Named plainly; confirmed by the caller. */
function destroy (record) {
  try {
    fs.rmSync(record.dir, { recursive: true, force: true })
    return { ok: true }
  } catch (e) {
    return { error: `Could not delete the archive: ${e.message}` }
  }
}

/** Records whose folder has gone missing are reported, not silently dropped. */
function withStatus (records) {
  return (records || []).map(r => ({ ...r, exists: fs.existsSync(r.dir) }))
}

module.exports = { size, archive, restore, destroy, withStatus, isArchivePath, SUFFIX }
