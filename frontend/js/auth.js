// frontend/js/auth.js

function getSession() { const s = localStorage.getItem('st_s'); return s ? JSON.parse(s) : null; }
function setSession(d) { localStorage.setItem('st_s', JSON.stringify(d)); }
function clearSession() { localStorage.removeItem('st_s'); }
function getToken() { const s = getSession(); return s ? s.token : null; }
function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}

let loginRoleMode = 'user';

// ── Selector de rol ───────────────────────
function selectLoginRole(mode, el) {
  loginRoleMode = mode;
  document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const btn = document.getElementById('btn-ingresar');
  if (mode === 'guard') {
    btn.className = 'btn-login guard-btn';
    document.getElementById('login-user').placeholder = 'Cédula del vigilante';
  } else if (mode === 'admin') {
    btn.className = 'btn-login admin-btn';
    document.getElementById('login-user').placeholder = 'Usuario administrador';
  } else {
    btn.className = 'btn-login user-btn';
    document.getElementById('login-user').placeholder = 'Ingresa tu cédula';
  }
}

// ── LOGIN ─────────────────────────────────
async function doLogin() {
  const cedula   = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  if (!cedula || !password) { toast('Completa usuario y contraseña', 'err'); return; }

  const btn = document.getElementById('btn-ingresar');
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;

  try {
    const res  = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cedula, password })
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Error al ingresar', 'err'); return; }

    // Validar rol correcto
    if (loginRoleMode === 'guard' && data.user.tipo !== 'guard' && data.user.tipo !== 'admin') {
      toast('Esa cuenta no es de vigilante', 'err'); return;
    }
    if (loginRoleMode === 'admin' && data.user.tipo !== 'admin') {
      toast('Esa cuenta no es administrador', 'err'); return;
    }
    if (loginRoleMode === 'user' && data.user.tipo !== 'user') {
      toast('Usa la pestaña correcta de acceso', 'err'); return;
    }

    setSession(data);
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';

    if (data.user.tipo === 'admin')       openAdminDash();
    else if (data.user.tipo === 'guard')  openGuardDash();
    else                                   openUserDash();

  } catch { toast('No se pudo conectar al servidor', 'err'); }
  finally { btn.innerHTML = orig; btn.disabled = false; }
}

// ── LOGOUT ────────────────────────────────
function logout() {
  clearSession();
  stopGuardScanner();
  stopClaveTimer();
  showPage('page-login');
  toast('Sesión cerrada', 'info');
}

// ── CREAR CUENTA USUARIO ──────────────────
function showRegisterModal() {
  document.getElementById('modal-registro').classList.add('active');
}
function hideModal(id = 'modal-registro') {
  document.getElementById(id).classList.remove('active');
}

async function registerNewUser() {
  const nombre       = document.getElementById('reg-name').value.trim();
  const cedula       = document.getElementById('reg-cedula').value.trim();
  const rol          = document.getElementById('reg-rol').value;
  const password     = document.getElementById('reg-pass').value;
  const pregunta_seg = document.getElementById('reg-pregunta').value;
  const respuesta_seg= document.getElementById('reg-respuesta').value.trim();

  if (!nombre || !cedula || !password || !respuesta_seg) { toast('Completa todos los campos', 'err'); return; }
  if (password.length < 4)   { toast('Contraseña mínimo 4 caracteres', 'err'); return; }

  const btn = document.getElementById('btn-crear-cuenta');
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;

  try {
    const res  = await fetch(`${API}/auth/registro`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cedula, nombre, rol, password, pregunta_seg, respuesta_seg })
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Error al registrar', 'err'); return; }
    hideModal();
    toast('✅ Cuenta creada. Ingresa con tu cédula', 'ok');
    document.getElementById('login-user').value = cedula;
  } catch { toast('Error de conexión', 'err'); }
  finally { btn.innerHTML = orig; btn.disabled = false; }
}

// ── REGISTRO VIGILANTE ────────────────────
function showRegistroVigilanteModal() {
  document.getElementById('modal-reg-vigilante').classList.add('active');
}

