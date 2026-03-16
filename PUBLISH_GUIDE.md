# 🚀 Tab Session Pro — Chrome Web Store Publishing Guide

---

## Step 1 — Create a developer account (one-time, $5 fee)

1. Go to https://chrome.google.com/webstore/devconsole
2. Sign in with your Google account
3. Pay the **one-time $5 registration fee**
4. Accept the developer agreement

---

## Step 2 — Prepare your ZIP

The ZIP must contain **only** these files (already included):
```
tab-session-pro/
  manifest.json
  popup.html
  popup.js
  icons/
    icon16.png
    icon32.png
    icon48.png
    icon128.png
```
❌ Do NOT include: store-assets/, README.md, or any hidden files (.DS_Store etc.)

---

## Step 3 — Upload to the Developer Console

1. Go to https://chrome.google.com/webstore/devconsole
2. Click **"New Item"**
3. Upload `tab-session-pro.zip`

---

## Step 4 — Fill in the Store Listing

### Name
```
Tab Session Pro — Save & Restore Tab Groups
```

### Summary (132 chars max)
```
Save your Chrome tab groups with colors & names. Restore them in one click after session expiry — perfect for NetSuite & CRMs.
```

### Description (copy-paste this)
```
Tab Session Pro solves a daily frustration for power users: you carefully organize your browser tabs into named, color-coded groups for a task or ticket — then the next day everything has expired or been lost.

✅ HOW IT WORKS
1. Organize your tabs into Chrome tab groups (name them, color them)
2. Click the extension icon → name your session → Save
3. Next day: log back into your app, then click Restore
4. All tabs reopen in the exact same groups with the same colors

✅ FEATURES
• Auto-detects all your open tab groups (names + colors)
• Saves multiple named sessions (one per ticket or project)
• Restores the full group structure — not just URLs
• Optional filter for specific apps (e.g. NetSuite only)
• Keyboard shortcut: Alt+S to quick-save
• 100% local — no servers, no tracking, no accounts

✅ PERFECT FOR
• NetSuite developers and consultants
• Salesforce, SAP, Oracle users
• Anyone who works across many organized browser tabs
• Support teams with multiple tickets open at once

✅ PRIVACY
No data ever leaves your browser. Sessions are stored locally using Chrome's built-in storage. We collect nothing.
```

### Category
```
Productivity
```

### Language
```
English
```

---

## Step 5 — Upload Store Assets

Use the files in the `store-assets/` folder:

| Asset | File | Size |
|---|---|---|
| Store icon | `icons/icon128.png` | 128×128 |
| Small promo tile | `store-assets/promo_440x280.png` | 440×280 |
| Screenshot | `store-assets/screenshot_1280x800.png` | 1280×800 |

> 💡 Tip: Take a real screenshot of the extension working on your browser for the best results — replace the generated screenshot with an actual screen capture.

---

## Step 6 — Privacy & Permissions Justification

When asked to justify permissions, use these:

| Permission | Justification |
|---|---|
| `tabs` | Required to read tab URLs and titles to save the current session |
| `tabGroups` | Required to read and restore tab group names, colors, and collapsed state |
| `storage` | Required to persist saved sessions across browser sessions |

**Privacy policy URL:** You need a simple privacy policy page. You can host it free on GitHub Pages. Template:
```
Tab Session Pro does not collect, transmit, or store any personal data on external servers.
All session data is stored locally in your browser using Chrome's storage API.
No analytics or tracking of any kind is used.
```

---

## Step 7 — Submit for Review

- Review usually takes **1–3 business days**
- You'll get an email when approved or if changes are needed
- First submission sometimes gets extra scrutiny — that's normal

---

## After Publishing — Share with your team

Once live, share this link format with your 50+ colleagues:
```
https://chrome.google.com/webstore/detail/tab-session-pro/[YOUR_EXTENSION_ID]
```

---

## Updating the extension later

1. Make your code changes
2. Bump the version in `manifest.json` (e.g. `"version": "1.1.0"`)
3. Re-zip the folder
4. Go to Developer Console → your extension → "Upload new package"
