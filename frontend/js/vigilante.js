// frontend/js/vigilante.js — Vigilante + Admin v3.0

let guardScanner        = null;
let guardScannerRunning = false;
let guardFilter         = 'all';
let guardModo           = 'qr'; // 'qr' o 'clave'

// ══════════════════════════════════════════
//  DASHBOARD VIGILANTE
// ══════════════════════════════════════════
function openGuardDash() {
  showPage('page-guard');
  const s = getSession();
  document.getElementById('guard-dname').textContent = s.user.nombre.split(' ')[0];
  guardTab('scan', document.getElementById('gnav-scan'));
}

function guardTab(sec, el) {
  document.querySelectorAll('#page-guard .dash-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#page-guard .nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('gsec-' + sec).classList.add('active');
  el.classList.add('active');
  if (sec !== 'scan') stopGuardScanner();
  if (sec === 'scan')      loadGuardStats();
  if (sec === 'historial') loadGuardHistorial();
}

async function loadGuardStats() {
  try {
    const res  = await fetch(`${API}/registros/stats`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    document.getElementById('g-stat-entry').textContent = data.entradas || 0;
    document.getElementById('g-stat-exit').textContent  = data.salidas  || 0;
    document.getElementById('g-stat-total').textContent = data.total    || 0;
  } catch { /* silencioso */ }
}

// ── Cambiar modo escaneo ──────────────────
function setGuardModo(modo, btn) {
  guardModo = modo;
  document.querySelectorAll('.modo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('guard-qr-panel').style.display   = modo === 'qr'    ? 'block' : 'none';
  document.getElementById('guard-clave-panel').style.display = modo === 'clave' ? 'block' : 'none';
  if (modo !== 'qr') stopGuardScanner();
}

// ── ESCÁNER QR ────────────────────────────
function startGuardScanner() {
  document.getElementById('guard-scanner-idle').style.display   = 'none';
  document.getElementById('guard-scanner-active').style.display = 'block';
  document.getElementById('guard-scan-result').style.display    = 'none';

  guardScanner = new Html5Qrcode('guard-qr-reader');
  guardScanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 210, height: 210 }, aspectRatio: 1 },
    onGuardScan, () => {}
  ).then(() => { guardScannerRunning = true; })
  .catch(() => { toast('No se pudo acceder a la cámara', 'err'); stopGuardScanner(); });
}

function stopGuardScanner() {
  if (guardScanner && guardScannerRunning) {
    guardScanner.stop().then(() => { guardScanner.clear(); guardScannerRunning = false; }).catch(() => {});
  }
  const idle   = document.getElementById('guard-scanner-idle');
  const active = document.getElementById('guard-scanner-active');
  if (idle)   idle.style.display   = 'block';
  if (active) active.style.display = 'none';
}

function onGuardScan(text) {
  stopGuardScanner();
  try {
    const d = JSON.parse(text);
    if (!d.n || !d.es) throw new Error();
    showGuardScanResult(d);
  } catch {
    toast('QR no válido para SENA TECH', 'err');
    setTimeout(() => { const i = document.getElementById('guard-scanner-idle'); if(i) i.style.display='block'; }, 1500);
  }
}

