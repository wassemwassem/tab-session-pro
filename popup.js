'use strict';

const COLOR_CLASS = {
  grey:'c-grey', blue:'c-blue', red:'c-red', yellow:'c-yellow',
  green:'c-green', pink:'c-pink', purple:'c-purple', cyan:'c-cyan', orange:'c-orange'
};
const VALID_COLORS = Object.keys(COLOR_CLASS);
const GROUP_EMOJI  = ['💙','💜','❤️','💚','💛','🩷','🩵','🧡','🩶'];
const ERP_SYSTEMS = [
  'NetSuite','SAP','Oracle ERP','Microsoft Dynamics 365','Salesforce',
  'Odoo','Sage','Infor','Epicor','Workday','QuickBooks Enterprise',
  'Acumatica','SYSPRO','IFS','Deltek','HubSpot','Zoho CRM',
  'Monday.com','Jira','ServiceNow','Others'
];
const ERP_PRESETS = ERP_SYSTEMS.filter(e=>e!=='Others');
const STOP_WORDS = new Set(['the','and','for','with','from','this','that','your','http','https','www','com','html','login','page','tab','window','chrome','undefined','null']);

function utf8ToB64(str){
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for(let i=0;i<bytes.length;i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToUtf8(b64){
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

let lastRestoredId = null;
let currentView = 'folders';
let privateUnlocked = false;
let currentTags = [];
let searchQuery = '';
let folderCb = null;
let updateSessionRef = null;
let hoursOnlySessionId = null;
let erpSetupCallback = null;
let shareTarget = null;
let sortedTabOrder = null;
let deselectedTabIds = new Set();
let deselectedGroupIds = new Set();
let currentData = { groupMap:{}, tabs:[], allTabs:[] };

function esc(s){ return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function humanTime(ts){ const d = new Date(ts); return d.toLocaleDateString(undefined,{month:'short',day:'numeric'}) + ' ' + d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}); }
function fmtHours(h){ return h > 0 ? h + 'h' : '0h'; }
async function hashPin(pin){ const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('tsp_salt_' + pin)); return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join(''); }

function makeFavImg(src, cls){
  const img = document.createElement('img');
  img.className = cls;
  img.src = src;
  img.addEventListener('error', ()=>{ img.style.display='none'; });
  return img;
}

let toastTimer;
function toast(msg, type=''){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.className=''; }, 2800);
}

async function storageGet(keys){
  try { return await chrome.storage.sync.get(keys); }
  catch (e) { return await chrome.storage.local.get(keys); }
}
async function storageSet(data){
  try { await chrome.storage.sync.set(data); setSyncDot('ok'); }
  catch (e) { await chrome.storage.local.set(data); setSyncDot('warn'); }
}

function setSyncDot(state){
  const d = document.getElementById('syncDot');
  const ind = document.getElementById('aboutSyncIndicator');
  const s = document.getElementById('aboutSyncStatus');
  const ok = state === 'ok';
  if (d) d.className = ok ? 'sync-dot' : 'sync-dot error';
  if (ind) ind.className = ok ? 'sync-indicator' : 'sync-indicator off';
  if (s) s.textContent = ok ? 'Synced via Chrome' : 'Local only (sync quota full)';
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'sessions') renderSessions();
    if (btn.dataset.tab === 'settings') initSettingsPanel();
  });
});

storageGet('onboardDismissed').then(r=>{
  if(r.onboardDismissed){
    const o = document.getElementById('onboard');
    if(o) o.style.display='none';
  }
});
document.getElementById('onboardClose').addEventListener('click', ()=>{
  document.getElementById('onboard').style.display='none';
  storageSet({ onboardDismissed: true });
});

function renderTagsRow(){
  const row = document.getElementById('tagsRow');
  const input = document.getElementById('tagInput');
  [...row.children].forEach(c=>{ if(c !== input) c.remove(); });
  currentTags.forEach((tag,i)=>{
    const chip = document.createElement('div');
    chip.className = 'tag-chip';
    chip.textContent = tag;
    const del = document.createElement('span');
    del.className = 'tag-del';
    del.textContent = '✕';
    del.addEventListener('click', ()=>{ currentTags.splice(i,1); renderTagsRow(); });
    chip.appendChild(del);
    row.insertBefore(chip, input);
  });
}
document.getElementById('tagInput').addEventListener('keydown', e=>{
  if(e.key==='Enter' || e.key===','){
    e.preventDefault();
    const v = e.target.value.trim().replace(/,/g,'');
    if(v && !currentTags.includes(v) && currentTags.length < 8){
      currentTags.push(v);
      renderTagsRow();
      e.target.value = '';
    }
  }
});

async function initSettingsPanel(){
  const r = await chrome.storage.local.get('pinHash');
  document.getElementById('pinSettingInput').placeholder = r.pinHash ? '••••' : '• • • •';
}
document.getElementById('savePinBtn').addEventListener('click', async()=>{
  const pin = document.getElementById('pinSettingInput').value.trim();
  const status = document.getElementById('pinStatus');
  if(pin.length !== 4 || !/^\d{4}$/.test(pin)){
    status.className='api-status err';
    status.textContent='PIN must be exactly 4 digits';
    return;
  }
  const hash = await hashPin(pin);
  await chrome.storage.local.set({ pinHash: hash });
  status.className='api-status ok';
  status.textContent='PIN set successfully';
  document.getElementById('pinSettingInput').value='';
  toast('PIN set');
});
document.getElementById('clearPinBtn').addEventListener('click', async()=>{
  await chrome.storage.local.remove('pinHash');
  privateUnlocked = false;
  updatePrivateBtn();
  const status = document.getElementById('pinStatus');
  status.className='api-status ok';
  status.textContent='PIN cleared';
  toast('PIN cleared');
});

async function getErpSystem(){
  const r = await storageGet('erpSystem');
  return r.erpSystem || null;
}
async function saveErpSystem(erp){ await storageSet({ erpSystem: erp }); }
function updateErpFilterLabel(erp){
  const lbl = document.getElementById('erpFilterLabel');
  if(lbl) lbl.textContent = erp ? erp + ' only' : 'ERP/CRM only';
}
async function getCustomErpSystems(){
  const r = await chrome.storage.local.get('customErpSystems');
  return Array.isArray(r.customErpSystems) ? r.customErpSystems.filter(Boolean) : [];
}
async function saveCustomErpSystems(arr){
  const uniq = [...new Set(arr.map(s=>String(s).trim()).filter(Boolean))];
  await chrome.storage.local.set({ customErpSystems: uniq });
}
async function removeCustomErpSystem(name){
  const arr = await getCustomErpSystems();
  await saveCustomErpSystems(arr.filter(x=>x!==name));
  const cur = await getErpSystem();
  if(cur === name){ await saveErpSystem(null); updateErpFilterLabel(null); }
  else updateErpFilterLabel(await getErpSystem());
  const cb = erpSetupCallback;
  await openErpSetupModal(cb);
  toast('Removed "' + name + '"');
}
function renderCustomErpList(customs){
  const wrap = document.getElementById('customErpList');
  if(!wrap) return;
  wrap.innerHTML='';
  if(!customs.length) return;
  const title = document.createElement('div');
  title.style.cssText='font-size:10px;text-transform:uppercase;color:var(--muted);margin-top:4px';
  title.textContent='Your custom systems (click 🗑️ to remove)';
  wrap.appendChild(title);
  customs.forEach(name=>{
    const row = document.createElement('div');
    row.className='custom-erp-row';
    const sp = document.createElement('span');
    sp.textContent = name;
    const del = document.createElement('button');
    del.type='button';
    del.className='btn-icon';
    del.textContent='🗑️';
    del.title='Remove';
    del.addEventListener('click', e=>{ e.preventDefault(); removeCustomErpSystem(name); });
    row.appendChild(sp);
    row.appendChild(del);
    wrap.appendChild(row);
  });
}
async function openErpSetupModal(onSave){
  const modal = document.getElementById('erpSetupModal');
  const sel = document.getElementById('erpSelectInput');
  const customWrap = document.getElementById('erpCustomWrap');
  const customInput = document.getElementById('erpCustomInput');
  const customs = await getCustomErpSystems();
  sel.innerHTML = '<option value="">Select your system</option>';
  ERP_PRESETS.forEach(erp=>{
    const opt = document.createElement('option');
    opt.value = erp;
    opt.textContent = erp;
    sel.appendChild(opt);
  });
  if(customs.length){
    const og = document.createElement('optgroup');
    og.label = 'My systems';
    customs.forEach(erp=>{
      const opt = document.createElement('option');
      opt.value = erp;
      opt.textContent = erp;
      og.appendChild(opt);
    });
    sel.appendChild(og);
  }
  const optOthers = document.createElement('option');
  optOthers.value = 'Others';
  optOthers.textContent = 'Others (new name)';
  sel.appendChild(optOthers);
  renderCustomErpList(customs);
  customWrap.style.display='none';
  customInput.value='';
  const current = await getErpSystem();
  if(current){
    const exists = [...sel.options].some(o=>o.value===current);
    if(!exists){
      const opt = document.createElement('option');
      opt.value = current;
      opt.textContent = current;
      sel.insertBefore(opt, optOthers);
    }
    sel.value = current;
  }
  erpSetupCallback = onSave || null;
  modal.classList.add('show');
}
document.getElementById('erpSelectInput').addEventListener('change', function(){
  document.getElementById('erpCustomWrap').style.display = this.value === 'Others' ? 'block' : 'none';
});
document.getElementById('cancelErpBtn').addEventListener('click', ()=>{
  document.getElementById('erpSetupModal').classList.remove('show');
  erpSetupCallback = null;
});
document.getElementById('confirmErpBtn').addEventListener('click', async()=>{
  const sel = document.getElementById('erpSelectInput');
  const custom = document.getElementById('erpCustomInput');
  let erp = sel.value;
  if(erp === 'Others'){
    erp = custom.value.trim();
    if(!erp){ toast('Enter your system name','warn'); return; }
    const customs = await getCustomErpSystems();
    if(!customs.includes(erp)){
      customs.push(erp);
      await saveCustomErpSystems(customs);
    }
  }
  if(!erp){ toast('Select a system','warn'); return; }
  await saveErpSystem(erp);
  document.getElementById('erpSetupModal').classList.remove('show');
  updateErpFilterLabel(erp);
  toast('System set to ' + erp);
  if(erpSetupCallback){ erpSetupCallback(erp); erpSetupCallback = null; }
});
document.getElementById('erpSetupLink').addEventListener('click', ()=>openErpSetupModal(()=>loadCurrentWindow()));
document.getElementById('erpSetupFromSettingsBtn').addEventListener('click', ()=>openErpSetupModal(()=>loadCurrentWindow()));

