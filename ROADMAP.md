# Roadmap

Where this could go, roughly in the order the payoff justifies the work.

**Confidence legend.** Every item is tagged with how sure we are it is buildable:

- **Verified** — we have already observed the mechanism working on this machine.
- **Likely** — standard platform behaviour, but not exercised here yet.
- **Research** — plausible, unproven. Each of these carries the specific test that
  would settle it. Do that test *first*; do not schedule the work around a guess.

Effort is **S** (an evening), **M** (a weekend), **L** (a real project).

---

## Ground rules

These came out of building v1 and v2, and one incident that cost a day of session
history. Anything on this roadmap has to respect them.

1. **Never symlink anything under `claude-code-sessions/`.** The app's
   `ensureStorageDir` rejects a symlinked storage directory with `ENOTDIR`, then
   silently fails every session save until it restarts. It looks fine until you
   quit, and then the session is gone from the list.
2. **One profile, one running instance.** Two instances on one profile corrupt
   its LevelDB stores.
3. **Sessions are per-account by design** — the index is keyed
   `<accountUuid>/<orgUuid>`. Do not try to make them cross accounts.
4. **Never duplicate or re-sign `Claude.app`.** It breaks the Developer ID
   signature, the hardened-runtime entitlements, TCC grants, and auto-updates.
5. **`~/.claude` is shared and that is the point.** Skills, plugins, agents,
   settings and transcripts follow every account for free. Isolation is the
   exception, and should always be opt-in.
6. **Read-only by default.** This app coordinates Claude; it does not edit
   Claude's data. Every write outside our own config is a deliberate feature with
   a confirmation behind it.

---

## Phase 1 — Remove the remaining friction ✅ shipped

Small, self-contained, each one visible the day it lands.

| # | Item | Effort | Confidence |
|---|---|---|---|
| 1.1 | **"Keep in Dock" button** — ✅ shipped, as a prompt shown only while unpinned | S | Verified |
| 1.2 | **Global hotkey** — ✅ shipped, rebindable, default `⌥⌘C` | S | Verified |
| 1.3 | **Keyboard navigation** — ✅ shipped | S | Verified |
| 1.4 | **Quit this account** — ✅ shipped | S | Verified |
| 1.5 | **Launch at login** — ✅ shipped, off by default | S | Verified |
| 1.6 | **Menu-bar mode** — ✅ shipped, with an optional Dock-icon hide | M | Verified |

**1.1** is the awkward step left in onboarding: right-click → Options → Keep in
Dock. We already did it from the shell — `defaults write com.apple.dock
persistent-apps -array-add …` then `killall Dock` — so the app can offer a button.
Read the array first and skip if already pinned.

**Shipped 1.1, 1.3 and 1.4.** Two things only surfaced by building them: the
Dock rewrites its entries percent-encoded (`Claude%20Accounts.app`), so a literal
path never matches what it stored; and an in-flow action row reserves its width
even at `opacity: 0`, which was truncating every card's subtitle.

**Also shipped 1.2 and 1.5**, behind a Settings sheet. A global shortcut forces
a lifecycle change: the app must outlive its window, or the shortcut dies the
first time the window is dismissed. Closing now hides while a shortcut is
enabled; `⌘Q` still quits.

**1.6 shipped too**, so Phase 1 is complete. The menu bar carries the account
list, session-health count and settings; hiding the Dock icon is offered
alongside it but locked off when the menu bar is, since otherwise the app would
have no way back. `window-all-closed` no longer quits while either the menu bar
or a shortcut is on.

**1.4** matters more than it sounds. macOS gives you no way to tell two "Claude"
instances apart — same bundle, same name in Activity Monitor. We can, because
`lsof` on a profile file already yields the owning pid. This is the only tool on
the machine that can say "quit *Personal*, leave *Work* alone".

---

## Phase 2 — Make each account recognisable ✅ partly shipped

Right now an account is a name and a hash-derived colour.

