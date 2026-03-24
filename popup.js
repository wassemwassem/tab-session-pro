'use strict';

// ─────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────
const COLOR_CLASS = {
  grey:'c-grey',blue:'c-blue',red:'c-red',yellow:'c-yellow',
  green:'c-green',pink:'c-pink',purple:'c-purple',cyan:'c-cyan',orange:'c-orange'
};
const VALID_COLORS = Object.keys(COLOR_CLASS);
const GROUP_EMOJI  = ['💙','💜','❤️','💚','💛','🩷','🩵','🧡','🩶'];

let lastRestoredId = null;
let currentView    = 'folders';

// ─────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────
function esc(s){ return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function isNetSuite(u){ return u&&(u.includes('netsuite.com')||u.includes('NetSuite')); }
function humanTime(ts){ const d=new Date(ts); return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' '+d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}); }
function fmtHours(h){ if(!h||h<=0)return '0h'; return h+'h'; }

let toastTimer;
function toast(msg, type=''){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (type ? ' '+type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.className=''; }, 2600);
}

// ─────────────────────────────────────────────────────
//  Storage — sync first, local fallback
// ─────────────────────────────────────────────────────
async function storageGet(keys){
  try{ return await chrome.storage.sync.get(keys); }
  catch(e){ return await chrome.storage.local.get(keys); }
}
async function storageSet(data){
  try{
    await chrome.storage.sync.set(data);
    setSyncDot('ok');
  } catch(e){
    await chrome.storage.local.set(data);
    setSyncDot('warn');
  }
}
function setSyncDot(state){
  const d = document.getElementById('syncDot');
  const ind = document.getElementById('aboutSyncIndicator');
  const s = document.getElementById('aboutSyncStatus');
  if(state==='ok'){
    if(d) d.className='sync-dot';
    if(ind) ind.className='sync-indicator';
    if(s) s.textContent='Synced via Chrome';
  } else {
    if(d) d.className='sync-dot error';
    if(ind) ind.className='sync-indicator off';
    if(s) s.textContent='Local only (sync quota full)';
  }
}

// ─────────────────────────────────────────────────────
//  Nav tabs
// ─────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-'+btn.dataset.tab).classList.add('active');
    if(btn.dataset.tab==='sessions') renderSessions();
  });
});

// ─────────────────────────────────────────────────────
//  Onboarding
// ─────────────────────────────────────────────────────
storageGet('onboardDismissed').then(r=>{
  if(r.onboardDismissed){
    const o = document.getElementById('onboard');
    if(o) o.style.display='none';
  }
});
document.getElementById('onboardClose').addEventListener('click', ()=>{
  document.getElementById('onboard').style.display='none';
  storageSet({onboardDismissed:true});
});

// ─────────────────────────────────────────────────────
//  Load current window
// ─────────────────────────────────────────────────────
let currentData = {groupMap:{}, tabs:[]};

async function loadCurrentWindow(){
  const content = document.getElementById('previewContent');
  const stat    = document.getElementById('previewStat');
  content.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div>Scanning…</div>';
  try{
    const [allTabs, groups] = await Promise.all([
      chrome.tabs.query({currentWindow:true}),
      chrome.tabGroups.query({windowId:chrome.windows.WINDOW_ID_CURRENT})
    ]);
    const groupMap = {};
    groups.forEach(g=>{ groupMap[g.id]=g; });
    const nsOnly = document.getElementById('optNSOnly').checked;
    const tabs   = nsOnly ? allTabs.filter(t=>isNetSuite(t.url)) : allTabs;
    currentData  = {groupMap, tabs};
    const groupCount = new Set(tabs.filter(t=>t.groupId>=0).map(t=>t.groupId)).size;
    stat.innerHTML = `<strong>${tabs.length}</strong> tabs · <strong>${groupCount}</strong> groups`;
    renderPreview(groupMap, tabs, content);
  } catch(err){
    content.innerHTML = `<div class="empty">⚠️ ${esc(err.message)}</div>`;
  }
}