function matchesErp(url, title, erpName){
  const hay = ((url||'') + ' ' + (title||'')).toLowerCase();
  const patterns = {
    'netsuite':['netsuite.com','netsuite'],
    'sap':['sap.com','fiori','sap/'],
    'oracle erp':['oracle.com','oraclecloud'],
    'salesforce':['salesforce.com','force.com'],
    'microsoft dynamics 365':['dynamics.com','crm.dynamics'],
    'odoo':['odoo.com'],
    'sage':['sage.com','sageone'],
    'hubspot':['hubspot.com'],
    'zoho crm':['zoho.com'],
    'workday':['workday.com','myworkday'],
    'servicenow':['service-now.com','servicenow'],
    'jira':['atlassian.net','jira'],
    'monday.com':['monday.com']
  };
  const k = erpName.toLowerCase();
  if(patterns[k]) return patterns[k].some(p=>hay.includes(p));
  return hay.includes(k.split(' ')[0]);
}

async function loadCurrentWindow(){
  const content = document.getElementById('previewContent');
  content.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div>Scanning…</div>';
  deselectedTabIds.clear();
  deselectedGroupIds.clear();
  try{
    const [allTabsRaw, groups] = await Promise.all([
      chrome.tabs.query({ currentWindow: true }),
      chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT })
    ]);
    const groupMap = {};
    groups.forEach(g=>{ groupMap[g.id]=g; });
    let tabs = allTabsRaw;
    if(document.getElementById('optERPOnly').checked){
      const erp = await getErpSystem();
      if(erp) tabs = allTabsRaw.filter(t=>matchesErp(t.url, t.title, erp));
    }
    currentData = { groupMap, tabs, allTabs: allTabsRaw };
    renderPreview(groupMap, tabs, content);
    updateActiveTabCount();
  } catch(err){
    content.innerHTML = `<div class="empty">⚠️ ${esc(err.message)}</div>`;
  }
}

function refreshGroupFavicons(gTabs, groupId, favDiv){
  favDiv.innerHTML='';
  const visible = deselectedGroupIds.has(groupId) ? [] : gTabs.filter(t=>!deselectedTabIds.has(t.id));
  const urls = [...new Set(visible.map(t=>t.favIconUrl).filter(Boolean))];
  urls.slice(0,3).forEach(src=>favDiv.appendChild(makeFavImg(src,'g-favicon')));
  const extra = urls.length - 3;
  if(extra>0){
    const span = document.createElement('span');
    span.className='g-favicons-more';
    span.textContent='+'+extra;
    favDiv.appendChild(span);
  }
}

function renderPreview(groupMap, tabs, container){
  container.innerHTML='';
  if(!tabs.length){
    container.innerHTML='<div class="empty"><div class="empty-icon">🔍</div>No matching tabs.<br/>Uncheck filters to see all.</div>';
    return;
  }
  const buckets = {};
  const order = [];
  tabs.forEach(tab=>{
    const key = tab.groupId>=0 ? String(tab.groupId) : '__ungrouped__';
    if(!buckets[key]){ buckets[key]=[]; order.push(key); }
    buckets[key].push(tab);
  });
  const seen = new Set();
  const keys = order.filter(k=>{ if(seen.has(k)) return false; seen.add(k); return true; });
  keys.forEach(key=>{
    const gTabs = buckets[key];
    if(key==='__ungrouped__'){
      gTabs.forEach(tab=>{
        const row = document.createElement('div');
        row.className = 'ungrouped-row' + (deselectedTabIds.has(tab.id) ? ' deselected' : '');
        row.style.display='flex';
        row.style.alignItems='center';
        row.style.gap='6px';
        const cb = document.createElement('input');
        cb.type='checkbox';
        cb.checked=!deselectedTabIds.has(tab.id);
        cb.style.accentColor='var(--accent)';
        cb.addEventListener('change', ()=>{
          if(cb.checked) deselectedTabIds.delete(tab.id);
          else deselectedTabIds.add(tab.id);
          row.classList.toggle('deselected', !cb.checked);
          updateActiveTabCount();
        });
        const title = document.createElement('span');
        title.style.flex='1';
        title.textContent = tab.title || tab.url || 'Untitled';
        row.appendChild(cb);
        row.appendChild(title);
        container.appendChild(row);
      });
    } else {
      const groupId = parseInt(key,10);
      const g = groupMap[groupId] || {};
      const gRow = document.createElement('div');
      gRow.className = 'group-row' + (deselectedGroupIds.has(groupId) ? ' deselected' : '');
      const gCb = document.createElement('input');
      gCb.type='checkbox';
      gCb.checked=!deselectedGroupIds.has(groupId);
      gCb.style.accentColor='var(--accent)';
      const dot = document.createElement('span');
      dot.className = 'g-dot ' + (COLOR_CLASS[g.color] || 'c-grey');
      const name = document.createElement('span');
      name.className='g-name';
      name.textContent=g.title || g.color || 'Group';
      const count = document.createElement('span');
      count.className='g-tabs';
      count.textContent = `${gTabs.length} tab${gTabs.length!==1?'s':''}`;
      const favDiv = document.createElement('div');
      favDiv.className='g-favicons';
      refreshGroupFavicons(gTabs, groupId, favDiv);
      gRow.appendChild(gCb);
      gRow.appendChild(dot);
      gRow.appendChild(name);
      gRow.appendChild(count);
      gRow.appendChild(favDiv);
      container.appendChild(gRow);
      const subRows = [];
      gTabs.forEach(tab=>{
        const row = document.createElement('div');
        row.className = 'tab-sub' + ((deselectedTabIds.has(tab.id) || deselectedGroupIds.has(groupId)) ? ' deselected' : '');
        const tCb = document.createElement('input');
        tCb.type='checkbox';
        tCb.checked = !deselectedTabIds.has(tab.id) && !deselectedGroupIds.has(groupId);
        tCb.disabled = deselectedGroupIds.has(groupId);
        tCb.style.accentColor='var(--accent)';
        tCb.addEventListener('change', ()=>{
          if(tCb.checked) deselectedTabIds.delete(tab.id);
          else deselectedTabIds.add(tab.id);
          row.classList.toggle('deselected', !tCb.checked);
          refreshGroupFavicons(gTabs, groupId, favDiv);
          updateActiveTabCount();
        });
        row.appendChild(tCb);
        if(tab.favIconUrl) row.appendChild(makeFavImg(tab.favIconUrl,'tab-sub-favicon'));
        else {
          const sp = document.createElement('span');
          sp.style.width='12px';
          sp.style.display='inline-block';
          row.appendChild(sp);
        }
        const title = document.createElement('span');
        title.className='tab-sub-title';
        title.title=tab.url || '';
        title.textContent=tab.title || tab.url || 'Untitled';
        row.appendChild(title);
        row._cb = tCb;
        subRows.push(row);
        container.appendChild(row);
      });
      gCb.addEventListener('change', ()=>{
        if(gCb.checked){
          deselectedGroupIds.delete(groupId);
          gRow.classList.remove('deselected');
          subRows.forEach(r=>{ r.classList.remove('deselected'); r._cb.checked=true; r._cb.disabled=false; });
          gTabs.forEach(t=>deselectedTabIds.delete(t.id));
        } else {
          deselectedGroupIds.add(groupId);
          gRow.classList.add('deselected');
          subRows.forEach(r=>{ r.classList.add('deselected'); r._cb.checked=false; r._cb.disabled=true; });
        }
        refreshGroupFavicons(gTabs, groupId, favDiv);
        updateActiveTabCount();
      });
    }
  });
}

