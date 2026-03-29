# Changelog

All notable changes to **Tab Session Pro** are listed here. Versions are ordered from newest to oldest.

---

## [4.1.0] — 2026-03

### Added

- **Sort tabs (Alt+T)** — Preview modal shows order before applying; ⚡ button on Save panel; `sort-tabs` command in manifest.
- **Backlog** — `isBacklog` flag on sessions; orange-themed section at bottom of Sessions list; 📦/📋 toggle; nav badge excludes backlog count.
- **Share session** — Modal: download `.tabsession` file or copy `TSP:` Base64 share code (`utf8ToB64` / `b64ToUtf8`).
- **Import sessions** — Sessions toolbar 📥 Import: paste share code or upload `.tabsession` / `.json`.
- **Custom ERP systems** — When “Others” is selected, add private names in `chrome.storage.local`; “My systems” optgroup; per-item remove.
- **Save / restore feedback** — Success and error toasts; `doSave` try/catch; restore confirmation messaging.
- **Preview favicons** — Up to 3 favicons + `+N` in group headers; updates when tabs/groups are deselected.
- **About panel** — Hero with extension icon (`chrome.runtime.getURL`), Cloud Sync status, Permissions list, GitHub link, support card with **Buy me a coffee** CTA.
- **Smart Naming (About)** — Informative blurb that names and notes are generated locally (moved from Settings).

### Changed

- **UI (v2.1.2_hypered design merge)** — JetBrains Mono for `kbd`; slim scrollbars; button hover scale; toast slide-in; gradient ✨ Smart Name button; nav labels with emoji; header layout (`.header-name`, `.header-sub`).
- **Popup size** — 460×520px baseline (v2.2-style fit); scrollable sessions list (`flex` + `min-height: 0`).
- **Keys tab removed** — Keyboard shortcuts live under **Settings** with styled `kbd` keys; Alt+T documented there.
- **Cloud Sync** — Explained on **About** (duplicate removed from Settings).
- **Working hours** — Compact input on Save panel.
- **Smart suggestions** — Stronger local `generateLocalSuggestions` (Segmenter, stop-words).
- **About support block** — Warm card around BMaC: short thank-you line (“If this saves you time every day…”) + yellow button with hover lift.
- **About hero** — Slightly smaller ring, icon, and type for tighter layout.
- **Flex layout** — About cards (Cloud Sync, Permissions) use `flex-shrink: 0` so content is not clipped.

### Fixed

- Sessions list scrollable so older sessions remain reachable.
- CSP-safe image handling and event binding (aligned with v2.1.0 patterns).

---

## [4.0.0] — 2026 (stable merge)

### Added

- **`normalizeSession()`** — Loads v1–v3 saved data safely with defaults for missing fields.
- **`generateLocalNote()`** — One-sentence session notes derived locally from tab titles/groups (replaces remote AI path).

### Changed

- **Single stable build** combining v1, v2.x, and v3 feature sets.
- **100% local intelligence** — Smart Name and notes use no external APIs; no `host_permissions`; no background service worker for AI.
- **Manifest 4.0.0** — Same permissions (`tabs`, `tabGroups`, `storage`); commands: Alt+S, Alt+U, Alt+P (no Alt+T yet).

---

## [3.0.0]

### Added

- **Tags** — Up to 8 tags per session; `#tag` pills on cards.
- **Private vault** — Mark sessions private; 4-digit PIN (SHA-256 salted hash in `chrome.storage.local`); collapsible vault section; **Alt+P** toggles lock/unlock.
- **Search** — Filter sessions by name, tags, groups, or note.
- **Session note** — Auto-generated line shown on each card (local).
- **Hotkeys panel** — Dedicated tab listing shortcuts (later folded into Settings in v4.1).

### Changed

- **Commands** — Alt+P (`toggle-private`) added.

---

## [2.2.0]

### Added

- **ERP / CRM filter** — Replaces NetSuite-only filter; many presets + “Others”; `erpSystem` in storage; URL/title matching via `matchesErp()`.
- **Save preview deselection** — Per-tab and per-group checkboxes; excluded count in preview; Refresh resets deselections.
- **Hours-only updates** — ⏱ on session card and “Update hours only” in update modal; updates hours without bumping session version.
- **Smart naming** — `Intl.Segmenter` + `Intl.DateTimeFormat` with JS fallback.

### Changed

- Broader ERP labeling and filter behavior vs. v2.1.

---

## [2.1.0]

### Fixed

- **CSP** — No inline `onerror` on images; `makeFavImg()` + `addEventListener`; modal handlers use `addEventListener` instead of `.onclick` / `.onkeydown` / `.oninput` where applicable.
- **CORS / API** — Removed direct calls to external AI APIs from the popup; **local-only** smart name suggestions.
- **DOM** — Session cards and folders built with `createElement` / `textContent` instead of unsafe `innerHTML` for user data.
- **CSS** — Modal overlay display rules corrected (no conflicting `display` on base vs. `.show`).

### Changed

- Smart naming pipeline uses `generateLocalSuggestions()` only.

---

## [2.0.0]

### Added

- **Folders** — Draggable, sortable, collapsible; sessions assigned to folders.
- **Working hours** — Optional per session; accumulates on update.
- **Smart name** — Three local suggestions from tab/group context (no API key).
- **Update session** — Re-save current window into last session; version bump (v1 → v2…); **Alt+U**.
- **Cloud sync** — `chrome.storage.sync` with local fallback.
- **Favicons** — Group favicons on session cards in the list.
- **Session metadata** — `saved` / `updated`, tab counts, group counts, version badges.

### Changed

- **Commands** — Alt+U (`update-session`) added.

---

## [1.0.0] — initial Chrome Web Store release

### Added

- Save **Chrome tab groups** with **names, colors, and URLs**.
- **Restore** full group structure in one action.
- **Multiple named sessions** and a session list.
- **NetSuite-oriented tab filter** (early single-system focus).
- **Alt+S** — Quick save (`save-session` command).
- **Onboarding** tip for new users.
- **About** — Permissions transparency.
- **Buy Me a Coffee** support link.

### Notes

- Permissions: `tabs`, `tabGroups`, `storage`.  
- Manifest V3 popup extension; no host permissions for web APIs in v1.
