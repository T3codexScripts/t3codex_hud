// =======================================
// t3codex_hud NUI (effects + HUD + editor)
// - FULL-SCREEN solid red tint overlay (damage/low-health)
// - Toggle HUD visibility
// - /hudedit: drag + resize HUD/Compass/Vehicle HUD/Gauge
// - ESC/Enter exits edit mode and saves (focus released)
// - Persists positions & scale (client KVP via NUI callback)
// =======================================

const RES_NAME = (typeof GetParentResourceName === 'function')
  ? GetParentResourceName()
  : 't3codex_hud';

// ---------- Inject CSS (overlay + editor visuals) ----------
(function inject() {
  const css = `
body { --vignette-alpha: 0; }
#damage-vignette {
  position: fixed; inset: 0; pointer-events: none;
  opacity: var(--vignette-alpha); transition: opacity 140ms linear;
  background: rgba(180, 0, 0, 1.0); mix-blend-mode: normal;
}
/* damage pulses */
.low-health #damage-vignette { animation: heartbeatPulse 550ms ease-out var(--heartbeat-iteration, 0) 1; }
@keyframes heartbeatPulse { 0%{filter:brightness(1);}15%{filter:brightness(1.12);}30%{filter:brightness(1);}45%{filter:brightness(1.06);}100%{filter:brightness(1);} }
.damage-flash { animation: damageFlash 280ms ease-out 1; }
@keyframes damageFlash { 0%{filter:brightness(1.25) saturate(1.08);}100%{filter:brightness(1) saturate(1.0);} }

/* hide helper */
.hud-hidden #hud, .hud-hidden #compass, .hud-hidden #veh-bar, .hud-hidden #vehGaugeContainer, .hud-hidden #retro-gauge {
  display: none !important;
}

/* ===== Editor Mode ===== */
html.edit-mode { cursor: move; }
.edit-frame {
  outline: 2px dashed rgba(255,255,255,0.5);
  position: absolute; inset: 0; pointer-events: none;
}
.editable {
  position: absolute;
  user-select: none;
  outline: 2px dashed rgba(255, 200, 0, 0.7);
}
.editable .resize-handle {
  position: absolute; width: 16px; height: 16px;
  right: -10px; bottom: -10px;
  background: rgba(255,200,0,0.9);
  pointer-events: auto; cursor: nwse-resize;
  border-radius: 3px;
  box-shadow: 0 0 8px rgba(0,0,0,0.4);
}

/* Reasonable defaults if HTML lacked inline positions */
#hud { position: absolute; bottom: 5%; left: 325px; display: flex; flex-direction: column; }
#compass { position: absolute; top: 2%; left: 50%; transform: translateX(-50%); }
#veh-bar { position: absolute; right: 2%; bottom: 20%; }
#vehGaugeContainer, #retro-gauge { position: absolute; right: 3%; bottom: 5%; }
`;
  const s = document.createElement('style'); s.textContent = css; s.setAttribute('data-t3x','hudfx');
  document.head.appendChild(s);

  if (!document.getElementById('damage-vignette')) {
    const d = document.createElement('div'); d.id = 'damage-vignette'; document.body.appendChild(d);
  }
})();

// ---------- Cached elements ----------
const Body = document.body;
const Vignette = () => document.getElementById('damage-vignette');

// IDs we let the player edit (if present)
const EDITABLE_IDS = ['hud', 'compass', 'veh-bar', 'vehGaugeContainer', 'retro-gauge'];

// ========== Damage / Low-health audio ==========
let audioCtx = null, beatTimer = null, lowHealthActive = false, nextIter = 0;
let FLASH_INT = 1.0, LOW_INT = 1.0; // from Lua config

