<div align="center">

<img src="icons/icon128.png" width="80" alt="Tab Session Pro icon"/>

# Tab Session Pro

### Save your Chrome tab groups. Restore them in one click.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Available-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/ohgiphdbdbabhoembkclgbnbihlfeegd?utm_source=item-share-cb)
[![Version](https://img.shields.io/badge/version-4.1.0-6c8aff?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-34d399?style=flat-square)](LICENSE)
[![Buy Me a Coffee](https://img.shields.io/badge/Support-Buy%20me%20a%20coffee-FFDD00?style=flat-square&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/wassemtakashi)

</div>

---

## 😤 The Problem

You spend time organizing your Chrome tabs into groups — named, color-coded, perfectly arranged for your current ticket or task. You close the browser. Next morning, **every single tab has redirected to a login page.** You have to open each one manually, remembering what was where.

If you use **NetSuite, Salesforce, SAP, or any session-based web app**, you know this pain.

---

## ✅ The Solution

**Tab Session Pro** saves your entire tab group structure — names, colors, URLs — and restores it in one click after you log back in.

<div align="center">
<img src="store-assets/promo_440x280.png" width="440" alt="Tab Session Pro preview"/>
</div>

---

## ✨ Features

- 🗂️ **Auto-detects tab groups** — reads Chrome group names and colors automatically
- 🎨 **Preserves group structure** — tabs reopen in the same colored groups
- 💾 **Multiple named sessions** — folders, search, tags, and working hours per session
- 🔍 **ERP / CRM filter** — focus saves on tabs for NetSuite, Salesforce, SAP, and more (optional)
- ✨ **Smart naming & notes** — local suggestions from your tabs; no API keys or external AI
- 🔐 **Private vault** — PIN-protected sessions (`Alt+P`)
- 📦 **Backlog** — park older sessions out of the main list
- 🔗 **Share & import** — `.tabsession` file or `TSP:` code; import from the Sessions toolbar
- ⚡ **Sort tabs** — preview before reorder (`Alt+T`)
- ☁️ **Chrome sync** — sessions follow your signed-in Chrome profile (same as bookmarks)
- ⌨️ **Shortcuts** — `Alt+S` save · `Alt+U` update last session · `Alt+P` private vault · `Alt+T` sort (customize at `chrome://extensions/shortcuts`)
- 🔒 **100% local logic** — no tracking; no background service worker for cloud AI
- 📦 **Lightweight** — no npm dependencies, vanilla JS, Manifest V3

---

## 🚀 How to Use

**End of day (before closing Chrome):**
1. Click the 🗂️ icon in your toolbar
2. Review your detected tab groups in the preview
3. Give the session a name (e.g. `Ticket #4821`)
4. Click **💾 Save Session**

**Next morning:**
1. Log back into your app first
2. Click the 🗂️ icon → go to **📁 Sessions**
3. Click **🚀 Restore**
4. All tabs reopen in their original groups with correct colors ✅

---

## 📦 Installation

### From Chrome Web Store *(recommended)*
👉 [Install Tab Session Pro](https://chromewebstore.google.com/detail/ohgiphdbdbabhoembkclgbnbihlfeegd?utm_source=item-share-cb)

### Manual / Developer Install
1. Clone or download this repository
   ```bash
   git clone https://github.com/wassemwassem/tab-session-pro.git
   ```
2. Open Chrome → go to `chrome://extensions`
3. Enable **Developer mode** (toggle, top-right)
4. Click **Load unpacked** → select this folder (the one that contains `manifest.json`)
5. Pin the 🗂️ icon to your toolbar

---

## 🔐 Permissions

| Permission | Why it's needed |
|---|---|
| `tabs` | Read tab URLs and titles to save your session |
| `tabGroups` | Read and restore group names, colors, and collapsed state |
| `storage` | Persist sessions; Chrome can sync them across devices when you are signed into Chrome |

> Session data is not sent to the developer’s servers. Smart naming and notes run entirely in the extension. Customize shortcuts at `chrome://extensions/shortcuts`.

---

## 🛠️ Tech Stack

Vanilla JavaScript · Chrome Extensions Manifest V3 · Chrome `tabs` + `tabGroups` + `storage` APIs

No build tools, no frameworks, no dependencies. Just open the folder and edit.

Version history: [CHANGELOG.md](CHANGELOG.md).

---

## 🤝 Contributing

Pull requests are welcome! If you find a bug or have a feature idea:

1. [Open an issue](https://github.com/wassemwassem/tab-session-pro/issues)
2. Fork the repo
3. Create a branch: `git checkout -b feature/my-idea`
4. Commit and push
5. Open a Pull Request

---

## ☕ Support

If Tab Session Pro saves you time every day, consider buying me a coffee!

<a href="https://buymeacoffee.com/wassemtakashi">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="180"/>
</a>

---

## 📄 License

MIT © [Wassem](https://github.com/wassemwassem)

---

<div align="center">
  <sub>Built with ☕ by <a href="https://github.com/wassemwassem">Wassem</a> — a solo developer from Egypt 🇪🇬</sub>
</div>