function getSelectedTabs(){
  return (currentData.tabs || []).filter(t=>{
    if(deselectedTabIds.has(t.id)) return false;
    if(t.groupId>=0 && deselectedGroupIds.has(t.groupId)) return false;
    return true;
  });
}
function updateActiveTabCount(){
  const stat = document.getElementById('previewStat');
  const all = currentData.tabs || [];
  const active = getSelectedTabs();
  const activeGroups = new Set(active.filter(t=>t.groupId>=0).map(t=>t.groupId)).size;
  const excl = all.length - active.length;
  const exclTxt = excl > 0 ? ` (${excl} excluded)` : '';
  stat.textContent = `${active.length} tabs · ${activeGroups} groups${exclTxt}`;
}

document.getElementById('hoursInput').addEventListener('input', function(){
  const v = parseFloat(this.value) || 0;
  const preview = document.getElementById('hoursPreview');
  if(v>0){
    preview.style.display='flex';
    document.getElementById('hoursTotalDisplay').textContent = v + 'h';
  } else {
    preview.style.display='none';
  }
});

function generateLocalSuggestions(tabs, groupMap){
  const groupTitles = [...new Set(Object.values(groupMap).map(g=>g.title).filter(Boolean))];
  const titles = tabs.map(t=>t.title || '').filter(Boolean);
  const blob = titles.join(' ');
  const ticketMatch = blob.match(/[A-Z]{2,}-?\d{3,}|#\d{3,}|ticket\s*#?\d+|INC\d+|REQ-\d+|PR-\d+/gi);
  const dateFmt = new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'});
  const dateStr = dateFmt.format(new Date());
  const words = [];
  try{
    const seg = new Intl.Segmenter(undefined,{granularity:'word'});
    const raw = blob.toLowerCase();
    for(const {segment} of seg.segment(raw)){
      if(segment.length>2 && /^[a-z0-9-]+$/i.test(segment) && !STOP_WORDS.has(segment)) words.push(segment);
    }
  }catch(e){
    blob.replace(/[^\w\s-]/g,' ').split(/\s+/).forEach(w=>{
      if(w.length>3 && !STOP_WORDS.has(w.toLowerCase())) words.push(w.toLowerCase());
    });
  }
  const uniqWords = [...new Set(words)].slice(0,10);
  const g1 = groupTitles[0] || '';
  const g2 = groupTitles[1] || '';
  const ticket = ticketMatch ? ticketMatch[0] : '';
  const w1 = uniqWords[0] || '';
  const w2 = uniqWords[1] || '';
  const out = [];
  const push = (s)=>{ if(s && out.length<4 && !out.includes(s)) out.push(s); };
  if(ticket && g1) push(`${ticket} — ${g1}`);
  if(ticket && w1 && !ticket.includes(w1)) push(`${ticket} · ${w1}`);
  if(g1 && g2) push(`${g1} + ${g2} · ${dateStr}`);
  if(g1 && w1) push(`${g1} — ${w1}`);
  if(w1 && w2) push(`${w1} ${w2} (${tabs.length} tabs)`);
  push(`${g1 || 'Session'} · ${dateStr}`);
  while(out.length<3) push(`Session ${dateStr} (${tabs.length} tabs)`);
  return out.slice(0,3);
}
function generateLocalNote(tabs, groupMap){
  const groups = [...new Set(Object.values(groupMap).map(g=>g.title).filter(Boolean))];
  const sampleTitle = (tabs.find(t=>t.title)?.title || '').split('|')[0].trim();
  const ticket = (tabs.map(t=>t.title||'').join(' ').match(/[A-Z]{2,}-?\d{3,}|#\d{3,}/i) || [])[0];
  const groupPart = groups.slice(0,2).join(' + ') || 'current workstream';
  if(ticket && sampleTitle) return `Working on ${ticket}: ${sampleTitle.slice(0,60)}`;
  if(sampleTitle) return `${sampleTitle.slice(0,70)} (${groupPart})`;
  return `Working session focused on ${groupPart}.`;
}

document.getElementById('aiRenameBtn').addEventListener('click', async()=>{
  const btn = document.getElementById('aiRenameBtn');
  const sEl = document.getElementById('aiSuggestions');
  const tabs = getSelectedTabs();
  const groupMap = currentData.groupMap;
  if(!tabs.length){ toast('⚠️ No tabs to analyze','warn'); return; }
  btn.classList.add('loading');
  btn.textContent = '✨ Thinking…';
  sEl.innerHTML='';
  sEl.classList.remove('show');
  await new Promise(r=>setTimeout(r,400));
  try{
    const suggestions = generateLocalSuggestions(tabs, groupMap);
    suggestions.forEach(s=>{
      const div = document.createElement('div');
      div.className='ai-suggestion';
      const label = document.createElement('span');
      label.textContent=s;
      const hint = document.createElement('span');
      hint.textContent='↵ apply';
      div.appendChild(label);
      div.appendChild(hint);
      div.addEventListener('click', ()=>{
        document.getElementById('sessionName').value=s;
        sEl.classList.remove('show');
        toast('✅ Name applied');
      });
      sEl.appendChild(div);
    });
    sEl.classList.add('show');
  }catch(err){ toast('⚠️ Could not generate suggestions','warn'); }
  finally{
    btn.classList.remove('loading');
    btn.textContent='✨ Smart Name';
  }
});

async function getFolders(){ const r = await storageGet('folders'); return r.folders || []; }
async function saveFolders(folders){ await storageSet({ folders }); }
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

function openNewFolderModal(cb){
  folderCb = cb || null;
  document.getElementById('newFolderName').value='';
  document.getElementById('newFolderModal').classList.add('show');
  setTimeout(()=>document.getElementById('newFolderName').focus(),100);
}
async function confirmNewFolder(){
  const name = document.getElementById('newFolderName').value.trim();
  if(!name){ toast('⚠️ Enter a folder name','warn'); return; }
  const folders = await getFolders();
  const folder = { id:Date.now(), name, order:folders.length };
  folders.push(folder);
  await saveFolders(folders);
  document.getElementById('newFolderModal').classList.remove('show');
  await populateFolderDropdown();
  toast(`📁 Folder "${name}" created`);
  if(folderCb) folderCb(folder);
  folderCb = null;
}
document.getElementById('confirmFolderBtn').addEventListener('click', confirmNewFolder);
document.getElementById('cancelFolderBtn').addEventListener('click', ()=>{ document.getElementById('newFolderModal').classList.remove('show'); folderCb = null; });
document.getElementById('newFolderName').addEventListener('keydown', e=>{
  if(e.key==='Enter') confirmNewFolder();
  if(e.key==='Escape') document.getElementById('newFolderModal').classList.remove('show');
});
document.getElementById('newFolderBtn').addEventListener('click', ()=>openNewFolderModal());
document.getElementById('newFolderBtnSessions').addEventListener('click', ()=>openNewFolderModal(()=>renderSessions()));

async function hasPin(){ const r = await chrome.storage.local.get('pinHash'); return !!r.pinHash; }
function openPinUnlockModal(cb){
  document.getElementById('pinUnlockInput').value='';
  document.getElementById('pinError').style.display='none';
  document.getElementById('pinUnlockModal').classList.add('show');
  setTimeout(()=>document.getElementById('pinUnlockInput').focus(),100);
  document.getElementById('confirmPinUnlockBtn')._cb = cb;
}
document.getElementById('confirmPinUnlockBtn').addEventListener('click', async()=>{
  const pin = document.getElementById('pinUnlockInput').value.trim();
  const hash = await hashPin(pin);
  const r = await chrome.storage.local.get('pinHash');
  if(hash === r.pinHash){
    document.getElementById('pinUnlockModal').classList.remove('show');
    privateUnlocked = true;
    updatePrivateBtn();
    const cb = document.getElementById('confirmPinUnlockBtn')._cb;
    if(cb) cb();
  } else {
    document.getElementById('pinError').style.display='block';
    document.getElementById('pinUnlockInput').value='';
  }
});
document.getElementById('cancelPinUnlockBtn').addEventListener('click', ()=>document.getElementById('pinUnlockModal').classList.remove('show'));
document.getElementById('pinUnlockInput').addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('confirmPinUnlockBtn').click(); });
async function togglePrivate(){
  if(privateUnlocked){
    privateUnlocked = false;
    updatePrivateBtn();
    renderSessions();
    return;
  }
  if(!(await hasPin())){
    toast('Set a PIN first in Settings','warn');
    document.querySelector('[data-tab="settings"]').click();
    return;
  }
  openPinUnlockModal(()=>renderSessions());
}
function updatePrivateBtn(){
  const btn = document.getElementById('privateToggleBtn');
  if(privateUnlocked){
    btn.textContent='🔓';
    btn.classList.add('active');
  } else {
    btn.textContent='🔒';
    btn.classList.remove('active');
  }
}
document.getElementById('privateToggleBtn').addEventListener('click', togglePrivate);

function normalizeSession(s){
  const groups = Array.isArray(s.groups) ? s.groups : [];
  const namedGroups = groups.filter(g=>g.id !== '__ungrouped__');
  return {
    ...s,
    name: s.name || 'Untitled Session',
    saved: s.saved || s.id || Date.now(),
    tabCount: Number.isFinite(s.tabCount) ? s.tabCount : groups.reduce((n,g)=>n + ((g.tabs||[]).length),0),
    groupCount: Number.isFinite(s.groupCount) ? s.groupCount : namedGroups.length,
    hours: Number.isFinite(s.hours) ? s.hours : 0,
    tags: Array.isArray(s.tags) ? s.tags : [],
    note: typeof s.note === 'string' ? s.note : '',
    isPrivate: !!s.isPrivate,
    isBacklog: !!s.isBacklog,
    version: s.version || 'v1',
    folderId: s.folderId === '__backlog__' ? null : (s.folderId || null),
    groups
  };
}

async function doSave(){
  try{
    const nameEl = document.getElementById('sessionName');
    const name = nameEl.value.trim() || `Session ${new Date().toLocaleDateString()}`;
    const keepGroups = document.getElementById('optGroups').checked;
    const keepCollapsed = document.getElementById('optCollapsed').checked;
    const hoursVal = parseFloat(document.getElementById('hoursInput').value) || 0;
    const folderId = document.getElementById('folderSelect').value || null;
    const isPrivate = document.getElementById('optPrivate').checked;
    const tags = [...currentTags];
    const tabs = getSelectedTabs();
    const groupMap = currentData.groupMap;
    if(!tabs.length){ toast('⚠️ No tabs selected','warn'); return; }
    const buckets = {};
    tabs.forEach(tab=>{
      const key = tab.groupId>=0 ? String(tab.groupId) : '__ungrouped__';
      if(!buckets[key]) buckets[key] = [];
      buckets[key].push({ url: tab.url, title: tab.title, favicon: tab.favIconUrl || '' });
    });
    const savedGroups = Object.entries(buckets).map(([key,tabList])=>{
      if(key==='__ungrouped__') return { id:'__ungrouped__', name:'', color:'grey', collapsed:false, tabs:tabList, favicons:[] };
      const g = groupMap[parseInt(key,10)] || {};
      const favicons = [...new Set(tabList.map(t=>t.favicon).filter(Boolean))].slice(0,4);
      return { id:key, name:g.title || '', color:g.color || 'grey', collapsed:keepCollapsed ? !!g.collapsed : false, tabs:tabList, favicons };
    });
    const note = generateLocalNote(tabs, groupMap);
    const session = {
      id: Date.now(),
      name,
      saved: Date.now(),
      tabCount: tabs.length,
      groupCount: savedGroups.filter(g=>g.id!=='__ungrouped__').length,
      version: 'v1',
      hours: hoursVal,
      folderId,
      isPrivate,
      isBacklog: false,
      tags,
      note,
      groups: keepGroups ? savedGroups : [{
        id:'__ungrouped__', name:'', color:'grey', collapsed:false,
        tabs: tabs.map(t=>({url:t.url, title:t.title, favicon:t.favIconUrl || ''})),
        favicons:[]
      }]
    };
    const r = await storageGet('sessions');
    const sessions = (r.sessions || []).map(normalizeSession);
    sessions.unshift(session);
    await storageSet({ sessions });
    nameEl.value='';
    document.getElementById('hoursInput').value='';
    document.getElementById('hoursPreview').style.display='none';
    currentTags=[];
    renderTagsRow();
    updateSessionsBadge(sessions.filter(s=>!s.isBacklog).length);
    toast('✅ Saved "' + name + '"');
  }catch(err){
    console.error(err);
    toast('❌ Save failed: ' + (err && err.message ? err.message : String(err)), 'err');
  }
}
document.getElementById('saveBtn').addEventListener('click', doSave);

async function restoreSession(id){
  const r = await storageGet('sessions');
  const sessions = (r.sessions || []).map(normalizeSession);
  const session = sessions.find(s=>s.id===id);
  if(!session){ toast('Session not found','warn'); return; }
  const hoursStr = session.hours>0 ? `\n⏱ ${session.hours}h logged on this ticket` : '';
  const ok = confirm(`Restore "${session.name}"?\n\nOpens ${session.tabCount} tabs in ${session.groupCount} group(s).${hoursStr}\n\n⚠️ Log into your app first!`);
  if(!ok) return;
  lastRestoredId = id;
  try{
    for(const group of session.groups){
      const tabIds = [];
      for(const tabDef of group.tabs || []){
        try{
          const tab = await chrome.tabs.create({url: tabDef.url, active:false});
          tabIds.push(tab.id);
          await new Promise(r=>setTimeout(r,60));
        }catch(e){}
      }
      if(group.id !== '__ungrouped__' && tabIds.length){
        try{
          const gid = await chrome.tabs.group({ tabIds });
          const color = VALID_COLORS.includes(group.color) ? group.color : 'grey';
          await chrome.tabGroups.update(gid, { title: group.name || '', color, collapsed: !!group.collapsed });
        }catch(e){}
      }
    }
    toast('🚀 Restored "' + session.name + '"!');
  }catch(err){
    toast('❌ Restore failed: ' + (err && err.message ? err.message : String(err)), 'err');
  }
}

async function promptUpdateSession(id){
  const r = await storageGet('sessions');
  const sessions = (r.sessions || []).map(normalizeSession);
  const session = sessions.find(s=>s.id===id);
  if(!session){ toast('Session not found','warn'); return; }
  const [allTabs, groups] = await Promise.all([
    chrome.tabs.query({ currentWindow: true }),
    chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT })
  ]);
  const groupMap = {};
  groups.forEach(g=>{ groupMap[g.id]=g; });
  updateSessionRef = { id, session, sessions, tabs: allTabs, groupMap };
  document.getElementById('updateModalSub').textContent = `Update "${session.name}" with current ${allTabs.length} tabs?`;
  document.getElementById('updateHoursInput').value='';
  document.getElementById('updateTotalDisplay').textContent = fmtHours(session.hours);
  document.getElementById('updateHoursOnlyToggle').checked = false;
  toggleUpdateMode(false);
  document.getElementById('updateModal').classList.add('show');
}
function toggleUpdateMode(hoursOnly){
  document.getElementById('updateTabsNote').style.display = hoursOnly ? 'none' : '';
  document.getElementById('confirmUpdateBtn').textContent = hoursOnly ? 'Save Hours Only' : '✓ Update Session';
}
document.getElementById('updateHoursOnlyToggle').addEventListener('change', function(){ toggleUpdateMode(this.checked); });
document.getElementById('updateHoursInput').addEventListener('input', function(){
  if(!updateSessionRef) return;
  const add = parseFloat(this.value) || 0;
  const total = (updateSessionRef.session.hours || 0) + add;
  document.getElementById('updateTotalDisplay').textContent = total > 0 ? total + 'h' : '0h';
});
document.getElementById('cancelUpdateBtn').addEventListener('click', ()=>{
  document.getElementById('updateModal').classList.remove('show');
  updateSessionRef = null;
});
document.getElementById('confirmUpdateBtn').addEventListener('click', async()=>{
  if(!updateSessionRef) return;
  document.getElementById('updateModal').classList.remove('show');
  const {id, session, sessions, tabs, groupMap} = updateSessionRef;
  const addHours = parseFloat(document.getElementById('updateHoursInput').value) || 0;
  const newHours = (session.hours || 0) + addHours;
  const hoursOnly = document.getElementById('updateHoursOnlyToggle').checked;
  let updated;
  if(hoursOnly){
    updated = { ...session, hours: newHours, updated: Date.now() };
  } else {
    const vNum = parseInt((session.version || 'v1').replace('v',''), 10) || 1;
    const buckets = {};
    tabs.forEach(tab=>{
      const key = tab.groupId>=0 ? String(tab.groupId) : '__ungrouped__';
      if(!buckets[key]) buckets[key] = [];
      buckets[key].push({ url: tab.url, title: tab.title, favicon: tab.favIconUrl || '' });
    });
    const savedGroups = Object.entries(buckets).map(([key,tabList])=>{
      if(key==='__ungrouped__') return { id:'__ungrouped__', name:'', color:'grey', collapsed:false, tabs:tabList, favicons:[] };
      const g = groupMap[parseInt(key,10)] || {};
      const favicons = [...new Set(tabList.map(t=>t.favicon).filter(Boolean))].slice(0,4);
      return { id:key, name:g.title || '', color:g.color || 'grey', collapsed: !!g.collapsed, tabs:tabList, favicons };
    });
    updated = {
      ...session,
      groups: savedGroups,
      tabCount: tabs.length,
      groupCount: savedGroups.filter(g=>g.id!=='__ungrouped__').length,
      version: 'v' + (vNum + 1),
      hours: newHours,
      updated: Date.now(),
      note: generateLocalNote(tabs, groupMap)
    };
  }
  const idx = sessions.findIndex(s=>s.id===id);
  if(idx>=0){ sessions[idx]=updated; await storageSet({ sessions }); }
  toast(`✅ Updated${newHours>0?' — '+newHours+'h total':''}`);
  updateSessionRef = null;
  renderSessions();
});