function ensureAudio(){
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
  if (audioCtx && audioCtx.state === 'suspended') { audioCtx.resume().catch(()=>{}); }
}
function thump(v=0.6,f=60,ms=90){
  if (!audioCtx) return;
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.type='sine'; o.frequency.setValueAtTime(f, audioCtx.currentTime);
  const now=audioCtx.currentTime, atk=0.005, dec=ms/1000;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, v), now + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dec);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(now); o.stop(now + dec + 0.02);
}
function singleHeartbeat(v=0.6){
  thump(v,55,85); setTimeout(()=>thump(Math.max(0, v*0.85),65,100),180);
  nextIter++; Body.style.setProperty('--heartbeat-iteration', String(nextIter)); Body.classList.add('low-health');
}
function stopHeartbeat(){ if(beatTimer){clearInterval(beatTimer); beatTimer=null;} Body.classList.remove('low-health'); }
function startHeartbeat(bpm, vol){
  stopHeartbeat(); ensureAudio();
  const itv = Math.max(280, 60000 / Math.max(40, bpm));
  singleHeartbeat(vol);
  beatTimer = setInterval(()=>singleHeartbeat(vol), itv);
}
function updateLowHealthEffect(health){
  const THRESH=35; const h=Math.max(0, Math.min(100, Number(health)||0));
  if (h >= THRESH) { document.documentElement.style.setProperty('--vignette-alpha','0'); lowHealthActive=false; stopHeartbeat(); return; }
  const t=(THRESH-h)/THRESH;
  const intensity=(0.18+0.62*t)*LOW_INT; // stronger base for full-screen
  const bpm=60+Math.round(60*t);
  const vol=0.35+0.45*t;
  document.documentElement.style.setProperty('--vignette-alpha', String(Math.min(1, intensity).toFixed(3)));
  if (!lowHealthActive){ lowHealthActive=true; ensureAudio(); startHeartbeat(bpm, vol); }
  else { stopHeartbeat(); startHeartbeat(bpm, vol); }
}
function doDamagePulse(dmg, flashIntensity, lowIntensity){
  if (typeof flashIntensity==='number') FLASH_INT=flashIntensity;
  if (typeof lowIntensity==='number')   LOW_INT=lowIntensity;
  ensureAudio();
  const scale=Math.max(0.15, Math.min(1.0, (dmg||1)/25));
  const add=(0.30+0.70*scale)*FLASH_INT;
  const cur=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vignette-alpha'))||0;
  const target=Math.max(cur, Math.min(1.0, cur+add));
  document.documentElement.style.setProperty('--vignette-alpha', target.toFixed(3));
  const node=Vignette(); if(node){ node.classList.remove('damage-flash'); void node.offsetWidth; node.classList.add('damage-flash'); }
  singleHeartbeat(0.45+0.45*scale);
  setTimeout(()=>{ if(!lowHealthActive){ document.documentElement.style.setProperty('--vignette-alpha','0'); } }, 280);
}
window.addEventListener('pointerdown', ensureAudio, {passive:true});
window.addEventListener('keydown', ensureAudio);

// ========== Toggle HUD visibility ==========
function toggleHUD(hidden){
  document.documentElement.classList.toggle('hud-hidden', !!hidden);
  const ids = EDITABLE_IDS;
  ids.forEach(id => { const el=document.getElementById(id); if(el) el.style.display = hidden ? 'none' : (id==='hud' ? 'flex' : 'block'); });
}

// ========== Layout application from Lua ==========
function applyLayout(layout){
  if (!layout) return;
  const viewW = window.innerWidth, viewH = window.innerHeight;

  function applyOne(id, st) {
    const el = document.getElementById(id);
    if (!el || !st) return;
    if (typeof st.left === 'number' && typeof st.top === 'number') {
      el.style.left = (st.left * viewW / 100) + 'px';
      el.style.top  = (st.top  * viewH / 100) + 'px';
      if (id === 'compass') el.style.transform = 'translateX(0)';
      el.style.right = 'auto'; el.style.bottom = 'auto';
      el.style.position = 'absolute';
    }
    if (typeof st.scale === 'number') {
      el.style.transform = (id === 'compass')
        ? `translateX(0) scale(${st.scale})`
        : `scale(${st.scale})`;
      el.style.transformOrigin = 'top left';
    }
  }

  applyOne('hud', layout.hud);
  applyOne('compass', layout.compass);
  applyOne('veh-bar', layout.vehbar);
  applyOne('vehGaugeContainer', layout.gauge);
  applyOne('retro-gauge', layout.gauge);
}

