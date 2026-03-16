'use strict';

// ─────────────────────────────────────────────────────
//  Constants & helpers
// ─────────────────────────────────────────────────────

const COLOR_CLASS = {
  grey:'c-grey', blue:'c-blue', red:'c-red', yellow:'c-yellow',
  green:'c-green', pink:'c-pink', purple:'c-purple', cyan:'c-cyan', orange:'c-orange'
};

const VALID_COLORS = Object.keys(COLOR_CLASS);

const GROUP_EMOJI = ['💙','💜','❤️','💚','💛','🩷','🩵','🧡','🩶'];

function esc(str) {
  return String(str || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function isNetSuite(url) {
  return url && (url.includes('netsuite.com') || url.includes('NetSuite'));
}

function humanTime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month:'short', day:'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' });
}

let toastTimer;
function toast(msg, color) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color || 'var(--green)';
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ─────────────────────────────────────────────────────
//  Tab navigation
// ─────────────────────────────────────────────────────

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'sessions') renderSessions();
  });
});

// ─────────────────────────────────────────────────────
//  Onboarding dismiss
// ─────────────────────────────────────────────────────

chrome.storage.local.get('onboardDismissed', res => {
  if (res.onboardDismissed) {
    const ob = document.getElementById('onboard');
    if (ob) ob.style.display = 'none';
  }
});

document.getElementById('onboardClose')?.addEventListener('click', () => {
  document.getElementById('onboard').style.display = 'none';
  chrome.storage.local.set({ onboardDismissed: true });
});

// ─────────────────────────────────────────────────────
//  Load + preview current window
// ─────────────────────────────────────────────────────

let currentData = { groupMap: {}, tabs: [] };

async function loadCurrentWindow() {
  const content = document.getElementById('previewContent');
  const stat    = document.getElementById('previewStat');
  content.innerHTML = `<div class="empty"><div class="empty-icon">⏳</div>Scanning…</div>`;

  try {
    const [allTabs, groups] = await Promise.all([
      chrome.tabs.query({ currentWindow: true }),
      chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT })
    ]);

    const groupMap = {};
    groups.forEach(g => { groupMap[g.id] = g; });

    const nsOnly = document.getElementById('optNSOnly').checked;
    const tabs   = nsOnly ? allTabs.filter(t => isNetSuite(t.url)) : allTabs;

    currentData = { groupMap, tabs };

    const groupCount = new Set(
      tabs.filter(t => t.groupId >= 0).map(t => t.groupId)
    ).size;

    stat.innerHTML = `<strong>${tabs.length}</strong> tabs · <strong>${groupCount}</strong> groups`;
    renderPreview(groupMap, tabs, content);

  } catch (err) {
    content.innerHTML = `<div class="empty">⚠️ ${esc(err.message)}</div>`;
  }
}

