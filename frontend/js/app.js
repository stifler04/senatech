// frontend/js/app.js — utilidades globales SENA TECH v3.0

// ── Detectar IP del servidor automáticamente ──
// Si estamos en localhost → usar localhost; si estamos en IP de red → usar esa IP
const API = `${window.location.protocol}//${window.location.hostname}:${window.location.port || 3000}/api`;

// ── Páginas ───────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Formato fecha/hora ────────────────────
function formatTime(d) { return d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' }); }
function formatDate(d) { return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'2-digit' }); }

// ── HTML de ítem de log ───────────────────
function logItemHTML(l, showUser = false) {
  const nombre = showUser ? (l.nombre_usuario || l.nombre) : (l.equipo_nombre || l.equipoNombre);
  const sub    = showUser ? `${l.equipo_nombre || l.equipoNombre} · ${l.serial}` : `${l.serial} · ${l.color}`;
  const metodo = l.metodo ? `<span class="metodo-badge ${l.metodo}">${l.metodo === 'qr' ? 'QR' : '🔑'}</span>` : '';
  return `
    <div class="log-item">
      <div class="log-icon ${l.tipo}">${l.tipo === 'entrada' ? '🟢' : '🔴'}</div>
      <div class="log-body">
        <div class="log-name">${nombre}${metodo}</div>
        <div class="log-sub">${sub}</div>
      </div>
      <div class="log-time">
        <div class="lt">${formatTime(new Date(l.timestamp))}</div>
        <div class="ld">${formatDate(new Date(l.timestamp))}</div>
      </div>
    </div>`;
}

function emptyHTML(msg) {
  return `<div class="empty"><div class="empty-icon">📋</div><p>${msg}</p></div>`;
}

// ── Toast ─────────────────────────────────
function toast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 3500);
}

// ── QR Generator (doble fallback) ─────────
function generarQR(texto, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (typeof QRCode !== 'undefined') {
    try {
      new QRCode(container, {
        text: texto, width: 190, height: 190,
        colorDark: '#000000', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
      return;
    } catch(e) { /* fallback */ }
  }
  // Fallback: API externa
  const img = document.createElement('img');
  img.src   = `https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(texto)}&bgcolor=ffffff&color=000000`;
  img.alt   = 'Código QR';
  img.style.cssText = 'width:190px;height:190px;border-radius:8px;display:block';
  img.onerror = () => {
    container.innerHTML = `<div style="text-align:center;padding:16px;color:var(--muted);font-size:.72rem">
      ⚠️ Sin conexión para generar QR<br>
      <button class="btn btn-cyan btn-sm" style="margin-top:10px" onclick="generarQR(${JSON.stringify(texto)}, '${containerId}')">
        Reintentar
      </button></div>`;
  };
  container.appendChild(img);
}

// ── Enter en login ────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const p = document.getElementById('login-pass');
  if (p) p.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  checkSession();
});
