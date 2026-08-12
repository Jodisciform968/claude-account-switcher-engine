'use strict'

// Menu-bar mode: the whole picker as a menu, so switching account never needs a
// window at all.

const { Tray, Menu, nativeImage } = require('electron')
const path = require('node:path')

let tray = null
let deps = null

function icon () {
  const img = nativeImage.createFromPath(path.join(__dirname, 'assets', 'trayTemplate.png'))
  // Template images are recoloured by macOS to suit the menu bar, including
  // when it inverts for dark mode or a highlighted menu.
  img.setTemplateImage(true)
  return img
}

async function buildMenu () {
  const { accounts, issues } = await deps.getState()

  const items = accounts.map(a => ({
    label: (a.emoji ? `${a.emoji}  ` : '') + (a.running ? `${a.name}  ●` : a.name),
    // A checkmark would imply a selection; the dot just marks what is open.
    click: () => deps.onLaunch(a.id)
  }))

  if (!items.length) items.push({ label: 'No accounts yet', enabled: false })

  return Menu.buildFromTemplate([
    ...items,
    { type: 'separator' },
    { label: issues ? `Session health (${issues})` : 'Session health', click: deps.onOpenHealth },
    { label: 'Settings…', click: deps.onOpenSettings },
    { label: 'Open CASE', click: deps.onOpenWindow },
    { type: 'separator' },
    { label: 'Quit CASE', accelerator: 'Command+Q', click: deps.onQuit }
  ])
}

async function refresh () {
  if (!tray || tray.isDestroyed()) return
  try { tray.setContextMenu(await buildMenu()) } catch {}
}

async function enable (dependencies) {
  deps = dependencies || deps
  if (tray && !tray.isDestroyed()) return refresh()

  tray = new Tray(icon())
  tray.setToolTip('CASE — Claude Account Switcher Engine')
  await refresh()

  // Rebuild on open so running state is current, not as of the last poll.
  tray.on('mouse-down', refresh)
}

function disable () {
  if (tray && !tray.isDestroyed()) tray.destroy()
  tray = null
}

const isEnabled = () => Boolean(tray && !tray.isDestroyed())

module.exports = { enable, disable, refresh, isEnabled }