async function registerVigilante() {
  const nombre        = document.getElementById('rv-name').value.trim();
  const cedula        = document.getElementById('rv-cedula').value.trim();
  const password      = document.getElementById('rv-pass').value;
  const pregunta_seg  = document.getElementById('rv-pregunta').value;
  const respuesta_seg = document.getElementById('rv-respuesta').value.trim();

  if (!nombre || !cedula || !password || !respuesta_seg) { toast('Completa todos los campos', 'err'); return; }
  if (password.length < 4) { toast('Contraseña mínimo 4 caracteres', 'err'); return; }

  const btn = document.getElementById('btn-reg-vigilante');
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;

  try {
    const res  = await fetch(`${API}/auth/registro-vigilante`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cedula, nombre, password, pregunta_seg, respuesta_seg })
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Error al registrar', 'err'); return; }
    hideModal('modal-reg-vigilante');
    toast('✅ Solicitud enviada. Espera aprobación del admin', 'ok');
  } catch { toast('Error de conexión', 'err'); }
  finally { btn.innerHTML = orig; btn.disabled = false; }
}

// ══════════════════════════════════════════
//  RECUPERAR CONTRASEÑA — 3 pasos
// ══════════════════════════════════════════
let _recCedula = '';

function showRecuperarModal() {
  document.getElementById('modal-recuperar').classList.add('active');
  mostrarPasoRecuperar(1);
}

function mostrarPasoRecuperar(paso) {
  ['rec-paso1','rec-paso2','rec-paso3'].forEach((id,i) => {
    document.getElementById(id).style.display = (i + 1 === paso) ? 'block' : 'none';
  });
  document.querySelectorAll('.step-dot').forEach((d, i) => {
    d.classList.toggle('active', i + 1 === paso);
    d.classList.toggle('done',   i + 1 < paso);
  });
}

async function recPaso1() {
  const cedula = document.getElementById('rec-cedula').value.trim();
  if (!cedula) { toast('Ingresa tu cédula', 'err'); return; }

  const btn = document.getElementById('btn-rec-p1');
  btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;

  try {
    const res  = await fetch(`${API}/auth/recuperar/pregunta`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cedula })
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error, 'err'); return; }
    _recCedula = cedula;
    document.getElementById('rec-pregunta-txt').textContent = data.pregunta;
    mostrarPasoRecuperar(2);
  } catch { toast('Error de conexión', 'err'); }
  finally { btn.innerHTML = 'Continuar →'; btn.disabled = false; }
}

async function recPaso2() {
  const respuesta      = document.getElementById('rec-respuesta').value.trim();
  const nueva_password = document.getElementById('rec-nueva-pass').value;
  const confirmar      = document.getElementById('rec-confirmar-pass').value;

  if (!respuesta || !nueva_password) { toast('Completa todos los campos', 'err'); return; }
  if (nueva_password !== confirmar)   { toast('Las contraseñas no coinciden', 'err'); return; }
  if (nueva_password.length < 4)      { toast('Mínimo 4 caracteres', 'err'); return; }

  const btn = document.getElementById('btn-rec-p2');
  btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;

  try {
    const res  = await fetch(`${API}/auth/recuperar/reset`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cedula: _recCedula, respuesta, nueva_password })
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error, 'err'); return; }
    mostrarPasoRecuperar(3);
  } catch { toast('Error de conexión', 'err'); }
  finally { btn.innerHTML = 'Cambiar contraseña'; btn.disabled = false; }
}

function cerrarRecuperar() {
  hideModal('modal-recuperar');
  document.getElementById('rec-cedula').value       = '';
  document.getElementById('rec-respuesta').value    = '';
  document.getElementById('rec-nueva-pass').value   = '';
  document.getElementById('rec-confirmar-pass').value = '';
  _recCedula = '';
}

// ── Verificar sesión al cargar ────────────
function checkSession() {
  const s = getSession();
  if (!s) return;
  if (s.user.tipo === 'admin')      openAdminDash();
  else if (s.user.tipo === 'guard') openGuardDash();
  else                               openUserDash();
}