| # | Item | Effort | Confidence |
|---|---|---|---|
| 2.1 | **Custom colour and emoji** per account — ✅ shipped | S | Verified |
| 2.2 | **Last-used timestamp**, sort by recency — ✅ shipped | S | Verified |
| 2.3 | **Usage / plan meter** per account — ✅ shipped | M | ~~Research~~ Verified |
| 2.4 | **Show the signed-in identity** rather than a label you typed | M | ❌ Ruled out |

**2.1 and 2.2 shipped together**, since they are the same question — how do you
tell two accounts apart at a glance. The pencil button now opens one **Edit**
sheet carrying the name, an icon and a colour, all previewed live; the hue is
picked from a fixed palette while saturation and lightness stay put, so white
type on the avatar is always legible. Leaving either on **Automatic** keeps the
old behaviour: initials, coloured by hashing the name.

**Recency sorting is off by default**, and that is a deliberate call rather than
caution — with two accounts, sorting by recency flips the order on every single
switch, and it takes `⌘1`/`⌘2` with it. Muscle memory is worth more than the
sort. The setting exists for people running five or six.

Two things surfaced while building it. `Number(null)` is `0`, so "no colour"
round-tripped into hue 0 — red — until the null was checked before the coercion.
And returning `decorate()`d accounts from the save handler put its `lsof` probes
(~2s) between pressing Save and seeing the new name, so the update path now
returns the stored list and the renderer keeps the status it already has.

**2.3 — test run, and it passed.** `plan-usage-history.json` is
`{version, samples}`, each sample `{t, org, u:{fh, sd}}`: a timestamp, an org
UUID and two integers from 0 to 100. Claude writes one every five minutes, in
every profile, and the newest is minutes old.

The key names were not taken on trust. Over 3283 samples and 25 days, runs of
non-zero `fh` cap at **4.83–5.14 hours** and then fall to zero inside a single
sampling interval — a fixed five-hour window that resets, not a rolling one.
Runs of non-zero `sd` last **4.9–6.9 days**. So `fh` is percent of the five-hour
limit and `sd` percent of the weekly one.

**Shipped** as a two-pixel bar along the bottom edge of each card, tracking
whichever limit is further along, with a tooltip giving both figures and when
they were taken. A sample only describes the moment it was taken, so `src/usage.js`
zeroes a figure once its whole window has elapsed since then, and the tooltip
always says "as of" rather than implying it is live.

**2.4 — test run, and it failed. Ruled out.** The stable per-profile file,
`config.json`, holds `lastKnownAccountUuid` and two opaque `oauth:tokenCache`
blobs, and no address. A sweep of both entire profiles found addresses only
inside per-session sandbox copies of `.claude.json` and IndexedDB blobs —
neither a stable nor a decent source, and both credential-adjacent. As predicted,
**2.1 is the answer instead**: name the account yourself and give it an icon.

---

## Phase 3 — Paired Chrome profiles ✅ mostly shipped

The original ask. Each Claude account gets a matching Chrome profile, already
signed in, with the Claude extension present — so "open Personal" means the
browser context comes along too.

**What we confirmed on this machine:** Chrome is installed, there are already 7
profiles (`Default`, `Profile 2`, `7`, `8`, `9`, `10`, `14`), and the Claude
extension is `fcoeoabgfenejglbffodgkkbkcdhcgfn`, currently installed in `Default`
and `Profile 8`.

| # | Item | Effort | Confidence |
|---|---|---|---|
| 3.1 | **Pair an account to an existing Chrome profile** | S | Verified |
| 3.2 | **Launch Chrome with the account** (`--profile-directory=…`) | S | Likely |
| 3.3 | **Create a fresh Chrome profile** for a new account | M | Likely |
| 3.4 | **Pre-install the extension** into new profiles | M | Research |
| 3.5 | **Open Chrome only when asked** — a per-account toggle, plus a separate button | S | Verified |

