# CASE

**Claude Account Switcher Engine**

A small Electron launcher for running **multiple Claude Desktop accounts** on one
Mac — side by side, with your settings and skills shared between them.

Click the Dock icon, pick an account, Claude opens signed in as that account.

```
┌────────────────────────────────────────┐
│              CASE                      │
│                                        │
│   💼   Work                    ●   ⌘1  │
│        Running · 29 sessions           │
│        ▇▇▇▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁ │
│   PE   Personal                    ⌘2  │
│        2h ago · 3 sessions · Chrome    │
│        ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▁▁▁▁▁▁▁▁▁▁▁▁▁ │
│                                        │
│   + Add account          ⚙   ⛨ Sessions│
└────────────────────────────────────────┘
```

`●` marks an account that is already open. Hovering a card reveals edit, Chrome
pairing, reveal-in-Finder, quit and remove.

Each account can carry its own **icon and colour** — the pencil button opens an
Edit sheet with the name, an emoji and a palette, previewed as you pick. Leave
either on *Automatic* and you get initials over a colour hashed from the name.
Accounts also remember when you last opened them; **Settings → Sort by most
recently used** moves the last one you used to the top, taking `⌘1`–`⌘9` with
it. That is off by default, because with two accounts the order would flip on
every switch.

The bar along the bottom of a card is **plan usage** — whichever of the
five-hour and weekly limits is further along, turning amber past 75% and red
past 90%. Hover for both figures. Claude records this itself every five minutes
in `plan-usage-history.json`; CASE only reads it, and says "as of" rather than
pretending to be live.

## Install

```bash
npm install
npm run build
```

That builds `~/Applications/CASE.app` and installs it. Open it once
from Finder, then right-click its Dock icon → **Options → Keep in Dock**.

Rebuilding installs to the same path, so a pinned Dock tile keeps working.
If the tile shows a stale icon, run `killall Dock`.

## How it works

> Verified against **Claude Desktop 1.26832.0** on macOS 26. Everything below is
> internal detail of another app, observed on disk — it can change with any
> Claude update. If something here stops matching, trust the app, not this file.

Claude Desktop reads `CLAUDE_USER_DATA_DIR` at startup:

```js
if (process.env.CLAUDE_USER_DATA_DIR) {
  app.setPath('userData', e)
  app.setPath('logs', path.resolve(e, 'Logs'))
}
```

So an account is just a directory. The launcher runs:

```bash
open -n -a Claude --env "CLAUDE_USER_DATA_DIR=$HOME/Library/Application Support/Claude-Work"
```

Claude has no single-instance lock, so several accounts run at once.

Profiles live in `~/Library/Application Support/Claude-<name>`. The account list
is `~/Library/Application Support/CASE/accounts.json` — plain JSON, safe
to edit by hand. A v1 `accounts.tsv` is migrated automatically on first run.

## What is shared, what is not

`~/.claude` sits outside the profile directory, so **every account shares it
automatically** — nothing to configure:

| Shared via `~/.claude` | Per-account (inside the profile) |
| --- | --- |
| `settings.json` | the signed-in account |
| skills, plugins, agents | cookies, local storage, IndexedDB |
| project transcripts (`projects/`) | the app's session list |
| MCP servers from `~/.claude.json` | app preferences, theme, window state |

### Sessions cannot be shared between accounts

The desktop app's session index is keyed by account:

```
claude-code-sessions/<accountUuid>/<orgUuid>/local_*.json
```

Two accounts always land in different namespaces. **Do not try to bridge them
with a symlink.** The app's `ensureStorageDir` rejects a symlinked storage
directory:

```
ENOTDIR: not a directory, open '.../claude-code-sessions/<account>/<org>'
    at ensureStorageDir → writeSessionToDisk
```

It logs that and carries on with the session held only in memory. Everything
looks fine until you quit — and then the session is gone from the list. This
launcher deliberately does nothing clever with the session store.

Conversation *content* is safer than the index: Claude Code writes transcripts to
`~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl` independently, so they
survive even when the index does not. To recover a session whose entry vanished:

```bash
cd <the session's cwd> && claude --resume <sessionId>
```

## Everyday use

- **Keyboard.** `↑`/`↓` moves, `Return` opens, `⌘1`–`⌘9` opens an account
  directly. Each card shows its own shortcut. `Esc` closes the launcher.
- **Quit one account.** Running accounts get a power button. macOS gives you no
  way to tell two "Claude" processes apart — same bundle, same name in Activity
  Monitor — but `lsof` on a profile yields the pid holding it, so this quits one
  account and leaves the others running.
- **Summon from anywhere.** `⌥⌘C` by default; press it again to put the launcher
  away. Rebind it in **Settings** (the gear) by clicking the shortcut and
  pressing the combination you want — a combination another app already owns is
  refused rather than silently ignored.
- **Launch at login.** Off by default. When on, the launcher starts hidden and
  waits for the shortcut.
- **Menu bar.** On by default: the account list lives in the menu bar, so
  switching never needs a window. Optionally hide the Dock icon and run menu-bar
  only — the pinned Dock shortcut still launches it. That toggle is locked unless
  the menu bar is on, or there would be no way back into the app.
- **Keep in Dock.** If the launcher is not pinned, it offers to pin itself. The
  Dock only re-reads its preferences on restart, so this restarts the Dock.

## Paired Chrome profiles