// ─────────────────────────────────────────────────────
//  FIX: favicon onerror handled via JS, not inline attr
// ─────────────────────────────────────────────────────
function makeFavImg(src, cls){
  const img = document.createElement('img');
  img.className = cls;
  img.src = src;
  img.addEventListener('error', ()=>{ img.style.display='none'; });
  return img;
}

function renderPreview(groupMap, tabs, container){
  if(!tabs.length){
    container.innerHTML='<div class="empty"><div class="empty-icon">🔍</div>No matching tabs.<br/>Uncheck "NetSuite only" to see all.</div>';
    return;
  }
  const buckets={}, order=[];
  tabs.forEach(tab=>{
    const key = tab.groupId>=0 ? String(tab.groupId) : '__ungrouped__';
    if(!buckets[key]){ buckets[key]=[]; order.push(key); }
    buckets[key].push(tab);
  });
  const seen = new Set();
  const keys = order.filter(k=>{ if(seen.has(k))return false; seen.add(k); return true; });

  // Build DOM properly — no onerror in HTML
  container.innerHTML = '';
  keys.forEach(key=>{
    const gTabs = buckets[key];
    if(key==='__ungrouped__'){
      gTabs.forEach(t=>{
        const row = document.createElement('div');
        row.className = 'ungrouped-row';
        row.textContent = t.title || t.url || 'Untitled';
        container.appendChild(row);
      });
    } else {
      const g    = groupMap[parseInt(key)] || {};
      const cc   = COLOR_CLASS[g.color] || 'c-grey';
      const name = g.title || g.color || 'Group';

      // Group header row
      const groupRow = document.createElement('div');
      groupRow.className = 'group-row';
      groupRow.innerHTML = `<span class="g-dot ${cc}"></span><span class="g-name">${esc(name)}</span><span class="g-tabs">${gTabs.length} tab${gTabs.length!==1?'s':''}</span>`;

      // Unique favicons
      const faviconDiv = document.createElement('div');
      faviconDiv.className = 'g-favicons';
      const uniqueFavs = [...new Set(gTabs.map(t=>t.favIconUrl).filter(Boolean))].slice(0,4);
      uniqueFavs.forEach(src=>{ faviconDiv.appendChild(makeFavImg(src,'g-favicon')); });
      groupRow.appendChild(faviconDiv);
      container.appendChild(groupRow);

      // Tab sub-rows
      gTabs.forEach(tab=>{
        const row = document.createElement('div');
        row.className = 'tab-sub';
        if(tab.favIconUrl){
          row.appendChild(makeFavImg(tab.favIconUrl, 'tab-sub-favicon'));
        } else {
          const sp = document.createElement('span');
          sp.style.width='12px'; sp.style.display='inline-block';
          row.appendChild(sp);
        }
        const title = document.createElement('span');
        title.className = 'tab-sub-title';
        title.title = tab.url || '';
        title.textContent = tab.title || tab.url || 'Untitled';
        row.appendChild(title);
        container.appendChild(row);
      });
    }
  });
}

// ─────────────────────────────────────────────────────
//  Working hours preview
// ─────────────────────────────────────────────────────
document.getElementById('hoursInput').addEventListener('input', function(){
  const preview = document.getElementById('hoursPreview');
  const display = document.getElementById('hoursTotalDisplay');
  const v = parseFloat(this.value) || 0;
  if(v>0){ preview.style.display='flex'; display.textContent=v+'h'; }
  else   { preview.style.display='none'; }
});