// ========== Editor Mode (drag + resize) ==========
let EDIT_ENABLED = false;
let dragState = null; // { id, startX, startY, elStartL, elStartT, elStartW, elStartH, startScale, mode }
let layoutCache = {}; // live layout (percents + scale)

function pxToPercentLeftTop(el){
  const rect = el.getBoundingClientRect();
  const viewW = window.innerWidth, viewH = window.innerHeight;
  return { left: (rect.left / viewW) * 100, top: (rect.top / viewH) * 100 };
}

function ensureResizeHandle(el){
  if (el.querySelector('.resize-handle')) return;
  const h = document.createElement('div');
  h.className = 'resize-handle';
  el.appendChild(h);
}

function setEditable(el, on){
  if (!el) return;
  if (on){
    el.classList.add('editable');
    el.style.position = 'absolute';
    el.style.transformOrigin = 'top left';
    ensureResizeHandle(el);
  } else {
    el.classList.remove('editable');
    const h = el.querySelector('.resize-handle'); if (h) h.remove();
  }
}

function enterEdit(){
  if (EDIT_ENABLED) return;
  EDIT_ENABLED = true;
  document.documentElement.classList.add('edit-mode');

  EDITABLE_IDS.forEach(id => setEditable(document.getElementById(id), true));

  const frame = document.createElement('div'); frame.className = 'edit-frame'; frame.id = 'edit-frame';
  document.body.appendChild(frame);
}

function getScale(el){
  const st = window.getComputedStyle(el).transform;
  if (!st || st === 'none') return 1;
  const m = st.match(/matrix\(([^)]+)\)/);
  if (!m) return 1;
  const parts = m[1].split(',').map(Number);
  return parts[0] || 1;
}

function exitEdit(save){
  if (!EDIT_ENABLED) return;
  EDIT_ENABLED = false;
  document.documentElement.classList.remove('edit-mode');

  EDITABLE_IDS.forEach(id => setEditable(document.getElementById(id), false));
  const frame = document.getElementById('edit-frame'); if (frame) frame.remove();

  if (save){
    fetch(`https://${RES_NAME}/hud_saveLayout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(layoutCache)
    }).catch(()=>{});
  }
}

function onPointerDown(e){
  if (!EDIT_ENABLED) return;
  let root = e.target;
  while (root && root !== document.body && !EDITABLE_IDS.includes(root.id)) {
    root = root.parentElement;
  }
  if (!root || !EDITABLE_IDS.includes(root.id)) return;

  const isHandle = e.target.classList.contains('resize-handle');
  const rect = root.getBoundingClientRect();

  dragState = {
    id: root.id,
    mode: isHandle ? 'resize' : 'move',
    startX: e.clientX, startY: e.clientY,
    elStartL: rect.left, elStartT: rect.top,
    elStartW: rect.width, elStartH: rect.height,
    startScale: getScale(root)
  };

  e.preventDefault();
}

function onPointerMove(e){
  if (!EDIT_ENABLED || !dragState) return;

  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  const el = document.getElementById(dragState.id);
  if (!el) return;

  if (dragState.mode === 'move'){
    const newL = Math.max(0, Math.min(window.innerWidth  - dragState.elStartW, dragState.elStartL + dx));
    const newT = Math.max(0, Math.min(window.innerHeight - dragState.elStartH, dragState.elStartT + dy));
    el.style.left = `${newL}px`;
    el.style.top  = `${newT}px`;
    el.style.right = 'auto'; el.style.bottom = 'auto';
  } else {
    const baseW = Math.max(1, dragState.elStartW);
    const newW  = Math.max(40, dragState.elStartW + dx);
    const scale = Math.max(0.5, Math.min(3.0, (newW / baseW) * dragState.startScale));
    el.style.transformOrigin = 'top left';
    const isCompass = (el.id === 'compass');
    el.style.transform = isCompass ? `translateX(0) scale(${scale})` : `scale(${scale})`;
  }
}

function onPointerUp(){
  if (!dragState) return;
  const el = document.getElementById(dragState.id);
  if (el){
    const perc = pxToPercentLeftTop(el);
    layoutCache[
      dragState.id === 'compass' ? 'compass'
      : dragState.id === 'veh-bar' ? 'vehbar'
      : (dragState.id === 'vehGaugeContainer' || dragState.id === 'retro-gauge') ? 'gauge'
      : 'hud'
    ] = { left: perc.left, top: perc.top, scale: getScale(el) };
  }
  dragState = null;
}

window.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup',   onPointerUp);

// === Key handler to exit edit mode (ESC/Enter) ===
window.addEventListener('keydown', (e)=>{
  if (!EDIT_ENABLED) return;
  if (e.key === 'Escape' || e.key === 'Enter') {
    // Save & exit
    exitEdit(true);
    // Release focus on Lua side
    fetch(`https://${RES_NAME}/focusOff`, { method: 'POST' }).catch(()=>{});
  }
});