Each account can be paired with a Chrome profile, so opening the account brings
its browser context along. Click the globe on an account card to pick one.

The picker lists every Chrome profile with its display name, signed-in address,
and whether the **Claude in Chrome** extension
(`fcoeoabgfenejglbffodgkkbkcdhcgfn`) is installed in that profile — extensions
are per-profile, so having it in one says nothing about another.

A profile whose name matches the account is preselected as a suggestion, never
applied on its own. Launching the account then runs:

```bash
open -na "Google Chrome" --args --profile-directory="Profile 2"
```

Pick **Don't open Chrome** to unpair, or **New Chrome profile…** to have Chrome
create a fresh one on first launch.

### The extension cannot be installed silently

Chrome will not let an app add an extension to a profile. The only silent route
is a managed policy, and this launcher does not write one — it is machine-wide,
affects every Chrome profile, and may need admin rights. So when a paired profile
lacks the extension, the app offers to open its Web Store page **in that
profile**: one click to add it.

If you want the silent route and accept that it applies to every profile, this is
the policy — **untested here**, verify at `chrome://policy` after restarting Chrome:

```bash
defaults write com.google.Chrome ExtensionInstallForcelist -array \
  "fcoeoabgfenejglbffodgkkbkcdhcgfn;https://clients2.google.com/service/update2/crx"
```

## Session health

The **Sessions** button opens a safety net for the failure above.

```
Work      2 index backups                      Show
  Index is writable. No failed saves, no
  sessions missing from the list.

Personal  10 index backups                     Show
  636 failed saves earlier, last at 14:26. The
  index is writable again, so this is history —
  but any session lost back then shows up below.

  ┌──────────────────────────────────────────┐
  │ Closed Bills                   [Restore] │
  │ 10.7 MB · last active 11 Aug 21:26       │
  │ ~/work/repos/example                     │
  └──────────────────────────────────────────┘
```

- **Index backups.** Every launch snapshots the profile's session index to
  `~/Library/Application Support/CASE/session-index-backups/`, keeping
  the last 10. About 26 KB each.
- **Failure detection.** Reads the profile's `main.log` for
  `Failed to save session`, and checks whether the index is writable *now* — so a
  fixed problem reads as history instead of warning for ever.
- **Background watching.** The main process rescans every 2 minutes — a scan
  costs ~50 ms — so a failure is caught within minutes rather than whenever you
  next look. New problems raise a Dock badge and a notification even while the
  launcher is hidden; clicking the notification opens this panel. A continuing
  failure notifies once, not every tick, and pre-existing issues stay silent at
  startup so only the badge carries them.
- **Lost session recovery.** The app logs every `Mapping internal session
  local_X to CLI session Y` pairing. A mapping with no index entry means a
  desktop session whose transcript survived but whose entry did not. **Restore**
  rebuilds it. Restart the account for it to appear in Claude.

A mapping whose internal id is already indexed is skipped — one desktop session
spans several transcripts as it compacts, and those earlier segments are not lost.

Everything here is additive: it reads Claude's data, copies it, and creates
missing entries. It never edits or deletes anything of Claude's.

## Sharing app preferences (optional)

`claude_desktop_config.json` holds app preferences and lives inside the profile.
A symlink will not hold — the app rewrites the file by rename, replacing it. Copy
it instead, before launching:

```bash
cp -f "$HOME/Library/Application Support/Claude/claude_desktop_config.json" \
      "$HOME/Library/Application Support/Claude-Work/claude_desktop_config.json"
```

## Notes and limits

- **Each running account gets its own Dock tile**, all labelled "Claude" — they
  come from the same bundle. Only a duplicated bundle with its own identifier
  would change that, which breaks Claude's signature and auto-updates.
- **One profile, one instance.** Two instances sharing a profile corrupt its
  LevelDB stores. The launcher probes with `lsof` and fronts the running instance
  instead of opening a second.
- Deleting an account warns twice, reports how many sessions it destroys, refuses
  while the account is open, and can never touch the default profile.
- `lsof` is the slowest thing here, so the window paints from config first and
  folds in running state a moment later.
- Picking an account **hides** the launcher rather than quitting it, so the next
  pick is instant. Hiding rather than minimizing keeps a second thumbnail out of
  the Dock. Clicking the Dock icon brings it back; Escape closes it outright.

See [ROADMAP.md](ROADMAP.md) for planned extensions.

## Layout

```
src/main.js              profiles, probing, launching, IPC
src/tray.js              menu-bar mode
src/macos.js             Dock pinning, per-profile process lookup
src/preload.js           contextBridge surface
src/renderer/            picker UI (no framework)
tools/make-icon.js       draws the app icon and the menu-bar template
tools/build.js           icon → iconset → icns → package → ~/Applications
```

## Development

```bash
npm start                                     # run from source
CLAUDE_ACCOUNTS_SHOT=/tmp/ui.png npm start    # render the window to a PNG and exit
CLAUDE_ACCOUNTS_WATCH_MS=3000 npm start       # shorten the health-watch interval
```

## Uninstall

```bash
rm -rf "$HOME/Applications/CASE.app"
```

Profiles and `~/Library/Application Support/CASE/` are left alone. If
launch-at-login was enabled, turn it off in Settings first.

Note: while a global shortcut is enabled, closing the window hides it instead of
quitting — a shortcut cannot outlive its process. Use `⌘Q` to quit properly.