**3.1/3.2** are the ninety-percent version and are cheap: store a
`chromeProfile` field per account and run

```bash
open -na "Google Chrome" --args --profile-directory="Profile 8"
```

**3.4 is the one to be careful about.** Two candidate routes, both unproven:

- *Managed policy.* `ExtensionInstallForcelist` in the `com.google.Chrome`
  preference domain. If Chrome honours a user-level `defaults write`, the
  extension force-installs into every profile with no clicking. If it only reads
  `/Library/Managed Preferences`, this needs admin rights and is off the table
  for a personal launcher.
  → *Test:* `defaults write com.google.Chrome ExtensionInstallForcelist -array
  "fcoeoabgfenejglbffodgkkbkcdhcgfn;https://clients2.google.com/service/update2/crx"`,
  restart Chrome, check `chrome://policy`.
- *Copying extension state between profiles.* **Expect this to fail.** Chrome
  HMACs extension entries in `Secure Preferences` and disables ones it considers
  tampered with. Listed only so nobody spends a weekend rediscovering it.

**Shipped:** 3.1, 3.2, 3.3 and 3.5, in `src/chrome.js`. Profiles are read from
Chrome's `Local State` with their real names and signed-in addresses, and a
name match is offered as a preselected suggestion. Verified that launching a
paired profile works by watching `lsof` show open handles under
`Chrome/Profile 2/` — `Local State.profile.last_used` is not a usable signal,
since Chrome only flushes it periodically.

**3.4 was not attempted.** The managed-policy route is machine-wide and may need
admin rights, so writing it on a user's behalf is the wrong default; the README
documents it as an opt-in with the verification step. The app instead opens the
extension's Web Store page in the target profile — one click, and it always
works.

---

## Phase 4 — Per-account configuration

Today every account shares `~/.claude` completely. That is the right default and
should stay the default — but two escape hatches are worth having.

| # | Item | Effort | Confidence |
|---|---|---|---|
| 4.1 | **Preference sync toggle** — copy `claude_desktop_config.json` at launch | S | Verified |
| 4.2 | **Hard isolation** — opt-in `CLAUDE_CONFIG_DIR` per account | M | Verified |
| 4.3 | **Per-account default model / effort** | M | ❌ Ruled out |

**4.1** must be a copy, not a symlink — the app rewrites that file by rename,
which replaces a symlink with a regular file. We watched it happen. One-way,
with a clearly named source account, so the direction is never a surprise.

**4.2** is for client work that must not see your personal skills and MCP
servers. It genuinely forks skills, plugins, agents and settings — so it needs a
blunt warning, not a quiet checkbox.

**4.3 — test run, and it failed. Ruled out.** No model or effort key appears in
any JSON at the profile root, so the preference lives in Local Storage or
IndexedDB. Those are LevelDB stores, and ground rule 2 exists precisely because
a second writer corrupts them — there is no safe way for this app to set it
while Claude is running, which is the only time it would matter.

---

## Phase 5 — The session safety net ✅ shipped

This phase exists because of a real incident. A symlink broke
`writeSessionToDisk` for ten hours; 636 saves failed silently, and a day of work
vanished from the session list the moment the app restarted. The transcripts
survived only because Claude Code writes them somewhere else entirely.

Nothing on this machine watches for that. It should.

| # | Item | Effort | Confidence |
|---|---|---|---|
| 5.1 | **Orphan detector** — transcripts with no index entry | M | Verified |
| 5.2 | **One-click rebuild** of a missing index entry | M | Verified |
| 5.3 | **Log watcher** for `Failed to save session` | S | Verified |
| 5.4 | **Index backup**, rotated, before each launch | S | Verified |
| 5.5 | **Resume launcher** — pick a transcript, run `claude --resume` | S | Verified |

Everything here we have already done by hand, which is why the confidence is high:

- **5.1** compare `sessionId` values from `~/.claude/projects/*/*.jsonl` against
  `cliSessionId` in every `local_*.json`. Anything unmatched is orphaned.
- **5.2** synthesise the index entry — the fields are known, and `titleSource`
  **must** be `"user"` or the app wipes the title on load.
- **5.3** the failure announces itself in `<profile>/Logs/main.log`. A banner
  saying "this account has failed to save 12 sessions" turns a silent day-long
  data loss into a five-minute fix.
- **5.4** the whole index is a few hundred KB of JSON. Copying it before each
  launch is nearly free and would have made the incident a non-event.

**Shipped**, all five, in `src/health.js` behind the **Sessions** button. On the
first real scan it found 636 historical save failures and two genuinely lost
sessions — *Closed Bills extension* (10.7 MB) and *Device prefix field* (9.3 MB) —
neither of which had been noticed. Both restored.

Still open from this phase:

- **Restore from an index backup.** Backups are written and revealable, but there
  is no in-app restore, because that is the one destructive path here. Rebuilding
  from transcripts covers the real recovery need and only ever adds files.
- ~~**Background watching.**~~ Shipped: a 2-minute main-process tick with a Dock
  badge and notifications, verified against an injected failure and repair.

---

## Phase 6 — Profile lifecycle ✅ partly shipped

| # | Item | Effort | Confidence |
|---|---|---|---|
| 6.1 | **Disk usage** per account — ✅ shipped | S | Verified |
| 6.2 | **Archive** — move a profile aside without deleting — ✅ shipped | M | Verified |
| 6.3 | **Snapshot / restore** before risky changes | M | Likely |
| 6.4 | **Clone an account** | M | Research |

**6.1 and 6.2 shipped together**, because size is what makes the archive
decision. A profile here is 0.5–8.4 GB — the main one is 8.4, seven of which is
`vm_bundles` — so "remove this account" and "reclaim that space" are very
different acts, and the app now says which is which.

The trash button opens three rows rather than three buttons: **Remove from
list** (keeps everything), **Archive** (carries the measured size), and **Delete
everything**. The rows exist to spell out the difference, so their explanations
wrap rather than truncate.

**Archiving is a rename, never a copy-then-delete.** That is atomic and instant
whatever the profile weighs, and there is no half-state to fail in the middle
of. `Claude-Foo` becomes `Claude-Foo.archived`, discovery learns to skip that
suffix so it is never re-adopted by accident, and a banner in the picker offers
it back. Restoring renames it home; if something has taken that path since, it
lands beside it rather than over it. Deleting an archive is the one destructive
call, is named as such, and keeps its native warning.

Notes from building it. `du` measures 8.4 GB in ~110 ms, so sizing can happen
inline when the menu opens. Archive and restore return the stored list rather
than a decorated one, for the same reason the edit path does — `lsof` would
otherwise sit between the click and the list changing; measured, that was the
difference between ~2 s and ~300 ms.

**6.4** — cloning copies the cookies too, so the clone is signed into the *same*
account. That is either exactly what you want (a scratch profile for the same
login) or deeply confusing. Needs a clear answer before it ships.

---

## Phase 7 — Distribution ✅ mostly shipped

| # | Item | Effort | Confidence |
|---|---|---|---|
| 7.1 | **Export / import** the account list (labels and pairings, never profile data) | S | Verified |
| 7.2 | **Self-update** from GitHub releases — ✅ shipped | M | Verified |
| 7.3 | **Signing and notarisation** | M | ⏸ blocked on a paid account |
| 7.4 | **CI build** on tag — ✅ shipped | S | Verified |

**7.4.** `check.yml` runs on every push: every source file parses, and — the
part worth having — renderer, preload and main are checked to agree on their IPC
channel names, which are plain strings and otherwise fail at runtime in a menu
nobody opened. `release.yml` runs on a `v*` tag, refuses if the tag and
`package.json` disagree, builds one **universal** bundle so there is a single
download, then verifies its own output before publishing: checksum, ad-hoc
signature, bundle id, version, and that `lipo` really reports both
architectures.