async function promptUpdateHoursOnly(id){
  const r = await storageGet('sessions');
  const sessions = (r.sessions || []).map(normalizeSession);
  const session = sessions.find(s=>s.id===id);
  if(!session){ toast('Session not found','warn'); return; }
  hoursOnlySessionId = id;
  document.getElementById('hoursOnlyModalSub').textContent = `"${session.name}" current: ${fmtHours(session.hours)}`;
  document.getElementById('hoursOnlyInput').value='';
  document.getElementById('hoursOnlyTotal').textContent = fmtHours(session.hours);
  document.getElementById('hoursOnlyModal').classList.add('show');
}
document.getElementById('hoursOnlyInput').addEventListener('input', async function(){
  if(!hoursOnlySessionId) return;
  const r = await storageGet('sessions');
  const sessions = (r.sessions || []).map(normalizeSession);
  const session = sessions.find(s=>s.id===hoursOnlySessionId);
  if(!session) return;
  const total = (session.hours || 0) + (parseFloat(this.value) || 0);
  document.getElementById('hoursOnlyTotal').textContent = fmtHours(total);
});
document.getElementById('cancelHoursOnlyBtn').addEventListener('click', ()=>{
  document.getElementById('hoursOnlyModal').classList.remove('show');
  hoursOnlySessionId = null;
});
document.getElementById('confirmHoursOnlyBtn').addEventListener('click', async()=>{
  if(!hoursOnlySessionId) return;
  const r = await storageGet('sessions');
  const sessions = (r.sessions || []).map(normalizeSession);
  const idx = sessions.findIndex(s=>s.id===hoursOnlySessionId);
  if(idx<0) return;
  const addHours = parseFloat(document.getElementById('hoursOnlyInput').value) || 0;
  sessions[idx] = { ...sessions[idx], hours:(sessions[idx].hours || 0) + addHours, updated: Date.now() };
  await storageSet({ sessions });
  document.getElementById('hoursOnlyModal').classList.remove('show');
  hoursOnlySessionId = null;
  renderSessions();
});