function renderPreview(groupMap, tabs, container) {
  if (!tabs.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div>No matching tabs found.<br/>Uncheck "NetSuite tabs only" to see all.</div>`;
    return;
  }

  // Bucket tabs by group
  const buckets = {};
  const order   = [];
  tabs.forEach(tab => {
    const key = tab.groupId >= 0 ? String(tab.groupId) : '__ungrouped__';
    if (!buckets[key]) { buckets[key] = []; order.push(key); }
    buckets[key].push(tab);
  });

  // De-dup order
  const seen = new Set();
  const orderedKeys = order.filter(k => { if (seen.has(k)) return false; seen.add(k); return true; });

  let html = '';

  orderedKeys.forEach(key => {
    const groupTabs = buckets[key];
    if (key === '__ungrouped__') {
      groupTabs.forEach(tab => {
        html += `<div class="ungrouped-row">
          ${esc(tab.title || tab.url || 'Untitled')}
        </div>`;
      });
    } else {
      const g = groupMap[parseInt(key)] || {};
      const cc = COLOR_CLASS[g.color] || 'c-grey';
      const name = g.title || g.color || 'Group';
      html += `
        <div class="group-row">
          <span class="g-dot ${cc}"></span>
          <span class="g-name">${esc(name)}</span>
          <span class="g-tabs">${groupTabs.length} tab${groupTabs.length !== 1 ? 's' : ''}</span>
        </div>`;
      groupTabs.forEach(tab => {
        const favicon = tab.favIconUrl
          ? `<img class="tab-sub-favicon" src="${esc(tab.favIconUrl)}" onerror="this.style.display='none'"/>`
          : '<span style="width:12px;display:inline-block;"></span>';
        html += `
          <div class="tab-sub">
            ${favicon}
            <span class="tab-sub-title" title="${esc(tab.url)}">${esc(tab.title || tab.url || 'Untitled')}</span>
          </div>`;
      });
    }
  });

  container.innerHTML = html;
}

// ─────────────────────────────────────────────────────
//  Save session
// ─────────────────────────────────────────────────────

async function doSave() {
  const nameEl = document.getElementById('sessionName');
  const name   = nameEl.value.trim() || `Session ${new Date().toLocaleDateString()}`;
  const keepGroups    = document.getElementById('optGroups').checked;
  const keepCollapsed = document.getElementById('optCollapsed').checked;

  const { groupMap, tabs } = currentData;
  if (!tabs.length) { toast('⚠️ No tabs detected — hit Refresh first', '#f87171'); return; }

  // Bucket tabs
  const buckets = {};
  tabs.forEach(tab => {
    const key = tab.groupId >= 0 ? String(tab.groupId) : '__ungrouped__';
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push({ url: tab.url, title: tab.title, favicon: tab.favIconUrl || '' });
  });

  const savedGroups = Object.entries(buckets).map(([key, tabList]) => {
    if (key === '__ungrouped__') {
      return { id: '__ungrouped__', name: '', color: 'grey', collapsed: false, tabs: tabList };
    }
    const g = groupMap[parseInt(key)] || {};
    return {
      id: key,
      name: g.title || '',
      color: g.color || 'grey',
      collapsed: keepCollapsed ? (g.collapsed || false) : false,
      tabs: tabList
    };
  });

  const namedGroups = savedGroups.filter(g => g.id !== '__ungrouped__');

  const session = {
    id: Date.now(),
    name,
    saved: Date.now(),
    tabCount:   tabs.length,
    groupCount: namedGroups.length,
    groups: keepGroups ? savedGroups : [
      { id: '__ungrouped__', name: '', color: 'grey', collapsed: false,
        tabs: tabs.map(t => ({ url: t.url, title: t.title, favicon: t.favIconUrl || '' })) }
    ]
  };

  const res      = await chrome.storage.local.get('sessions');
  const sessions = res.sessions || [];
  sessions.unshift(session);
  await chrome.storage.local.set({ sessions });

  nameEl.value = '';
  updateSessionsBadge(sessions.length);
  toast(`✅ Saved "${name}" — ${tabs.length} tabs in ${namedGroups.length} group(s)`);
}

document.getElementById('saveBtn').addEventListener('click', doSave);

// Keyboard shortcut listener (Alt+S)
chrome.commands?.onCommand?.addListener(cmd => {
  if (cmd === 'save-session') doSave();
});

// ─────────────────────────────────────────────────────
//  Restore session
// ─────────────────────────────────────────────────────

async function restoreSession(id) {
  const res      = await chrome.storage.local.get('sessions');
  const sessions = res.sessions || [];
  const session  = sessions.find(s => s.id === id);
  if (!session) return;

  const confirmed = confirm(
    `Restore "${session.name}"?\n\n` +
    `Opens ${session.tabCount} tabs in ${session.groupCount} group(s).\n\n` +
    `⚠️  Log into your app first, then restore!`
  );
  if (!confirmed) return;

  for (const group of session.groups) {
    const tabIds = [];

    for (const tabDef of group.tabs) {
      try {
        const tab = await chrome.tabs.create({ url: tabDef.url, active: false });
        tabIds.push(tab.id);
        await new Promise(r => setTimeout(r, 60));
      } catch (e) { /* skip bad URLs */ }
    }

    if (group.id !== '__ungrouped__' && tabIds.length > 0) {
      try {
        const gid = await chrome.tabs.group({ tabIds });
        const color = VALID_COLORS.includes(group.color) ? group.color : 'grey';
        await chrome.tabGroups.update(gid, {
          title:     group.name || '',
          color,
          collapsed: group.collapsed || false
        });
      } catch (e) {
        console.warn('Group creation failed:', e);
      }
    }
  }

  toast(`🚀 Restored "${session.name}"!`);
}

// ─────────────────────────────────────────────────────
//  Delete session
// ─────────────────────────────────────────────────────

async function deleteSession(id) {
  const res      = await chrome.storage.local.get('sessions');
  const sessions = (res.sessions || []).filter(s => s.id !== id);
  await chrome.storage.local.set({ sessions });
  updateSessionsBadge(sessions.length);
  renderSessions();
  toast('🗑️ Session deleted', '#6b7a9e');
}

// ─────────────────────────────────────────────────────
//  Render saved sessions list
// ─────────────────────────────────────────────────────

async function renderSessions() {
  const res      = await chrome.storage.local.get('sessions');
  const sessions = res.sessions || [];
  const list     = document.getElementById('sessionsList');

  updateSessionsBadge(sessions.length);

  if (!sessions.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">📭</div>No sessions yet.<br/>Go to Save to capture your first session.</div>`;
    return;
  }

  list.innerHTML = sessions.map((s, i) => {
    const namedGroups = (s.groups || []).filter(g => g.id !== '__ungrouped__');
    const pills = namedGroups.map(g => `
      <div class="s-pill ${COLOR_CLASS[g.color] || 'c-grey'}">
        <div class="s-pill-dot"></div>
        ${esc(g.name || g.color || '—')} <span style="opacity:0.7">(${g.tabs.length})</span>
      </div>`).join('');

    const emoji = GROUP_EMOJI[i % GROUP_EMOJI.length];

    return `
      <div class="s-card">
        <div class="s-top">
          <div class="s-icon">${emoji}</div>
          <div class="s-info">
            <div class="s-name">${esc(s.name)}</div>
            <div class="s-meta">${s.tabCount} tabs · ${s.groupCount} groups · ${humanTime(s.saved)}</div>
          </div>
          <div class="s-actions">
            <button class="btn btn-restore" data-id="${s.id}" data-action="restore">🚀 Restore</button>
            <button class="btn btn-del"     data-id="${s.id}" data-action="delete">🗑️</button>
          </div>
        </div>
        ${namedGroups.length ? `<div class="s-pills">${pills}</div>` : ''}
      </div>`;
  }).join('');

  list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      if (btn.dataset.action === 'restore') restoreSession(id);
      if (btn.dataset.action === 'delete')  deleteSession(id);
    });
  });
}

// ─────────────────────────────────────────────────────
//  Sessions badge
// ─────────────────────────────────────────────────────

function updateSessionsBadge(count) {
  const badge = document.getElementById('sessionsBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline';
  } else {
    badge.style.display = 'none';
  }
}

// ─────────────────────────────────────────────────────
//  Option change listeners
// ─────────────────────────────────────────────────────

document.getElementById('optNSOnly').addEventListener('change', loadCurrentWindow);
document.getElementById('refreshBtn').addEventListener('click', loadCurrentWindow);

// ─────────────────────────────────────────────────────
//  External links — extensions must open via chrome.tabs
// ─────────────────────────────────────────────────────

document.addEventListener('click', e => {
  const link = e.target.closest('a[href^="http"]');
  if (link) {
    e.preventDefault();
    chrome.tabs.create({ url: link.href });
  }
});

// ─────────────────────────────────────────────────────
//  Init
// ─────────────────────────────────────────────────────

(async () => {
  await loadCurrentWindow();
  const res = await chrome.storage.local.get('sessions');
  updateSessionsBadge((res.sessions || []).length);
})();