// ─────────────────────────────────────────────────────
//  AI Name — local fallback (CORS blocks direct API)
//  Generates smart name from tab titles without API call
// ─────────────────────────────────────────────────────
function generateLocalSuggestions(tabs, groupMap){
  const groupNames = [...new Set(Object.values(groupMap).map(g=>g.title).filter(Boolean))];
  const titles = tabs.map(t=>t.title||'').filter(Boolean);

  // Extract keywords from titles
  const keywords = [];

  // Try to find ticket numbers
  const ticketMatch = titles.join(' ').match(/[A-Z]{2,}-?\d{3,}|#\d{3,}|ticket\s*#?\d+/gi);
  if(ticketMatch) keywords.push(...ticketMatch.slice(0,2));

  // Use group names as primary signal
  if(groupNames.length) keywords.push(...groupNames.slice(0,2));

  // Extract meaningful words from titles (filter common words)
  const stopWords = new Set(['the','a','an','and','or','in','on','at','to','for','of','with','netsuite','united','motors','company']);
  const titleWords = titles.join(' ')
    .replace(/[^\w\s-]/g,'')
    .split(/\s+/)
    .filter(w=>w.length>3 && !stopWords.has(w.toLowerCase()))
    .slice(0,6);

  const date = new Date().toLocaleDateString(undefined,{month:'short',day:'numeric'});
  const groupPart = groupNames.slice(0,2).join(' + ') || titleWords.slice(0,2).join(' ');
  const ticketPart = (ticketMatch&&ticketMatch[0]) || '';

  const suggestions = [];

  if(ticketPart && groupPart){
    suggestions.push(`${ticketPart} — ${groupPart}`);
  }
  if(groupNames.length >= 2){
    suggestions.push(`${groupNames[0]} + ${groupNames[1]} (${date})`);
  }
  if(groupPart){
    suggestions.push(`${groupPart} — ${date}`);
  }
  // Always have 3
  while(suggestions.length < 3){
    suggestions.push(`Session ${date} (${tabs.length} tabs)`);
  }

  return suggestions.slice(0,3);
}

document.getElementById('aiRenameBtn').addEventListener('click', async()=>{
  const btn          = document.getElementById('aiRenameBtn');
  const suggestionsEl= document.getElementById('aiSuggestions');
  const {tabs, groupMap} = currentData;

  if(!tabs.length){ toast('⚠️ No tabs to analyze', 'warn'); return; }

  btn.classList.add('loading');
  btn.textContent = '✨ Thinking…';
  suggestionsEl.innerHTML = '';
  suggestionsEl.classList.remove('show');

  // Small delay for UX feel
  await new Promise(r=>setTimeout(r, 400));

  try{
    const suggestions = generateLocalSuggestions(tabs, groupMap);

    // Render suggestions — use DOM, not innerHTML with handlers
    suggestionsEl.innerHTML = '';
    suggestions.forEach(s=>{
      const div = document.createElement('div');
      div.className = 'ai-suggestion';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = s;
      const hintSpan = document.createElement('span');
      hintSpan.textContent = '↵ apply';
      div.appendChild(nameSpan);
      div.appendChild(hintSpan);
      div.addEventListener('click', ()=>{
        document.getElementById('sessionName').value = s;
        suggestionsEl.classList.remove('show');
        toast('✅ Name applied');
      });
      suggestionsEl.appendChild(div);
    });

    suggestionsEl.classList.add('show');
  } catch(err){
    toast('⚠️ Could not generate suggestions', 'warn');
  } finally{
    btn.classList.remove('loading');
    btn.textContent = '✨ AI Name';
  }
});

// ─────────────────────────────────────────────────────
//  Folders — CRUD + dropdown
// ─────────────────────────────────────────────────────
async function getFolders(){
  const r = await storageGet('folders');
  return r.folders || [];
}
async function saveFolders(folders){
  await storageSet({folders});
}
async function populateFolderDropdown(){
  const folders = await getFolders();
  const sel = document.getElementById('folderSelect');
  sel.innerHTML = '<option value="">— No folder (standalone) —</option>';
  folders.forEach(f=>{
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.name;
    sel.appendChild(opt);
  });
}

// ─────────────────────────────────────────────────────
//  FIX: Modal handlers use addEventListener, not .onclick
// ─────────────────────────────────────────────────────
let folderModalCallback = null;

function openNewFolderModal(callback){
  folderModalCallback = callback || null;
  const modal = document.getElementById('newFolderModal');
  const input = document.getElementById('newFolderName');
  input.value = '';
  modal.classList.add('show');
  setTimeout(()=>input.focus(), 100);
}

async function confirmNewFolder(){
  const modal = document.getElementById('newFolderModal');
  const name  = document.getElementById('newFolderName').value.trim();
  if(!name){ toast('⚠️ Enter a folder name', 'warn'); return; }
  const folders = await getFolders();
  const folder  = {id:Date.now(), name, order:folders.length};
  folders.push(folder);
  await saveFolders(folders);
  modal.classList.remove('show');
  await populateFolderDropdown();
  toast(`📁 Folder "${name}" created`);
  if(folderModalCallback) folderModalCallback(folder);
  folderModalCallback = null;
}

document.getElementById('confirmFolderBtn').addEventListener('click', confirmNewFolder);
document.getElementById('cancelFolderBtn').addEventListener('click', ()=>{
  document.getElementById('newFolderModal').classList.remove('show');
  folderModalCallback = null;
});
document.getElementById('newFolderName').addEventListener('keydown', e=>{
  if(e.key==='Enter') confirmNewFolder();
  if(e.key==='Escape') document.getElementById('newFolderModal').classList.remove('show');
});

document.getElementById('newFolderBtn').addEventListener('click', ()=>openNewFolderModal());
document.getElementById('newFolderBtnSessions').addEventListener('click', ()=>openNewFolderModal(()=>renderSessions()));

// ─────────────────────────────────────────────────────
//  Save session
// ─────────────────────────────────────────────────────
async function doSave(){
  const nameEl      = document.getElementById('sessionName');
  const name        = nameEl.value.trim() || `Session ${new Date().toLocaleDateString()}`;
  const keepGroups  = document.getElementById('optGroups').checked;
  const keepCollapsed = document.getElementById('optCollapsed').checked;
  const hoursVal    = parseFloat(document.getElementById('hoursInput').value) || 0;
  const folderId    = document.getElementById('folderSelect').value || null;

  const {groupMap, tabs} = currentData;
  if(!tabs.length){ toast('⚠️ No tabs — hit Refresh', 'warn'); return; }

  const buckets = {};
  tabs.forEach(tab=>{
    const key = tab.groupId>=0 ? String(tab.groupId) : '__ungrouped__';
    if(!buckets[key]) buckets[key]=[];
    buckets[key].push({url:tab.url, title:tab.title, favicon:tab.favIconUrl||''});
  });

  const savedGroups = Object.entries(buckets).map(([key, tabList])=>{
    if(key==='__ungrouped__') return {id:'__ungrouped__', name:'', color:'grey', collapsed:false, tabs:tabList, favicons:[]};
    const g = groupMap[parseInt(key)] || {};
    const favicons = [...new Set(tabList.map(t=>t.favicon).filter(Boolean))].slice(0,4);
    return {id:key, name:g.title||'', color:g.color||'grey', collapsed:keepCollapsed?(g.collapsed||false):false, tabs:tabList, favicons};
  });

  const namedGroups = savedGroups.filter(g=>g.id!=='__ungrouped__');
  const session = {
    id:Date.now(), name, saved:Date.now(),
    tabCount:tabs.length, groupCount:namedGroups.length,
    version:'v1', hours:hoursVal, folderId,
    groups: keepGroups ? savedGroups : [{id:'__ungrouped__', name:'', color:'grey', collapsed:false,
      tabs:tabs.map(t=>({url:t.url, title:t.title, favicon:t.favIconUrl||''})), favicons:[]}]
  };

  const r = await storageGet('sessions');
  const sessions = r.sessions || [];
  sessions.unshift(session);
  await storageSet({sessions});

  nameEl.value = '';
  document.getElementById('hoursInput').value = '';
  document.getElementById('hoursPreview').style.display = 'none';
  updateSessionsBadge(sessions.length);
  toast(`✅ Saved "${name}" — ${tabs.length} tabs`);
}

document.getElementById('saveBtn').addEventListener('click', doSave);

// ─────────────────────────────────────────────────────
//  Restore session
// ─────────────────────────────────────────────────────
async function restoreSession(id){
  const r = await storageGet('sessions');
  const sessions = r.sessions || [];
  const session  = sessions.find(s=>s.id===id);
  if(!session) return;

  const hoursStr = session.hours>0 ? `\n⏱ ${session.hours}h logged on this ticket` : '';
  const confirmed = confirm(`Restore "${session.name}"?\n\nOpens ${session.tabCount} tabs in ${session.groupCount} group(s).${hoursStr}\n\n⚠️ Log into your app first!`);
  if(!confirmed) return;

  lastRestoredId = id;

  for(const group of session.groups){
    const tabIds = [];
    for(const tabDef of group.tabs){
      try{
        const tab = await chrome.tabs.create({url:tabDef.url, active:false});
        tabIds.push(tab.id);
        await new Promise(r=>setTimeout(r,60));
      } catch(e){}
    }
    if(group.id!=='__ungrouped__' && tabIds.length>0){
      try{
        const gid   = await chrome.tabs.group({tabIds});
        const color = VALID_COLORS.includes(group.color) ? group.color : 'grey';
        await chrome.tabGroups.update(gid, {title:group.name||'', color, collapsed:group.collapsed||false});
      } catch(e){ console.warn('Group failed:', e); }
    }
  }
  toast(`🚀 Restored "${session.name}"!`);
}

// ─────────────────────────────────────────────────────
//  Update session modal
//  FIX: all handlers via addEventListener, no .onclick
// ─────────────────────────────────────────────────────
let updateSessionId   = null;
let updateSessionData = null; // {session, tabs, groupMap, sessions}

async function promptUpdateSession(id){
  const r = await storageGet('sessions');
  const sessions = r.sessions || [];
  const session  = sessions.find(s=>s.id===id);
  if(!session){ toast('⚠️ Session not found', 'warn'); return; }

  const [allTabs, groups] = await Promise.all([
    chrome.tabs.query({currentWindow:true}),
    chrome.tabGroups.query({windowId:chrome.windows.WINDOW_ID_CURRENT})
  ]);
  const groupMap = {};
  groups.forEach(g=>{ groupMap[g.id]=g; });

  updateSessionId   = id;
  updateSessionData = {session, tabs:allTabs, groupMap, sessions};

  document.getElementById('updateModalSub').textContent = `Update "${session.name}" with current ${allTabs.length} tabs?`;
  const hoursInput   = document.getElementById('updateHoursInput');
  const totalDisplay = document.getElementById('updateTotalDisplay');
  hoursInput.value   = '';
  totalDisplay.textContent = fmtHours(session.hours);

  document.getElementById('updateModal').classList.add('show');
}

document.getElementById('updateHoursInput').addEventListener('input', function(){
  if(!updateSessionData) return;
  const add   = parseFloat(this.value) || 0;
  const total = (updateSessionData.session.hours || 0) + add;
  document.getElementById('updateTotalDisplay').textContent = total>0 ? total+'h' : '0h';
});

document.getElementById('cancelUpdateBtn').addEventListener('click', ()=>{
  document.getElementById('updateModal').classList.remove('show');
  updateSessionId   = null;
  updateSessionData = null;
});

document.getElementById('confirmUpdateBtn').addEventListener('click', async()=>{
  if(!updateSessionData) return;
  document.getElementById('updateModal').classList.remove('show');

  const {session, tabs, groupMap, sessions} = updateSessionData;
  const addHours  = parseFloat(document.getElementById('updateHoursInput').value) || 0;
  const newHours  = (session.hours || 0) + addHours;
  const vNum      = parseInt((session.version||'v1').replace('v','')) || 1;
  const newVersion= 'v'+(vNum+1);

  const buckets = {};
  tabs.forEach(tab=>{
    const key = tab.groupId>=0 ? String(tab.groupId) : '__ungrouped__';
    if(!buckets[key]) buckets[key]=[];
    buckets[key].push({url:tab.url, title:tab.title, favicon:tab.favIconUrl||''});
  });
  const savedGroups = Object.entries(buckets).map(([key, tabList])=>{
    if(key==='__ungrouped__') return {id:'__ungrouped__', name:'', color:'grey', collapsed:false, tabs:tabList, favicons:[]};
    const g = groupMap[parseInt(key)] || {};
    const favicons = [...new Set(tabList.map(t=>t.favicon).filter(Boolean))].slice(0,4);
    return {id:key, name:g.title||'', color:g.color||'grey', collapsed:g.collapsed||false, tabs:tabList, favicons};
  });

  const updated = {
    ...session,
    groups:     savedGroups,
    tabCount:   tabs.length,
    groupCount: savedGroups.filter(g=>g.id!=='__ungrouped__').length,
    version:    newVersion,
    hours:      newHours,
    updated:    Date.now()
  };

  const idx = sessions.findIndex(s=>s.id===updateSessionId);
  if(idx>=0){ sessions[idx]=updated; await storageSet({sessions}); }

  toast(`✅ Updated to ${newVersion}${newHours>0?' — '+newHours+'h total':''}`);
  renderSessions();

  updateSessionId   = null;
  updateSessionData = null;
});

// ─────────────────────────────────────────────────────
//  Delete session
// ─────────────────────────────────────────────────────
async function deleteSession(id){
  const r = await storageGet('sessions');
  const sessions = (r.sessions||[]).filter(s=>s.id!==id);
  await storageSet({sessions});
  updateSessionsBadge(sessions.length);
  renderSessions();
  toast('🗑️ Deleted');
}

// ─────────────────────────────────────────────────────
//  Delete folder
// ─────────────────────────────────────────────────────
async function deleteFolder(folderId){
  const folders = (await getFolders()).filter(f=>f.id!==folderId);
  await saveFolders(folders);
  const r = await storageGet('sessions');
  const sessions = (r.sessions||[]).map(s=>s.folderId===folderId ? {...s, folderId:null} : s);
  await storageSet({sessions, folders});
  renderSessions();
  populateFolderDropdown();
  toast('📁 Folder removed (sessions kept)');
}

// ─────────────────────────────────────────────────────
//  Render sessions
// ─────────────────────────────────────────────────────
async function renderSessions(){
  const [r, folders] = await Promise.all([storageGet('sessions'), getFolders()]);
  const sessions = r.sessions || [];
  const list = document.getElementById('sessionsList');
  updateSessionsBadge(sessions.length);

  if(!sessions.length){
    list.innerHTML = '<div class="empty"><div class="empty-icon">📭</div>No sessions yet.<br/>Go to Save to capture your first session.</div>';
    return;
  }

  list.innerHTML = '';

  if(currentView==='all'){
    sessions.forEach((s,i)=>{ list.appendChild(buildSessionCard(s,i,false)); });
  } else {
    // Folders view
    folders.forEach(folder=>{
      const folderSessions = sessions.filter(s=>s.folderId==folder.id);
      const section = buildFolderSection(folder, folderSessions);
      list.appendChild(section);
    });

    // Standalone
    const standalone = sessions.filter(s=>!s.folderId);
    if(standalone.length){
      if(folders.length){
        const lbl = document.createElement('div');
        lbl.style.cssText = 'font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:600;padding:4px 2px;';
        lbl.textContent = 'Standalone';
        list.appendChild(lbl);
      }
      standalone.forEach((s,i)=>{ list.appendChild(buildSessionCard(s,i,false)); });
    }
  }

  bindFolderToggle();
  bindFolderDrag(folders);
  bindSessionActions();
}

function buildFolderSection(folder, folderSessions){
  const section = document.createElement('div');
  section.className = 'folder-section';
  section.id = 'folder-'+folder.id;
  section.draggable = true;
  section.dataset.folderId = folder.id;

  const header = document.createElement('div');
  header.className = 'folder-header';
  header.dataset.folderId = folder.id;
  header.innerHTML = `
    <span class="folder-drag-handle">⠿</span>
    <span class="folder-chevron open" id="chevron-${folder.id}">▶</span>
    <span class="folder-icon">📁</span>
    <span class="folder-name">${esc(folder.name)}</span>
    <span class="folder-meta">${folderSessions.length} session${folderSessions.length!==1?'s':''}</span>
    <div class="folder-actions">
      <button class="btn-icon" data-action="delete-folder" data-id="${folder.id}" title="Delete folder">🗑️</button>
    </div>`;

  const body = document.createElement('div');
  body.className = 'folder-body open';
  body.id = 'body-'+folder.id;

  if(folderSessions.length){
    folderSessions.forEach((s,i)=>{ body.appendChild(buildSessionCard(s,i,true)); });
  } else {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:10px 14px;font-size:11px;color:var(--muted);font-style:italic;';
    empty.textContent = 'Empty folder — assign sessions from the Save tab';
    body.appendChild(empty);
  }

  section.appendChild(header);
  section.appendChild(body);
  return section;
}

// ─────────────────────────────────────────────────────
//  Build session card — DOM only, no inline handlers
// ─────────────────────────────────────────────────────
function buildSessionCard(s, i, inFolder){
  const namedGroups = (s.groups||[]).filter(g=>g.id!=='__ungrouped__');
  const emoji = GROUP_EMOJI[i % GROUP_EMOJI.length];

  const card = document.createElement('div');
  card.className = 's-card' + (inFolder ? ' in-folder' : '');

  // Top row
  const top = document.createElement('div');
  top.className = 's-top';

  const iconEl = document.createElement('div');
  iconEl.className = 's-icon';
  iconEl.textContent = emoji;

  const info = document.createElement('div');
  info.className = 's-info';

  const nameEl = document.createElement('div');
  nameEl.className = 's-name';
  nameEl.textContent = s.name;

  const metaEl = document.createElement('div');
  metaEl.className = 's-meta';
  const updatedMeta = s.updated ? ` · updated ${humanTime(s.updated)}` : '';
  metaEl.textContent = `${s.tabCount} tabs · ${s.groupCount} groups · ${humanTime(s.saved)}${updatedMeta}`;

  if(s.version && s.version!=='v1'){
    const vb = document.createElement('span');
    vb.className = 's-version';
    vb.textContent = s.version;
    metaEl.appendChild(vb);
  }
  if(s.hours>0){
    const hb = document.createElement('span');
    hb.className = 'hours-badge';
    hb.textContent = `⏱ ${s.hours}h`;
    metaEl.appendChild(hb);
  }

  info.appendChild(nameEl);
  info.appendChild(metaEl);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 's-actions';

  const updateBtn  = document.createElement('button');
  updateBtn.className = 'btn btn-update';
  updateBtn.title = 'Update session (Alt+U)';
  updateBtn.dataset.id = s.id;
  updateBtn.dataset.action = 'update';
  updateBtn.textContent = '↻';

  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'btn btn-restore';
  restoreBtn.dataset.id = s.id;
  restoreBtn.dataset.action = 'restore';
  restoreBtn.textContent = '🚀';

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-del';
  delBtn.dataset.id = s.id;
  delBtn.dataset.action = 'delete';
  delBtn.textContent = '🗑️';

  actions.appendChild(updateBtn);
  actions.appendChild(restoreBtn);
  actions.appendChild(delBtn);

  top.appendChild(iconEl);
  top.appendChild(info);
  top.appendChild(actions);
  card.appendChild(top);

  // Group pills with favicons
  if(namedGroups.length){
    const pillsDiv = document.createElement('div');
    pillsDiv.className = 's-pills';
    namedGroups.forEach(g=>{
      const pill = document.createElement('div');
      pill.className = 's-pill ' + (COLOR_CLASS[g.color]||'c-grey');

      const dot = document.createElement('div');
      dot.className = 's-pill-dot';
      pill.appendChild(dot);

      const labelNode = document.createTextNode(`${g.name||g.color||'—'} `);
      pill.appendChild(labelNode);

      const countSpan = document.createElement('span');
      countSpan.style.opacity = '0.7';
      countSpan.textContent = `(${g.tabs.length})`;
      pill.appendChild(countSpan);

      const favs = (g.favicons||[]).slice(0,3);
      if(favs.length){
        const favsDiv = document.createElement('div');
        favsDiv.className = 's-pill-favicons';
        favs.forEach(src=>{ favsDiv.appendChild(makeFavImg(src,'s-pill-favicon')); });
        pill.appendChild(favsDiv);
      }
      pillsDiv.appendChild(pill);
    });
    card.appendChild(pillsDiv);
  }

  return card;
}

// ─────────────────────────────────────────────────────
//  Bind session action buttons (event delegation)
// ─────────────────────────────────────────────────────
function bindSessionActions(){
  document.querySelectorAll('[data-action]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      if(btn.dataset.action==='restore')       restoreSession(id);
      if(btn.dataset.action==='delete')        deleteSession(id);
      if(btn.dataset.action==='update')        promptUpdateSession(id);
      if(btn.dataset.action==='delete-folder') deleteFolder(id);
    });
  });
}