async function deleteSession(id){
  const r = await storageGet('sessions');
  const sessions = (r.sessions || []).map(normalizeSession).filter(s=>s.id!==id);
  await storageSet({ sessions });
  updateSessionsBadge(sessions.filter(s=>!s.isBacklog).length);
  renderSessions();
  toast('🗑️ Deleted');
}
async function deleteFolder(folderId){
  const folders = (await getFolders()).filter(f=>f.id!==folderId);
  await saveFolders(folders);
  const r = await storageGet('sessions');
  const sessions = (r.sessions || []).map(normalizeSession).map(s=>s.folderId===folderId ? {...s, folderId:null} : s);
  await storageSet({ sessions, folders });
  renderSessions();
  populateFolderDropdown();
  toast('📁 Folder removed (sessions kept)');
}

async function toggleBacklog(id){
  const r = await storageGet('sessions');
  const sessions = (r.sessions||[]).map(normalizeSession);
  const idx = sessions.findIndex(s=>s.id===id);
  if(idx<0) return;
  const wasBacklog = !!sessions[idx].isBacklog;
  sessions[idx] = {...sessions[idx], isBacklog:!wasBacklog};
  await storageSet({sessions});
  updateSessionsBadge(sessions.filter(s=>!s.isBacklog).length);
  toast(wasBacklog ? '📋 Moved back to active' : '📦 Moved to Backlog');
  renderSessions();
}

// ── Sort Tabs — with preview modal ──

async function openSortModal(){
  const [allTabs, groups] = await Promise.all([
    chrome.tabs.query({currentWindow:true}),
    chrome.tabGroups.query({windowId:chrome.windows.WINDOW_ID_CURRENT})
  ]);
  if(!allTabs.length){ toast('⚠️ No tabs to sort','warn'); return; }

  const groupMap={};
  groups.forEach(g=>{ groupMap[g.id]=g; });

  const grouped   = allTabs.filter(t=>t.groupId>=0);
  const ungrouped = allTabs.filter(t=>t.groupId<0);

  const sortedGids = [...groups].sort((a,b)=>(a.title||'').toLowerCase().localeCompare((b.title||'').toLowerCase())).map(g=>g.id);
  const groupBuckets={};
  grouped.forEach(t=>{
    if(!groupBuckets[t.groupId]) groupBuckets[t.groupId]=[];
    groupBuckets[t.groupId].push(t);
  });
  Object.values(groupBuckets).forEach(arr=>{
    arr.sort((a,b)=>{ try{ return new URL(a.url||'').hostname.localeCompare(new URL(b.url||'').hostname); }catch(e){return 0;} });
  });

  sortedTabOrder = [];
  sortedGids.forEach(gid=>{ if(groupBuckets[gid]) sortedTabOrder.push(...groupBuckets[gid]); });
  ungrouped.sort((a,b)=>(a.title||'').localeCompare(b.title||''));
  sortedTabOrder.push(...ungrouped);

  const preview = document.getElementById('sortPreview');
  preview.innerHTML='';

  sortedGids.forEach(gid=>{
    const g = groupMap[gid]||{};
    const tabs = groupBuckets[gid]||[];
    const div=document.createElement('div'); div.className='sort-preview-group';
    const lbl=document.createElement('div'); lbl.className='sort-preview-group-label';
    const cc = COLOR_CLASS[g.color]||'c-grey';
    lbl.innerHTML=`<span class="g-dot ${cc}" style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:middle;"></span>${esc(g.title||g.color||'Group')} (${tabs.length} tabs)`;
    div.appendChild(lbl);
    tabs.forEach(t=>{
      const row=document.createElement('div'); row.className='sort-preview-tab';
      row.textContent=t.title||t.url||'Untitled'; div.appendChild(row);
    });
    preview.appendChild(div);
  });

  if(ungrouped.length){
    const div=document.createElement('div'); div.className='sort-preview-group';
    const lbl=document.createElement('div'); lbl.className='sort-preview-group-label';
    lbl.textContent=`Ungrouped (${ungrouped.length} tabs)`;
    div.appendChild(lbl);
    ungrouped.forEach(t=>{
      const row=document.createElement('div'); row.className='sort-preview-tab';
      row.textContent=t.title||t.url||'Untitled'; div.appendChild(row);
    });
    preview.appendChild(div);
  }

  document.getElementById('sortModal').classList.add('show');
}