async function showGuardScanResult(d) {
  const colorMap = {'Plata':'#b0b8c8','Negro':'#1a1a2e','Blanco':'#f0f0f0','Gris':'#607080',
    'Azul':'#1d4ed8','Rojo':'#b91c1c','Dorado':'#b7860b','Verde':'#15803d'};
  const dot  = colorMap[d.ec] || '#888';
  // Determinar tipo
  let tipo = 'entrada';
  try {
    const r = await fetch(`${API}/registros/todos?buscar=${encodeURIComponent(d.es)}&limite=1`, { headers: authHeaders() });
    const items = await r.json();
    if (items.length) tipo = items[0].tipo === 'salida' ? 'entrada' : 'salida';
  } catch { /* default entrada */ }

  const area = document.getElementById('guard-scan-result');
  area.style.display = 'block';
  area.innerHTML = `
    <div class="scan-result ${tipo==='salida'?'exit-res':''}">
      <div class="scan-type-badge ${tipo}">${tipo==='entrada'?'🟢':'🔴'} ${tipo.toUpperCase()} DETECTADA</div>
      <div class="res-row"><span class="res-key">Nombre</span>  <span class="res-val">${d.n}</span></div>
      <div class="res-row"><span class="res-key">Cédula</span>  <span class="res-val">${d.c}</span></div>
      <div class="res-row"><span class="res-key">Rol</span>     <span class="res-val">${d.r}</span></div>
      <div class="res-row"><span class="res-key">Equipo</span>  <span class="res-val">${d.en}</span></div>
      <div class="res-row"><span class="res-key">Tipo</span>    <span class="res-val">${d.et}</span></div>
      <div class="res-row"><span class="res-key">Serial</span>  <span class="res-val">${d.es}</span></div>
      <div class="res-row"><span class="res-key">Marca</span>   <span class="res-val">${d.em||'—'}</span></div>
      <div class="res-row"><span class="res-key">Color</span>   <span class="res-val">
        <span class="color-dot" style="background:${dot}"></span>${d.ec}</span></div>
      <div class="res-row"><span class="res-key">Hora</span>    <span class="res-val">${formatTime(new Date())}</span></div>
      <div class="confirm-row">
        <button class="btn btn-ghost" onclick="cancelGuardScan()">Cancelar</button>
        <button class="btn ${tipo==='entrada'?'btn-green':'btn-red'}"
          onclick='confirmarQR(${JSON.stringify(d).replace(/'/g,"&apos;")}, "${tipo}", this)'>
          ✓ Confirmar ${tipo==='entrada'?'Entrada':'Salida'}
        </button>
      </div>
    </div>`;
}

async function confirmarQR(d, tipo, btn) {
  btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;
  try {
    const res  = await fetch(`${API}/registros/escanear`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ cedula_usuario: d.c, serial_equipo: d.es })
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error||'Error', 'err'); btn.innerHTML=`✓ Confirmar`; btn.disabled=false; return; }
    mostrarExitoEscaneo(d.n, d.en, d.es, data.tipo);
    loadGuardStats();
  } catch { toast('Error de conexión', 'err'); btn.innerHTML=`✓ Confirmar`; btn.disabled=false; }
}

// ── VERIFICAR POR CLAVE DINÁMICA ──────────
async function verificarClave() {
  const cedula = document.getElementById('gc-cedula').value.trim();
  const serial = document.getElementById('gc-serial').value.trim();
  const clave  = document.getElementById('gc-clave').value.trim();

  if (!cedula || !serial || !clave) { toast('Completa todos los campos', 'err'); return; }

  const btn  = document.getElementById('btn-verificar-clave');
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;

  try {
    const res  = await fetch(`${API}/registros/clave`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ cedula_usuario: cedula, serial_equipo: serial, clave })
    });
    const data = await res.json();

    if (!res.ok) { toast(data.error || 'Clave inválida', 'err'); return; }

    // Limpiar campos
    document.getElementById('gc-cedula').value = '';
    document.getElementById('gc-serial').value = '';
    document.getElementById('gc-clave').value  = '';

    mostrarExitoEscaneo(data.usuario.nombre, data.equipo.nombre, data.equipo.serial, data.tipo, 'clave');
    loadGuardStats();
  } catch { toast('Error de conexión', 'err'); }
  finally { btn.innerHTML = orig; btn.disabled = false; }
}