// ========== NUI Messages ==========
window.addEventListener('message', (e)=>{
  const data = e.data;

  if (data.action === 'updateHud') {
    const $ = (id) => document.getElementById(id);
    $('health-fill') && ( $('health-fill').style.width = `${data.health}%` );
    $('hunger-fill') && ( $('hunger-fill').style.width = `${data.hunger}%` );
    $('thirst-fill') && ( $('thirst-fill').style.width = `${data.thirst}%` );
    $('oxygen-fill') && ( $('oxygen-fill').style.width = `${data.oxygen}%` );
    $('armor-fill')  && ( $('armor-fill').style.width  = `${data.armor}%` );
    updateLowHealthEffect(data.health);
  }

  if (data.action === 'updateCompass') {
    const dir = document.getElementById('direction');
    const st  = document.getElementById('street');
    if (dir) dir.innerText = data.direction || 'N';
    if (st)  st.innerText  = data.street || 'Unknown Road';
  }

  if (data.action === 'updateXP') {
    const f = document.getElementById('xp-bar-fill');
    const jl= document.getElementById('job-label');
    if (f)  f.style.width = `${data.xpPercent}%`;
    if (jl) jl.innerText  = `Job: ${data.job} [Level ${data.level}]`;
  }

  if (data.action === 'damagePulse') { doDamagePulse(Number(data.dmg)||1, data.flashIntensity, data.lowIntensity); }
  if (data.action === 'configEffect') {
    if (typeof data.flashIntensity === 'number') FLASH_INT = data.flashIntensity;
    if (typeof data.lowIntensity   === 'number') LOW_INT   = data.lowIntensity;
  }

  if (data.action === 'toggleHUD') { toggleHUD(!!data.hidden); }

  if (data.action === 'applyLayout') { applyLayout(data.layout); }

  if (data.action === 'hudEdit') {
    if (data.enable) { enterEdit(); layoutCache = {}; }
    else { exitEdit(true); } // save on exit (from /hudedit toggle)
  }

  if (data.action === 'hudReset') {
    // Clear inline styles and go back to CSS defaults
    EDITABLE_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.left = ''; el.style.top = ''; el.style.right = ''; el.style.bottom = '';
      el.style.transform = ''; el.style.transformOrigin = '';
      if (id === 'compass') el.style.transform = ''; // back to CSS translateX(-50%)
    });
  }
});