document.getElementById('sortTabsBtn').addEventListener('click', openSortModal);
document.getElementById('cancelSortBtn').addEventListener('click', ()=>{
  document.getElementById('sortModal').classList.remove('show');
  sortedTabOrder=null;
});
document.getElementById('confirmSortBtn').addEventListener('click', async()=>{
  if(!sortedTabOrder){ document.getElementById('sortModal').classList.remove('show'); return; }
  document.getElementById('sortModal').classList.remove('show');
  try{
    for(let i=0;i<sortedTabOrder.length;i++){
      await chrome.tabs.move(sortedTabOrder[i].id, {index:i});
    }
    sortedTabOrder=null;
    toast('✅ Tabs sorted!');
    await loadCurrentWindow();
  } catch(err){
    toast('⚠️ Sort failed: '+err.message,'err');
    sortedTabOrder=null;
  }
});

// ── Share session modal ──

function openShareModal(session){
  shareTarget = session;
  document.getElementById('shareModalSub').textContent =
    `Choose how to share "${session.name}" with a colleague who has Tab Session Pro.`;
  document.getElementById('shareModal').classList.add('show');
}

document.getElementById('cancelShareBtn').addEventListener('click', ()=>{
  document.getElementById('shareModal').classList.remove('show');
  shareTarget=null;
});

function triggerDownload(filename, text, mime){
  const blob = new Blob([text], { type: mime || 'application/json' });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(u), 2000);
}

document.getElementById('shareExportBtn').addEventListener('click', ()=>{
  if(!shareTarget) return;
  const payload = JSON.stringify({_tsp:true, v:'4.1.0', session:shareTarget}, null, 2);
  const safe = (shareTarget.name||'session').replace(/[^a-zA-Z0-9_\- ]/g,'').trim().replace(/\s+/g,'_') || 'session';
  triggerDownload(safe+'.tabsession', payload);
  document.getElementById('shareModal').classList.remove('show');
  shareTarget=null;
  toast('📄 File downloaded!');
});

document.getElementById('shareCopyCodeBtn').addEventListener('click', async()=>{
  if(!shareTarget) return;
  try{
    const json = JSON.stringify({_tsp:true, v:'4.1.0', session:shareTarget});
    const code = 'TSP:' + utf8ToB64(json);
    await navigator.clipboard.writeText(code);
    toast('📋 Share code copied! Paste it to your colleague.');
  } catch(e){ toast('⚠️ Clipboard not available — try the file option','warn'); }
  document.getElementById('shareModal').classList.remove('show');
  shareTarget=null;
});

// ── Import session modal (paste code or file) ──

document.getElementById('importBtn').addEventListener('click', ()=>{
  document.getElementById('importPaste').value='';
  const fileInput = document.getElementById('importFileInput');
  if(fileInput) fileInput.value='';
  document.getElementById('importModal').classList.add('show');
});
document.getElementById('cancelImportBtn').addEventListener('click', ()=>{
  document.getElementById('importModal').classList.remove('show');
});

document.getElementById('importFileInput').addEventListener('change', async function(){
  const file=this.files[0]; if(!file) return;
  try{
    const text=await file.text();
    document.getElementById('importPaste').value=text;
    toast('📂 File loaded — click Import to continue');
  } catch(e){ toast('⚠️ Could not read file','err'); }
});

document.getElementById('confirmImportBtn').addEventListener('click', async()=>{
  let raw = document.getElementById('importPaste').value.trim();
  if(!raw){ toast('⚠️ Paste a share code or upload a file','warn'); return; }

  let sessionData;
  try{
    if(raw.startsWith('TSP:')){
      const json = b64ToUtf8(raw.slice(4));
      const obj = JSON.parse(json);
      if(!obj._tsp || !obj.session) throw new Error('bad');
      sessionData = obj.session;
    } else {
      const obj = JSON.parse(raw);
      if(obj._tsp && obj.session) sessionData = obj.session;
      else if(obj.name && obj.groups) sessionData = obj;
      else throw new Error('bad');
    }
  } catch(e){
    toast('⚠️ Invalid share code or file','err');
    return;
  }

  const newSession = normalizeSession({
    ...sessionData,
    id: Date.now(),
    saved: Date.now(),
    updated: Date.now(),
    isBacklog: false
  });

  const r=await storageGet('sessions');
  const sessions=(r.sessions||[]).map(normalizeSession);
  sessions.unshift(newSession);
  await storageSet({sessions});
  updateSessionsBadge(sessions.filter(s=>!s.isBacklog).length);
  document.getElementById('importModal').classList.remove('show');
  toast(`✅ Imported "${newSession.name}"`);
  renderSessions();
});

// ── Settings: Backup & Restore (bulk export/import) ──

document.getElementById('exportAllBtn').addEventListener('click', async()=>{
  const r = await storageGet('sessions');
  const sessions = (r.sessions || []).map(normalizeSession);
  const payload = { version: '4.1.0', exported: Date.now(), sessions };
  triggerDownload('tab-sessions-backup.tspsession', JSON.stringify(payload, null, 2));
  toast('📤 Exported ' + sessions.length + ' sessions');
});

document.getElementById('importSessionsBtn').addEventListener('click', ()=>{
  document.getElementById('importSessionsFile').click();
});
document.getElementById('importSessionsFile').addEventListener('change', async e=>{
  const f = e.target.files && e.target.files[0];
  e.target.value='';
  if(!f) return;
  try{
    const text = await f.text();
    const data = JSON.parse(text);
    let incoming = [];
    if(Array.isArray(data)) incoming = data;
    else if(data.sessions && Array.isArray(data.sessions)) incoming = data.sessions;
    else if(data.name && data.groups) incoming = [data];
    else { toast('Unrecognized backup format','err'); return; }
    const r = await storageGet('sessions');
    const existing = (r.sessions || []).map(normalizeSession);
    const merged = incoming.map(normalizeSession).map(s=>({ ...s, id: Date.now() + Math.floor(Math.random()*1e6), saved: Date.now() }));
    const next = [...merged, ...existing];
    await storageSet({ sessions: next });
    updateSessionsBadge(next.filter(s=>!s.isBacklog).length);
    renderSessions();
    toast('✅ Imported ' + merged.length + ' session(s)');
  }catch(err){
    toast('❌ Import failed: ' + (err.message || String(err)), 'err');
  }
});

// ── Search ──

document.getElementById('searchInput').addEventListener('input', function(){
  searchQuery = this.value.toLowerCase().trim();
  renderSessions();
});
function sessionMatches(s){
  if(!searchQuery) return true;
  if((s.name || '').toLowerCase().includes(searchQuery)) return true;
  if((s.tags || []).some(t=>t.toLowerCase().includes(searchQuery))) return true;
  if((s.note || '').toLowerCase().includes(searchQuery)) return true;
  if((s.groups || []).some(g=>(g.name || '').toLowerCase().includes(searchQuery))) return true;
  return false;
}

// ── Render sessions ──