The icon check is deliberately *not* a hash comparison against the committed
PNG. It is rasterised by Chromium, whose output is not byte-identical across
versions, so that would fail for reasons unrelated to the artwork. It asserts
1024px and an alpha channel instead.

**7.2.** Electron's own `autoUpdater` was not an option: on macOS it goes
through Squirrel, which refuses anything without a Developer ID signature — so
7.3 blocks it. The updater is therefore by hand, in `src/update.js`: fetch the
release, check it against the `.sha256` published beside it, confirm the bundle
id, then hand the swap to a detached script that waits for the app to exit. The
old bundle is moved aside rather than deleted, and moved back if the copy fails,
so a failure leaves a working app rather than none. A release with no checksum
is refused rather than trusted — without a signature to lean on, that file is
the only thing between a download and running whatever arrived.

One quirk that makes this work better than expected: **the quarantine flag is
set by whatever downloads a file**, and Electron's net stack does not set it. So
updates install without a Gatekeeper prompt even though the first download, made
in a browser, needs `xattr -dr com.apple.quarantine`.

**7.3 is the real gap and needs $99/yr.** Until then the first install is
genuinely awkward: an ad-hoc signed app that has been quarantined is reported as
*damaged*, which is worse than "unidentified developer", and since macOS 15 the
right-click → Open trick is gone. The README says so plainly rather than
pretending otherwise, and so does every release's notes.

**7.1** is still open, and is now the only cheap thing left in this phase.

---

## Ruled out

Recorded so they don't get proposed again.

| Idea | Why not |
|---|---|
| **Shared sessions across accounts** | The index is keyed by account, and the only bridge — a symlink — is exactly what triggers `ENOTDIR`. This caused the incident. |
| **One Dock tile per account** | Needs a duplicated `Claude.app` with its own bundle id, which breaks signature, entitlements, TCC grants and auto-updates. Not worth it. |
| **Raising a specific instance** | macOS activates apps, not processes. `activate` fronts whichever Claude the system considers current. Quitting a specific one (1.4) does work. |
| **Symlinking `claude_desktop_config.json`** | Rewritten by rename, which replaces the symlink. Copy instead (4.1). |
| **Showing the signed-in email** (2.4) | Not on disk in any stable place. `config.json` has only `lastKnownAccountUuid` and opaque token caches; addresses appear only in per-session sandbox copies and IndexedDB. Name the account yourself (2.1). |
| **Per-account default model** (4.3) | Not in any profile-root JSON, so it lives in LevelDB — which a second writer corrupts (ground rule 2). |

---

## Suggested order

1. **5.3 + 5.4** — the safety net. Cheap, and the one gap with real downside.
2. **1.1, 1.3, 1.4** — an afternoon, and the app stops needing explanation.
3. **3.1 + 3.2** — Chrome pairing against existing profiles. Most of the value
   for a fraction of 3.4's risk.
4. **2.1 + 2.2** — accounts become recognisable at a glance.
5. Run the Phase 2–4 research tests, then decide what survives.

All five are done. Step 5 paid for itself: of the three research items, **2.3
survived contact with the evidence and shipped; 2.4 and 4.3 did not, and are now
in Ruled out.** Two of three failing is the normal rate, and is the reason those
items were never scheduled on the strength of the idea alone.

**6.1 and 6.2 shipped after that**, ahead of the note above saying Phase 6 was
not worth starting on one machine. That note was about distribution; an 8.4 GB
profile you cannot see the size of is a problem whether or not anyone else ever
runs this.

Left: **6.3** and **6.4** (6.4 still needs its answer about cloned cookies), and
Phase 7, which only matters if this leaves the machine. 3.4 stays deliberately
unattempted.

Phases 6 and 7 only if this stops being a personal tool.