function mostrarExitoEscaneo(nombre, equipoNombre, serial, tipo, metodo = 'qr') {
  const area = document.getElementById('guard-scan-result');
  if (!area) return;
  area.style.display = 'block';
  // Ocultar panel de clave si está activo
  const cp = document.getElementById('guard-clave-panel');
  if (cp) cp.style.display = 'none';

  area.innerHTML = `
    <div style="text-align:center;padding:26px 18px">
      <div style="font-size:3rem;margin-bottom:12px">${tipo==='entrada'?'✅':'🔴'}</div>
      <div style="font-family:var(--head);font-size:.82rem;letter-spacing:2px;
        color:${tipo==='entrada'?'var(--green)':'var(--red)'};margin-bottom:8px">
        ${tipo==='entrada'?'ENTRADA REGISTRADA':'SALIDA REGISTRADA'}
      </div>
      <div style="font-size:.75rem;color:var(--muted);margin-bottom:3px">${nombre}</div>
      <div style="font-size:.7rem;color:var(--muted)">${equipoNombre} · ${serial}</div>
      <div style="font-size:.62rem;color:var(--muted);margin-top:3px">${formatTime(new Date())} · via ${metodo.toUpperCase()}</div>
      <br>
      <button class="btn btn-purple" onclick="resetGuardScan()">Escanear otro ↺</button>
    </div>`;
  toast(tipo==='entrada'?'✅ Entrada confirmada':'🔴 Salida confirmada', 'ok');
}

function cancelGuardScan() {
  document.getElementById('guard-scan-result').style.display    = 'none';
  document.getElementById('guard-scanner-idle').style.display   = 'block';
}
function resetGuardScan() {
  document.getElementById('guard-scan-result').style.display = 'none';
  const cp = document.getElementById('guard-clave-panel');
  if (cp && guardModo === 'clave') cp.style.display = 'block';
  else document.getElementById('guard-scanner-idle').style.display = 'block';
}

// ── HISTORIAL ─────────────────────────────
async function loadGuardHistorial() {
  const c = document.getElementById('guard-log-list');
  c.innerHTML = '<div class="loading-row"><span class="spinner"></span> Cargando...</div>';
  const buscar = document.getElementById('g-search')?.value || '';
  const params = new URLSearchParams({ limite: 300 });
  if (guardFilter !== 'all' && guardFilter !== 'hoy') params.set('tipo', guardFilter);
  if (guardFilter === 'hoy') params.set('fecha', 'hoy');
  if (buscar) params.set('buscar', buscar);
  try {
    const res  = await fetch(`${API}/registros/todos?${params}`, { headers: authHeaders() });
    const data = await res.json();
    c.innerHTML = data.length ? data.map(l => `
      <div class="log-item">
        <div class="log-icon ${l.tipo}">${l.tipo==='entrada'?'🟢':'🔴'}</div>
        <div class="log-body">
          <div class="log-name">${l.nombre_usuario}
            <span class="metodo-badge ${l.metodo||'qr'}">${(l.metodo||'qr')==='qr'?'QR':'🔑'}</span>
          </div>
          <div class="log-sub">${l.equipo_nombre} · ${l.serial} · ${l.color}</div>
        </div>
        <div class="log-time">
          <div class="lt">${formatTime(new Date(l.timestamp))}</div>
          <div class="ld">${formatDate(new Date(l.timestamp))}</div>
        </div>
      </div>`).join('') : emptyHTML('Sin registros.');
  } catch { c.innerHTML = emptyHTML('Error cargando historial.'); }
}