async function renderSessions(){
  const [r, folders] = await Promise.all([storageGet('sessions'), getFolders()]);
  const all = (r.sessions || []).map(normalizeSession);
  const active  = all.filter(s=>!s.isBacklog);
  const backlog = all.filter(s=> s.isBacklog);
  const list = document.getElementById('sessionsList');
  updateSessionsBadge(active.length);

  if(!all.length){
    list.innerHTML = '<div class="empty"><div class="empty-icon">📭</div>No sessions yet.<br/>Go to Save to capture your first session.</div>';
    return;
  }

  const visible = all.filter(s=>sessionMatches(s) && (!s.isPrivate || privateUnlocked));
  const visActive  = visible.filter(s=>!s.isBacklog);
  const visBacklog = visible.filter(s=> s.isBacklog);

  list.innerHTML='';

  if(currentView==='all'){
    visActive.forEach((s,i)=>list.appendChild(buildSessionCard(s,i,false)));
  } else {
    folders.forEach(folder=>{
      const folderSessions = visActive.filter(s=>s.folderId==folder.id && !s.isPrivate);
      list.appendChild(buildFolderSection(folder, folderSessions));
    });
    const standalone = visActive.filter(s=>!s.folderId && !s.isPrivate);
    if(standalone.length){
      if(folders.length){
        const lbl=document.createElement('div');
        lbl.style.cssText='font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:600;padding:4px 2px;';
        lbl.textContent='Standalone';
        list.appendChild(lbl);
      }
      standalone.forEach((s,i)=>list.appendChild(buildSessionCard(s,i,false)));
    }
    const totalPrivate = all.filter(s=>s.isPrivate).length;
    list.appendChild(buildPrivateVault(visible.filter(s=>s.isPrivate), totalPrivate));
  }

  // Backlog section with orange-themed divider
  if(visBacklog.length){
    const dividerEl=document.createElement('div'); dividerEl.className='backlog-divider';
    const lineL=document.createElement('div'); lineL.className='backlog-divider-line';
    const toggle=document.createElement('div'); toggle.className='backlog-toggle';
    const chevron=document.createElement('span'); chevron.className='backlog-toggle-chevron'; chevron.textContent='▶';
    const label=document.createElement('span'); label.className='backlog-toggle-label'; label.textContent='📦 Backlog';
    const cnt=document.createElement('span'); cnt.className='backlog-count-badge'; cnt.textContent=visBacklog.length;
    const hint=document.createElement('span'); hint.className='backlog-hint'; hint.textContent='archived sessions';
    toggle.appendChild(chevron); toggle.appendChild(label); toggle.appendChild(cnt); toggle.appendChild(hint);
    const lineR=document.createElement('div'); lineR.className='backlog-divider-line';
    dividerEl.appendChild(lineL); dividerEl.appendChild(toggle); dividerEl.appendChild(lineR);
    list.appendChild(dividerEl);

    const body=document.createElement('div'); body.className='backlog-body';
    visBacklog.forEach((s,i)=>body.appendChild(buildSessionCard(s,i,false)));
    list.appendChild(body);

    toggle.addEventListener('click',()=>{
      const open=body.classList.toggle('open');
      chevron.classList.toggle('open',open);
    });
  }

  bindFolderToggle();
  bindFolderDrag(folders);
  bindSessionActions();
}

function buildPrivateVault(visiblePrivate, totalPrivate){
  const vault = document.createElement('div');
  vault.className='private-vault';
  const hdr = document.createElement('div');
  hdr.className='private-vault-header';
  hdr.innerHTML = `<span>${privateUnlocked?'🔓':'🔒'}</span><span class="private-vault-title">Private Vault</span><span style="font-size:10px;color:var(--muted);">${privateUnlocked ? (visiblePrivate.length + ' sessions') : ('locked ' + totalPrivate + ' sessions')}</span>`;
  const body = document.createElement('div');
  body.className='private-vault-body' + (privateUnlocked ? ' open' : '');
  if(privateUnlocked){
    if(visiblePrivate.length){
      visiblePrivate.forEach((s,i)=>body.appendChild(buildSessionCard(s,i,true)));
    } else {
      const e = document.createElement('div');
      e.style.cssText='padding:10px 14px;font-size:11px;color:var(--muted);font-style:italic;';
      e.textContent='No private sessions';
      body.appendChild(e);
    }
  }
  hdr.addEventListener('click', ()=>{
    if(!privateUnlocked) openPinUnlockModal(()=>renderSessions());
    else body.classList.toggle('open');
  });
  vault.appendChild(hdr);
  vault.appendChild(body);
  return vault;
}

function buildFolderSection(folder, sessions){
  const section = document.createElement('div');
  section.className='folder-section';
  section.id='folder-' + folder.id;
  section.draggable=true;
  section.dataset.folderId=folder.id;
  const hdr = document.createElement('div');
  hdr.className='folder-header';
  hdr.dataset.folderId=folder.id;
  hdr.innerHTML = `<span class="folder-drag-handle">⠿</span><span class="folder-chevron open" id="chevron-${folder.id}">▶</span><span class="folder-icon">📁</span><span class="folder-name">${esc(folder.name)}</span><span class="folder-meta">${sessions.length} session${sessions.length!==1?'s':''}</span><div class="folder-actions"><button class="btn-icon" data-action="delete-folder" data-id="${folder.id}" title="Delete folder">🗑️</button></div>`;
  const body = document.createElement('div');
  body.className='folder-body open';
  body.id='body-' + folder.id;
  if(sessions.length){
    sessions.forEach((s,i)=>body.appendChild(buildSessionCard(s,i,true)));
  } else {
    const e = document.createElement('div');
    e.style.cssText='padding:10px 14px;font-size:11px;color:var(--muted);font-style:italic;';
    e.textContent='Empty folder — assign sessions from the Save tab';
    body.appendChild(e);
  }
  section.appendChild(hdr);
  section.appendChild(body);
  return section;
}