function bindFolderToggle(){
  document.querySelectorAll('.folder-header').forEach(hdr=>{
    hdr.addEventListener('click', e=>{
      if(e.target.closest('[data-action]')) return;
      const fid    = hdr.dataset.folderId;
      const body   = document.getElementById('body-'+fid);
      const chevron= document.getElementById('chevron-'+fid);
      if(!body) return;
      const isOpen = body.classList.contains('open');
      body.classList.toggle('open', !isOpen);
      if(chevron) chevron.classList.toggle('open', !isOpen);
    });
  });
}

// ─────────────────────────────────────────────────────
//  Folder drag-to-reorder
// ─────────────────────────────────────────────────────
function bindFolderDrag(folders){
  let dragId = null;
  document.querySelectorAll('.folder-section[draggable]').forEach(el=>{
    el.addEventListener('dragstart', ()=>{ dragId=parseInt(el.dataset.folderId); el.style.opacity='.5'; });
    el.addEventListener('dragend',   ()=>{ el.style.opacity=''; dragId=null; });
    el.addEventListener('dragover',  e=>{ e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', ()=>el.classList.remove('drag-over'));
    el.addEventListener('drop', async e=>{
      e.preventDefault();
      el.classList.remove('drag-over');
      const targetId = parseInt(el.dataset.folderId);
      if(dragId===null || dragId===targetId) return;
      const newFolders = [...folders];
      const fromIdx = newFolders.findIndex(f=>f.id===dragId);
      const toIdx   = newFolders.findIndex(f=>f.id===targetId);
      if(fromIdx<0||toIdx<0) return;
      const [moved] = newFolders.splice(fromIdx,1);
      newFolders.splice(toIdx,0,moved);
      await saveFolders(newFolders);
      renderSessions();
    });
  });
}

// ─────────────────────────────────────────────────────
//  View toggle
// ─────────────────────────────────────────────────────
document.getElementById('viewFolders').addEventListener('click', ()=>{
  currentView = 'folders';
  document.getElementById('viewFolders').classList.add('active');
  document.getElementById('viewAll').classList.remove('active');
  renderSessions();
});
document.getElementById('viewAll').addEventListener('click', ()=>{
  currentView = 'all';
  document.getElementById('viewAll').classList.add('active');
  document.getElementById('viewFolders').classList.remove('active');
  renderSessions();
});

// ─────────────────────────────────────────────────────
//  Sessions badge
// ─────────────────────────────────────────────────────
function updateSessionsBadge(count){
  const b = document.getElementById('sessionsBadge');
  if(!b) return;
  b.textContent = count;
  b.style.display = count>0 ? 'inline' : 'none';
}

// ─────────────────────────────────────────────────────
//  External links
// ─────────────────────────────────────────────────────
document.addEventListener('click', e=>{
  const link = e.target.closest('a[href^="http"]');
  if(link){ e.preventDefault(); chrome.tabs.create({url:link.href}); }
});

// ─────────────────────────────────────────────────────
//  Keyboard commands
// ─────────────────────────────────────────────────────
chrome.commands?.onCommand?.addListener(async cmd=>{
  if(cmd==='save-session') doSave();
  if(cmd==='update-session'){
    if(lastRestoredId) promptUpdateSession(lastRestoredId);
    else toast('⚠️ No session restored yet — restore one first', 'warn');
  }
});

// ─────────────────────────────────────────────────────
//  Option listeners
// ─────────────────────────────────────────────────────
document.getElementById('optNSOnly').addEventListener('change', loadCurrentWindow);
document.getElementById('refreshBtn').addEventListener('click', loadCurrentWindow);

// ─────────────────────────────────────────────────────
//  Init
// ─────────────────────────────────────────────────────
(async()=>{
  await loadCurrentWindow();
  await populateFolderDropdown();
  const r = await storageGet('sessions');
  updateSessionsBadge((r.sessions||[]).length);
  setSyncDot('ok');
})();