function filterGuardLog(f, el) {
  guardFilter = f;
  document.querySelectorAll('#gsec-historial .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  loadGuardHistorial();
}

// ── EXPORTAR ──────────────────────────────
async function exportCSV() {
  try {
    const res  = await fetch(`${API}/registros/todos?limite=9999`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.length) { toast('Sin datos para exportar', 'err'); return; }
    const header = ['Tipo','Método','Nombre','Cédula','Rol','Equipo','Tipo Eq','Serial','Marca','Color','Fecha','Hora','Vigilante'];
    const rows   = data.map(l => [l.tipo,l.metodo||'qr',l.nombre_usuario,l.cedula,l.rol,l.equipo_nombre,l.equipo_tipo,l.serial,l.marca||'',l.color,
      formatDate(new Date(l.timestamp)),formatTime(new Date(l.timestamp)),l.vigilante||'']);
    const csv = [header,...rows].map(r=>r.map(v=>`"${(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
    a.download = `SENATECH_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast('📊 CSV descargado', 'ok');
  } catch { toast('Error exportando', 'err'); }
}

async function exportDayReport() {
  try {
    const res  = await fetch(`${API}/registros/todos?fecha=hoy&limite=9999`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.length) { toast('Sin registros hoy', 'err'); return; }
    const rows = data.map(l => `<tr>
      <td>${formatTime(new Date(l.timestamp))}</td>
      <td style="color:${l.tipo==='entrada'?'green':'red'};font-weight:bold">${l.tipo.toUpperCase()}</td>
      <td>${l.metodo||'qr'}</td><td>${l.nombre_usuario}</td><td>${l.cedula}</td>
      <td>${l.equipo_nombre}</td><td>${l.serial}</td><td>${l.color}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte ${new Date().toLocaleDateString('es-CO')}</title>
      <style>body{font-family:Arial,sans-serif;padding:28px}h1{color:#0a3d62}
      table{width:100%;border-collapse:collapse}th{background:#0a3d62;color:#fff;padding:9px;text-align:left}
      td{padding:7px;border-bottom:1px solid #eee}tr:nth-child(even){background:#f9f9f9}</style></head>
      <body><h1>SENA TECH — Reporte del Día</h1>
      <p>Fecha: <strong>${new Date().toLocaleDateString('es-CO')}</strong> | Total: <strong>${data.length}</strong></p>
      <table><thead><tr><th>Hora</th><th>Tipo</th><th>Método</th><th>Nombre</th><th>Cédula</th><th>Equipo</th><th>Serial</th><th>Color</th></tr></thead>
      <tbody>${rows}</tbody></table><p style="margin-top:18px;font-size:.8em;color:#888">© 2026 SENA TECH</p></body></html>`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html],{type:'text/html'}));
    a.download = `Reporte_SENATECH_${new Date().toISOString().slice(0,10)}.html`;
    a.click();
    toast('🖨️ Reporte generado', 'ok');
  } catch { toast('Error generando reporte', 'err'); }
}

async function clearAll() {
  if (!confirm('¿Eliminar TODO el historial?')) return;
  try {
    const res = await fetch(`${API}/registros/limpiar`,{method:'DELETE',headers:authHeaders()});
    if (!res.ok){toast('Error al limpiar','err');return;}
    loadGuardHistorial(); loadGuardStats(); toast('🗑 Historial eliminado','info');
  } catch { toast('Error de conexión','err'); }
}

// ══════════════════════════════════════════
//  DASHBOARD ADMIN
// ══════════════════════════════════════════
function openAdminDash() {
  showPage('page-admin');
  const s = getSession();
  document.getElementById('admin-dname').textContent = s.user.nombre.split(' ')[0];
  adminTab('pendientes', document.getElementById('anav-pend'));
}

function adminTab(sec, el) {
  document.querySelectorAll('#page-admin .dash-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#page-admin .nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('asec-' + sec).classList.add('active');
  el.classList.add('active');
  if (sec === 'pendientes') loadPendientes();
  if (sec === 'vigilantes') loadVigilantes();
  if (sec === 'historial')  loadAdminHistorial();
}

async function loadPendientes() {
  const c = document.getElementById('admin-pendientes-list');
  c.innerHTML = '<div class="loading-row"><span class="spinner"></span></div>';
  try {
    const res  = await fetch(`${API}/auth/admin/vigilantes-pendientes`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.length) { c.innerHTML = '<div class="empty"><div class="empty-icon">✅</div><p>Sin solicitudes pendientes.</p></div>'; return; }
    c.innerHTML = data.map(v => `
      <div class="pending-card" id="pcard-${v.id}">
        <div class="pending-avatar">${v.nombre.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()}</div>
        <div class="pending-info">
          <div class="pending-name">${v.nombre}</div>
          <div class="pending-sub">Cédula: ${v.cedula} · ${formatDate(new Date(v.creado_en))}</div>
        </div>
        <div class="pending-actions">
          <button class="btn btn-green btn-sm" onclick="aprobarVigilante(${v.id})">✓ Aprobar</button>
          <button class="btn btn-red   btn-sm" onclick="rechazarVigilante(${v.id})">✕</button>
        </div>
      </div>`).join('');
  } catch { c.innerHTML = emptyHTML('Error cargando pendientes.'); }
}

async function aprobarVigilante(id) {
  try {
    const res = await fetch(`${API}/auth/admin/aprobar/${id}`,{method:'POST',headers:authHeaders()});
    if (!res.ok){toast('Error aprobando','err');return;}
    toast('✅ Vigilante aprobado','ok');
    loadPendientes();
  } catch { toast('Error de conexión','err'); }
}

async function rechazarVigilante(id) {
  if (!confirm('¿Bloquear esta solicitud?')) return;
  try {
    const res = await fetch(`${API}/auth/admin/bloquear/${id}`,{method:'POST',headers:authHeaders()});
    if (!res.ok){toast('Error bloqueando','err');return;}
    toast('🚫 Solicitud rechazada','info');
    loadPendientes();
  } catch { toast('Error de conexión','err'); }
}

async function loadVigilantes() {
  const c = document.getElementById('admin-vigilantes-list');
  c.innerHTML = '<div class="loading-row"><span class="spinner"></span></div>';
  try {
    const res  = await fetch(`${API}/auth/admin/vigilantes`, { headers: authHeaders() });
    const data = await res.json();
    c.innerHTML = data.length ? data.map(v => `
      <div class="log-item">
        <div class="log-icon" style="background:${v.estado==='activo'?'rgba(0,230,118,.1)':v.estado==='pendiente'?'rgba(255,214,0,.1)':'rgba(255,23,68,.1)'}">
          ${v.estado==='activo'?'🟢':v.estado==='pendiente'?'🟡':'🔴'}
        </div>
        <div class="log-body">
          <div class="log-name">${v.nombre}</div>
          <div class="log-sub">Cédula: ${v.cedula} · Estado: <strong style="color:${v.estado==='activo'?'var(--green)':v.estado==='pendiente'?'var(--yellow)':'var(--red)'}">${v.estado}</strong></div>
        </div>
        <div>
          ${v.estado==='activo'?`<button class="btn btn-red btn-sm" onclick="rechazarVigilante(${v.id})">Bloquear</button>`:
            v.estado==='pendiente'?`<button class="btn btn-green btn-sm" onclick="aprobarVigilante(${v.id})">Aprobar</button>`:''}
        </div>
      </div>`).join('') : emptyHTML('Sin vigilantes registrados.');
  } catch { c.innerHTML = emptyHTML('Error.'); }
}

async function loadAdminHistorial() {
  const c = document.getElementById('admin-log-list');
  c.innerHTML = '<div class="loading-row"><span class="spinner"></span></div>';
  try {
    const res  = await fetch(`${API}/registros/todos?limite=200`, { headers: authHeaders() });
    const data = await res.json();
    c.innerHTML = data.length ? data.map(l => `
      <div class="log-item">
        <div class="log-icon ${l.tipo}">${l.tipo==='entrada'?'🟢':'🔴'}</div>
        <div class="log-body">
          <div class="log-name">${l.nombre_usuario} <span class="metodo-badge ${l.metodo||'qr'}">${(l.metodo||'qr')==='qr'?'QR':'🔑'}</span></div>
          <div class="log-sub">${l.equipo_nombre} · ${l.serial}</div>
        </div>
        <div class="log-time">
          <div class="lt">${formatTime(new Date(l.timestamp))}</div>
          <div class="ld">${formatDate(new Date(l.timestamp))}</div>
        </div>
      </div>`).join('') : emptyHTML('Sin registros.');
  } catch { c.innerHTML = emptyHTML('Error.'); }
}
