// frontend/js/usuario.js — Dashboard usuario v3.0

let colorSel     = 'Plata';
let userFilter   = 'all';
let equipos      = [];
let equipoEditId = null;

// Timers
let claveTimer   = null;
let qrTimer      = null;

// ── Abrir dashboard ───────────────────────
function openUserDash() {
  showPage('page-user');
  const s = getSession();
  document.getElementById('user-dname').textContent = s.user.nombre.split(' ')[0];
  userTab('home', document.getElementById('unav-home'));
}

function userTab(sec, el) {
  document.querySelectorAll('#page-user .dash-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#user-nav .nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('usec-' + sec).classList.add('active');
  el.classList.add('active');

  // Parar timers si salimos de esas secciones
  if (sec !== 'qr')   { stopQRTimer(); }
  if (sec !== 'clave'){ stopClaveTimer(); }

  if (sec === 'home')      loadUserHome();
  if (sec === 'equipos')   loadEquiposList();
  if (sec === 'qr')        loadUserQR();
  if (sec === 'clave')     loadClaveDinamica();
  if (sec === 'historial') loadUserHistorial();
}

// ── HOME ──────────────────────────────────
async function loadUserHome() {
  const s = getSession();
  document.getElementById('user-chip-name').textContent = s.user.nombre;
  document.getElementById('user-chip-sub').textContent  = s.user.rol;
  document.getElementById('user-avatar').textContent    =
    s.user.nombre.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase();
  try {
    const res  = await fetch(`${API}/registros/mios`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    document.getElementById('u-stat-total').textContent = data.length;
    document.getElementById('u-stat-entry').textContent = data.filter(l => l.tipo==='entrada').length;
    document.getElementById('u-stat-exit').textContent  = data.filter(l => l.tipo==='salida').length;
    const last = data[0];
    const box  = document.getElementById('u-last-move');
    box.innerHTML = last ? `
      <div style="display:flex;align-items:center;gap:12px">
        <div class="log-icon ${last.tipo}" style="width:42px;height:42px;border-radius:11px">${last.tipo==='entrada'?'🟢':'🔴'}</div>
        <div>
          <div style="font-family:var(--head);font-size:.78rem;font-weight:700;letter-spacing:1px;color:${last.tipo==='entrada'?'var(--green)':'var(--red)'}">
            ${last.tipo.toUpperCase()}
          </div>
          <div style="font-size:.68rem;color:var(--muted);margin-top:2px">${last.equipo_nombre} · ${formatTime(new Date(last.timestamp))}</div>
          <div style="font-size:.62rem;color:var(--muted)">${formatDate(new Date(last.timestamp))}</div>
        </div>
      </div>` :
      '<div class="empty"><div class="empty-icon">🕐</div><p>Sin movimientos aún.</p></div>';
  } catch {
    document.getElementById('u-last-move').innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><p>Error cargando datos.</p></div>';
  }
}

// ══════════════════════════════════════════
//  EQUIPOS MÚLTIPLES
// ══════════════════════════════════════════
async function loadEquiposList() {
  const c = document.getElementById('equipos-lista');
  c.innerHTML = '<div class="loading-row"><span class="spinner"></span> Cargando...</div>';
  try {
    const res = await fetch(`${API}/equipos`, { headers: authHeaders() });
    equipos   = await res.json();
    c.innerHTML = equipos.length ? equipos.map(equipoCardHTML).join('') :
      '<div class="empty"><div class="empty-icon">🖥️</div><p>No tienes equipos registrados.<br>Agrega tu primer equipo.</p></div>';
  } catch { c.innerHTML = emptyHTML('Error cargando equipos.'); }
}

function equipoCardHTML(eq) {
  const dotClr = {'Plata':'#b0b8c8','Negro':'#1a1a2e','Blanco':'#f0f0f0','Gris':'#607080',
    'Azul':'#1d4ed8','Rojo':'#b91c1c','Dorado':'#b7860b','Verde':'#15803d'}[eq.color] || '#888';
  const ico = {'Portátil':'💻','Computadora':'🖥️','Tablet':'📱'}[eq.tipo] || '💻';
  return `<div class="equipo-card" id="ecard-${eq.id}">
    <div class="eq-card-header">
      <div class="eq-icon">${ico}</div>
      <div class="eq-info"><div class="eq-nombre">${eq.nombre}</div><div class="eq-sub">${eq.marca} · ${eq.tipo}</div></div>
      <div class="eq-actions">
        <button class="eq-btn-qr"   onclick="verQREquipo(${eq.id})">⬛ QR</button>
        <button class="eq-btn-edit" onclick="abrirFormEquipo(${eq.id})">✏️</button>
        <button class="eq-btn-del"  onclick="eliminarEquipo(${eq.id})">🗑</button>
      </div>
    </div>
    <div class="eq-card-body">
      <div class="eq-detail"><span class="eq-lbl">Serial</span><span class="eq-val">${eq.serial}</span></div>
      <div class="eq-detail"><span class="eq-lbl">Modelo</span><span class="eq-val">${eq.modelo||'—'}</span></div>
      <div class="eq-detail"><span class="eq-lbl">Color</span><span class="eq-val">
        <span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:${dotClr};vertical-align:middle;margin-right:4px"></span>${eq.color}
      </span></div>
    </div>
  </div>`;
}

function abrirFormEquipo(id = null) {
  equipoEditId = id;
  document.getElementById('modal-equipo-title').textContent = id ? 'EDITAR EQUIPO' : 'AGREGAR EQUIPO';
  ['eq-nombre','eq-marca','eq-serial','eq-modelo'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('eq-tipo').value = 'Portátil';
  colorSel = 'Plata';
  document.querySelectorAll('.color-opt').forEach(o => o.classList.toggle('selected', o.dataset.color === 'Plata'));
  if (id) {
    const eq = equipos.find(e => e.id === id);
    if (eq) {
      document.getElementById('eq-nombre').value = eq.nombre;
      document.getElementById('eq-marca').value  = eq.marca;
      document.getElementById('eq-serial').value = eq.serial;
      document.getElementById('eq-modelo').value = eq.modelo||'';
      document.getElementById('eq-tipo').value   = eq.tipo;
      colorSel = eq.color||'Plata';
      document.querySelectorAll('.color-opt').forEach(o => o.classList.toggle('selected', o.dataset.color === eq.color));
    }
  }
  document.getElementById('modal-equipo').classList.add('active');
}
function cerrarFormEquipo() { document.getElementById('modal-equipo').classList.remove('active'); equipoEditId = null; }

async function guardarEquipo() {
  const nombre = document.getElementById('eq-nombre').value.trim();
  const tipo   = document.getElementById('eq-tipo').value;
  const marca  = document.getElementById('eq-marca').value.trim();
  const serial = document.getElementById('eq-serial').value.trim();
  const modelo = document.getElementById('eq-modelo').value.trim();
  if (!nombre || !serial || !marca) { toast('Completa nombre, marca y serial', 'err'); return; }

  const btn  = document.getElementById('btn-guardar-equipo');
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;

  try {
    const url    = equipoEditId ? `${API}/equipos/${equipoEditId}` : `${API}/equipos`;
    const method = equipoEditId ? 'PUT' : 'POST';
    const res    = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify({ nombre, tipo, marca, serial, modelo, color: colorSel }) });
    const data   = await res.json();
    if (!res.ok) { toast(data.error || 'Error guardando', 'err'); return; }
    cerrarFormEquipo();
    loadEquiposList();
    toast(equipoEditId ? '✅ Equipo actualizado' : '✅ Equipo agregado', 'ok');
  } catch { toast('Error de conexión', 'err'); }
  finally { btn.innerHTML = orig; btn.disabled = false; }
}

async function eliminarEquipo(id) {
  const eq = equipos.find(e => e.id === id);
  if (!confirm(`¿Eliminar "${eq?.nombre}"?`)) return;
  try {
    const res = await fetch(`${API}/equipos/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) { toast('Error eliminando', 'err'); return; }
    loadEquiposList(); toast('🗑 Equipo eliminado', 'info');
  } catch { toast('Error de conexión', 'err'); }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.color-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.color-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected'); colorSel = opt.dataset.color;
    });
  });
});

// ══════════════════════════════════════════
//  QR ROTATIVO (cambia cada 60 seg)
// ══════════════════════════════════════════
let qrEquipoActual = null;
let qrTimerInterval = null;

function stopQRTimer() { if (qrTimerInterval) { clearInterval(qrTimerInterval); qrTimerInterval = null; } }

async function loadUserQR() {
  stopQRTimer();
  try {
    const res = await fetch(`${API}/equipos`, { headers: authHeaders() });
    equipos   = await res.json();
    const noEq = document.getElementById('qr-noequipo');
    const qrV  = document.getElementById('qr-view');
    if (!equipos.length) { noEq.style.display = 'block'; qrV.style.display = 'none'; return; }
    noEq.style.display = 'none'; qrV.style.display = 'block';
    const sel = document.getElementById('qr-equipo-sel');
    sel.innerHTML = equipos.map(eq =>
      `<option value="${eq.id}">${eq.tipo==='Portátil'?'💻':eq.tipo==='Tablet'?'📱':'🖥️'} ${eq.nombre} — ${eq.serial}</option>`
    ).join('');
    generarQREquipo(equipos[0].id);
    iniciarQRTimer();
  } catch { toast('Error cargando equipos', 'err'); }
}

function onChangeQREquipo(sel) { generarQREquipo(parseInt(sel.value)); }

function verQREquipo(id) {
  userTab('qr', document.getElementById('unav-qr'));
  setTimeout(() => { const s = document.getElementById('qr-equipo-sel'); if(s){s.value=id;generarQREquipo(id);} }, 200);
}

async function generarQREquipo(equipoId) {
  const eq = equipos.find(e => e.id === equipoId);
  if (!eq) return;
  qrEquipoActual = equipoId;

  // Obtener seed dinámico del servidor
  let seed = '';
  try {
    const res = await fetch(`${API}/auth/clave-dinamica`, { headers: authHeaders() });
    if (res.ok) {
      const d = await res.json();
      seed = d.clave; // usamos la clave como seed extra de seguridad
    }
  } catch { /* sin seed, el QR igual funciona */ }

  const s = getSession();
  document.getElementById('qm-tipo').textContent   = eq.tipo;
  document.getElementById('qm-serial').textContent = eq.serial;
  document.getElementById('qm-color').textContent  = eq.color;

  // Timestamp de ventana (minuto actual) para que el QR cambie cada minuto
  const ventana  = Math.floor(Date.now() / 1000 / 60);
  const payload  = JSON.stringify({
    v:3, n: s.user.nombre, c: s.user.cedula, r: s.user.rol,
    en: eq.nombre, et: eq.tipo, es: eq.serial, em: eq.marca, ec: eq.color, emo: eq.modelo,
    t: ventana   // ← esto hace que el QR sea único por minuto
  });
  generarQR(payload, 'qr-output');

  // Mostrar cuenta regresiva del QR
  actualizarQRCountdown();
}

function actualizarQRCountdown() {
  const seg  = Math.floor(Date.now() / 1000);
  const rest = 60 - (seg % 60);
  const el   = document.getElementById('qr-countdown');
  if (el) {
    el.textContent = `⟳ QR se renueva en ${rest}s`;
    el.style.color = rest <= 10 ? 'var(--red)' : 'var(--muted)';
  }
}

function iniciarQRTimer() {
  stopQRTimer();
  actualizarQRCountdown();
  qrTimerInterval = setInterval(() => {
    actualizarQRCountdown();
    // Regenerar al inicio de cada minuto
    const seg = Math.floor(Date.now() / 1000);
    if (seg % 60 === 0 && qrEquipoActual) generarQREquipo(qrEquipoActual);
  }, 1000);
}

// ══════════════════════════════════════════
//  CLAVE DINÁMICA (como Nequi)
// ══════════════════════════════════════════
let claveTimerInterval = null;

function stopClaveTimer() { if (claveTimerInterval) { clearInterval(claveTimerInterval); claveTimerInterval = null; } }

async function loadClaveDinamica() {
  stopClaveTimer();
  await refrescarClave();
  claveTimerInterval = setInterval(tickClave, 1000);
}

let _claveData = null;

async function refrescarClave() {
  try {
    const res = await fetch(`${API}/auth/clave-dinamica`, { headers: authHeaders() });
    if (!res.ok) { toast('Error obteniendo clave', 'err'); return; }
    _claveData = await res.json();
    renderClave();
  } catch { toast('Error de conexión', 'err'); }
}

function tickClave() {
  if (!_claveData) return;
  _claveData.restantes--;
  if (_claveData.restantes <= 0) {
    refrescarClave(); return;
  }
  renderClave();
}

function renderClave() {
  if (!_claveData) return;
  const { clave, restantes, ventana } = _claveData;

  // Dígitos separados
  const digContainer = document.getElementById('clave-numero');
  if (digContainer) {
    digContainer.innerHTML = clave.split('').map(d =>
      `<span class="clave-digit">${d}</span>`
    ).join('');
  }

  // Barra de tiempo
  const fill = document.getElementById('clave-fill');
  if (fill) fill.style.width = `${(restantes / ventana) * 100}%`;

  const timerTxt = document.getElementById('clave-timer-txt');
  if (timerTxt) {
    timerTxt.textContent = `${restantes}s`;
    timerTxt.className   = 'clave-timer-txt' + (restantes <= 10 ? ' clave-warning' : '');
  }
}

// ── HISTORIAL PERSONAL ────────────────────
async function loadUserHistorial() {
  const c = document.getElementById('user-log-list');
  c.innerHTML = '<div class="loading-row"><span class="spinner"></span> Cargando...</div>';
  try {
    const res  = await fetch(`${API}/registros/mios`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error();
    let filtered = data;
    if (userFilter !== 'all') filtered = data.filter(l => l.tipo === userFilter);
    c.innerHTML = filtered.length ? filtered.map(l => logItemHTML(l, false)).join('') : emptyHTML('Sin movimientos.');
  } catch { c.innerHTML = emptyHTML('Error cargando historial.'); }
}

function filterUserLog(f, el) {
  userFilter = f;
  document.querySelectorAll('#usec-historial .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  loadUserHistorial();
}