function buildSessionCard(s, i, inFolder){
  const namedGroups = (s.groups || []).filter(g=>g.id !== '__ungrouped__');
  const emoji = GROUP_EMOJI[i % GROUP_EMOJI.length];
  const card = document.createElement('div');
  card.className = 's-card' + (inFolder ? ' in-folder' : '') + (s.isPrivate ? ' private-card' : '') + (s.isBacklog ? ' is-backlog' : '');

  const top = document.createElement('div');
  top.className='s-top';
  const iconEl = document.createElement('div');
  iconEl.className='s-icon';
  iconEl.textContent = s.isPrivate ? '🔒' : emoji;
  const info = document.createElement('div');
  info.className='s-info';
  const nameEl = document.createElement('div');
  nameEl.className='s-name';
  nameEl.textContent=s.name;
  const metaEl = document.createElement('div');
  metaEl.className='s-meta';
  const updatedMeta=s.updated?` · upd ${humanTime(s.updated)}`:'';
  metaEl.textContent = `${s.tabCount} tabs · ${s.groupCount} groups · ${humanTime(s.saved)}${updatedMeta}`;
  if(s.version && s.version !== 'v1'){
    const vb = document.createElement('span');
    vb.className='s-version';
    vb.textContent=s.version;
    metaEl.appendChild(vb);
  }
  if(s.hours > 0){
    const hb = document.createElement('span');
    hb.className='hours-badge';
    hb.textContent=`⏱ ${s.hours}h`;
    metaEl.appendChild(hb);
  }
  info.appendChild(nameEl);
  info.appendChild(metaEl);

  const acts = document.createElement('div');
  acts.className='s-actions';

  if(!s.isBacklog){
    const updateBtn=document.createElement('button'); updateBtn.className='btn btn-update';
    updateBtn.title='Update session'; updateBtn.dataset.id=s.id; updateBtn.dataset.action='update';
    updateBtn.textContent='↻'; acts.appendChild(updateBtn);
  }

  const restoreBtn=document.createElement('button'); restoreBtn.className='btn btn-restore';
  restoreBtn.dataset.id=s.id; restoreBtn.dataset.action='restore'; restoreBtn.textContent='🚀';
  acts.appendChild(restoreBtn);

  const shareBtn=document.createElement('button'); shareBtn.className='btn btn-share';
  shareBtn.title='Share this session'; shareBtn.dataset.id=s.id; shareBtn.dataset.action='share';
  shareBtn.textContent='🔗'; acts.appendChild(shareBtn);

  const hoursBtn=document.createElement('button'); hoursBtn.className='btn btn-hours';
  hoursBtn.title='Add hours'; hoursBtn.dataset.id=s.id; hoursBtn.dataset.action='update-hours';
  hoursBtn.textContent='⏱'; acts.appendChild(hoursBtn);

  const backlogBtn=document.createElement('button');
  backlogBtn.className='btn btn-backlog';
  backlogBtn.title=s.isBacklog?'Restore from Backlog':'Archive to Backlog';
  backlogBtn.dataset.id=s.id; backlogBtn.dataset.action='backlog';
  backlogBtn.textContent=s.isBacklog?'📋':'📦'; acts.appendChild(backlogBtn);

  const delBtn=document.createElement('button'); delBtn.className='btn btn-del';
  delBtn.dataset.id=s.id; delBtn.dataset.action='delete'; delBtn.textContent='🗑️'; acts.appendChild(delBtn);

  top.appendChild(iconEl);
  top.appendChild(info);
  top.appendChild(acts);
  card.appendChild(top);

  if(namedGroups.length){
    const pillsDiv = document.createElement('div');
    pillsDiv.className='s-pills';
    namedGroups.forEach(g=>{
      const pill = document.createElement('div');
      pill.className='s-pill ' + (COLOR_CLASS[g.color] || 'c-grey');
      const dot = document.createElement('div');
      dot.className='s-pill-dot';
      pill.appendChild(dot);
      pill.appendChild(document.createTextNode(`${g.name || g.color || '—'} `));
      const cs = document.createElement('span');
      cs.style.opacity='0.7';
      cs.textContent=`(${(g.tabs||[]).length})`;
      pill.appendChild(cs);
      const favs=(g.favicons||[]).slice(0,3);
      if(favs.length){
        const fd=document.createElement('div'); fd.className='s-pill-favicons';
        favs.forEach(src=>fd.appendChild(makeFavImg(src,'s-pill-favicon')));
        pill.appendChild(fd);
      }
      pillsDiv.appendChild(pill);
    });
    card.appendChild(pillsDiv);
  }

  if(s.tags && s.tags.length){
    const tags = document.createElement('div');
    tags.className='s-tags';
    s.tags.forEach(t=>{
      const sp = document.createElement('span');
      sp.className='s-tag';
      sp.textContent='#' + t;
      tags.appendChild(sp);
    });
    card.appendChild(tags);
  }

  if(s.note){
    const note = document.createElement('div');
    note.className='s-note';
    note.textContent='📝 ' + s.note;
    card.appendChild(note);
  }

  return card;
}

function bindSessionActions(){
  document.querySelectorAll('[data-action]').forEach(btn=>{
    btn.addEventListener('click', async e=>{
      e.stopPropagation();
      const id = parseInt(btn.dataset.id,10);
      const action = btn.dataset.action;
      if(action==='restore')       restoreSession(id);
      if(action==='delete')        deleteSession(id);
      if(action==='update')        promptUpdateSession(id);
      if(action==='update-hours')  promptUpdateHoursOnly(id);
      if(action==='delete-folder') deleteFolder(id);
      if(action==='backlog')       toggleBacklog(id);
      if(action==='share'){
        const r=await storageGet('sessions');
        const s=(r.sessions||[]).map(normalizeSession).find(x=>x.id===id);
        if(s) openShareModal(s);
      }
    });
  });
}
function bindFolderToggle(){
  document.querySelectorAll('.folder-header').forEach(hdr=>{
    hdr.addEventListener('click', e=>{
      if(e.target.closest('[data-action]')) return;
      const id = hdr.dataset.folderId;
      const body = document.getElementById('body-' + id);
      const chev = document.getElementById('chevron-' + id);
      if(!body) return;
      const open = body.classList.contains('open');
      body.classList.toggle('open', !open);
      if(chev) chev.classList.toggle('open', !open);
    });
  });
}
function bindFolderDrag(folders){
  let dragId = null;
  document.querySelectorAll('.folder-section[draggable]').forEach(el=>{
    el.addEventListener('dragstart', ()=>{ dragId = parseInt(el.dataset.folderId,10); el.style.opacity='.5'; });
    el.addEventListener('dragend', ()=>{ el.style.opacity=''; dragId = null; });
    el.addEventListener('dragover', e=>{ e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', ()=>el.classList.remove('drag-over'));
    el.addEventListener('drop', async e=>{
      e.preventDefault();
      el.classList.remove('drag-over');
      const target = parseInt(el.dataset.folderId,10);
      if(dragId===null || dragId===target) return;
      const arr = [...folders];
      const fi = arr.findIndex(f=>f.id===dragId);
      const ti = arr.findIndex(f=>f.id===target);
      if(fi<0 || ti<0) return;
      const [mv] = arr.splice(fi,1);
      arr.splice(ti,0,mv);
      await saveFolders(arr);
      renderSessions();
    });
  });
}

document.getElementById('viewFolders').addEventListener('click', ()=>{
  currentView='folders';
  document.getElementById('viewFolders').classList.add('active');
  document.getElementById('viewAll').classList.remove('active');
  renderSessions();
});
document.getElementById('viewAll').addEventListener('click', ()=>{
  currentView='all';
  document.getElementById('viewAll').classList.add('active');
  document.getElementById('viewFolders').classList.remove('active');
  renderSessions();
});
function updateSessionsBadge(count){
  const b = document.getElementById('sessionsBadge');
  if(!b) return;
  b.textContent=count;
  b.style.display = count>0 ? 'inline' : 'none';
}

document.addEventListener('click', e=>{
  const link = e.target.closest('a[href^="http"]');
  if(link){
    e.preventDefault();
    chrome.tabs.create({ url: link.href });
  }
});

document.getElementById('optERPOnly').addEventListener('change', async function(){
  if(this.checked){
    const erp = await getErpSystem();
    if(!erp){
      this.checked=false;
      openErpSetupModal(async()=>{
        document.getElementById('optERPOnly').checked=true;
        await loadCurrentWindow();
      });
      return;
    }
  }
  loadCurrentWindow();
});
document.getElementById('refreshBtn').addEventListener('click', loadCurrentWindow);

chrome.commands?.onCommand?.addListener(cmd=>{
  if(cmd==='save-session') doSave();
  if(cmd==='update-session'){
    if(lastRestoredId) promptUpdateSession(lastRestoredId);
    else toast('⚠️ Restore a session first','warn');
  }
  if(cmd==='toggle-private') togglePrivate();
  if(cmd==='sort-tabs') openSortModal();
});

(async()=>{
  const aboutHeroImg = document.querySelector('.about-hero-img');
  if(aboutHeroImg && typeof chrome !== 'undefined' && chrome.runtime?.getURL){
    aboutHeroImg.src = chrome.runtime.getURL('icons/icon128.png');
    aboutHeroImg.alt = 'Tab Session Pro';
  }

  if(location.hash.startsWith('#tspsession=')){
    try{
      const raw = decodeURIComponent(location.hash.slice('#tspsession='.length));
      const session = JSON.parse(b64ToUtf8(raw));
      const norm = normalizeSession(session);
      const ok = confirm(`Import shared session "${norm.name}"?\n${norm.tabCount} tabs · ${norm.groupCount} groups\n\nSave it to your sessions list?`);
      if(ok){
        const r = await storageGet('sessions');
        const sessions = (r.sessions || []).map(normalizeSession);
        norm.id = Date.now();
        norm.saved = Date.now();
        sessions.unshift(norm);
        await storageSet({ sessions });
        history.replaceState(null, '', location.pathname + location.search);
        updateSessionsBadge(sessions.filter(s=>!s.isBacklog).length);
        toast('✅ Session imported from link');
      } else {
        history.replaceState(null, '', location.pathname + location.search);
      }
    }catch(e){
      console.error(e);
      toast('Invalid or corrupted share link','err');
    }
  }

  const erp = await getErpSystem();
  updateErpFilterLabel(erp);
  await loadCurrentWindow();
  await populateFolderDropdown();
  renderTagsRow();
  const r = await storageGet('sessions');
  updateSessionsBadge((r.sessions || []).filter(s=>!normalizeSession(s).isBacklog).length);
  setSyncDot('ok');
  updatePrivateBtn();
})();
