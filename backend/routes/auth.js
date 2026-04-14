// backend/routes/auth.js
require('dotenv').config();
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');
const { claveActual } = require('../utils/claveDinamica');

// ── Middleware auth ───────────────────────
function auth(req, res, next) {
  const h = req.headers['authorization'];
  if (!h) return res.status(401).json({ error: 'Token requerido' });
  try { req.user = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token inválido' }); }
}
function soloAdmin(req, res, next) {
  if (req.user.tipo !== 'admin') return res.status(403).json({ error: 'Solo el administrador' });
  next();
}

// ══════════════════════════════════════════
//  REGISTRO DE USUARIO NORMAL
// ══════════════════════════════════════════
router.post('/registro', async (req, res) => {
  const { cedula, nombre, rol, password, pregunta_seg, respuesta_seg } = req.body;

  if (!cedula || !nombre || !password)
    return res.status(400).json({ error: 'Cédula, nombre y contraseña son requeridos' });
  if (password.length < 4)
    return res.status(400).json({ error: 'Contraseña mínimo 4 caracteres' });
  if (!pregunta_seg || !respuesta_seg)
    return res.status(400).json({ error: 'Debes elegir una pregunta de seguridad y su respuesta' });

  try {
    const [existe] = await db.query('SELECT id FROM usuarios WHERE cedula=?', [cedula]);
    if (existe.length) return res.status(409).json({ error: 'Esa cédula ya está registrada' });

    const hashPass = await bcrypt.hash(password, 10);
    const hashResp = await bcrypt.hash(respuesta_seg.toLowerCase().trim(), 10);

    await db.query(
      'INSERT INTO usuarios (cedula,nombre,rol,tipo,password,pregunta_seg,respuesta_seg,estado) VALUES (?,?,?,"user",?,?,?,"activo")',
      [cedula, nombre, rol || 'Aprendiz', hashPass, pregunta_seg, hashResp]
    );
    res.status(201).json({ message: 'Cuenta creada exitosamente' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ══════════════════════════════════════════
//  REGISTRO DE VIGILANTE (queda pendiente)
// ══════════════════════════════════════════
router.post('/registro-vigilante', async (req, res) => {
  const { cedula, nombre, password, pregunta_seg, respuesta_seg } = req.body;

  if (!cedula || !nombre || !password)
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  if (password.length < 4)
    return res.status(400).json({ error: 'Contraseña mínimo 4 caracteres' });
  if (!pregunta_seg || !respuesta_seg)
    return res.status(400).json({ error: 'Debes elegir pregunta y respuesta de seguridad' });

  try {
    const [existe] = await db.query('SELECT id FROM usuarios WHERE cedula=?', [cedula]);
    if (existe.length) return res.status(409).json({ error: 'Esa cédula ya está registrada' });

    const hashPass = await bcrypt.hash(password, 10);
    const hashResp = await bcrypt.hash(respuesta_seg.toLowerCase().trim(), 10);

    await db.query(
      'INSERT INTO usuarios (cedula,nombre,rol,tipo,password,pregunta_seg,respuesta_seg,estado) VALUES (?,?,"Vigilante","guard",?,?,?,"pendiente")',
      [cedula, nombre, hashPass, pregunta_seg, hashResp]
    );
    res.status(201).json({ message: 'Solicitud enviada. Espera aprobación del administrador.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ══════════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════════
router.post('/login', async (req, res) => {
  const { cedula, password } = req.body;
  if (!cedula || !password)
    return res.status(400).json({ error: 'Cédula y contraseña requeridas' });

  try {
    const [rows] = await db.query('SELECT * FROM usuarios WHERE cedula=?', [cedula]);
    if (!rows.length) return res.status(401).json({ error: 'Usuario no encontrado' });

    const u = rows[0];

    if (u.estado === 'pendiente')
      return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación por el administrador.' });
    if (u.estado === 'bloqueado')
      return res.status(403).json({ error: 'Tu cuenta ha sido bloqueada. Contacta al administrador.' });

    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return res.status(401).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign(
      { id: u.id, cedula: u.cedula, nombre: u.nombre, rol: u.rol, tipo: u.tipo },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || '8h' }
    );
    res.json({ token, user: { id: u.id, cedula: u.cedula, nombre: u.nombre, rol: u.rol, tipo: u.tipo } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ══════════════════════════════════════════
//  RECUPERAR CONTRASEÑA
// ══════════════════════════════════════════

// Paso 1: obtener la pregunta de seguridad
router.post('/recuperar/pregunta', async (req, res) => {
  const { cedula } = req.body;
  if (!cedula) return res.status(400).json({ error: 'Ingresa tu cédula' });
  try {
    const [rows] = await db.query('SELECT pregunta_seg FROM usuarios WHERE cedula=? AND estado="activo"', [cedula]);
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!rows[0].pregunta_seg) return res.status(400).json({ error: 'Esta cuenta no tiene pregunta de seguridad. Contacta al administrador.' });
    res.json({ pregunta: rows[0].pregunta_seg });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// Paso 2: validar respuesta y cambiar contraseña
router.post('/recuperar/reset', async (req, res) => {
  const { cedula, respuesta, nueva_password } = req.body;
  if (!cedula || !respuesta || !nueva_password)
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  if (nueva_password.length < 4)
    return res.status(400).json({ error: 'Contraseña mínimo 4 caracteres' });

  try {
    const [rows] = await db.query('SELECT respuesta_seg FROM usuarios WHERE cedula=? AND estado="activo"', [cedula]);
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });

    const ok = await bcrypt.compare(respuesta.toLowerCase().trim(), rows[0].respuesta_seg);
    if (!ok) return res.status(401).json({ error: 'Respuesta incorrecta' });

    const hash = await bcrypt.hash(nueva_password, 10);
    await db.query('UPDATE usuarios SET password=? WHERE cedula=?', [hash, cedula]);
    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ══════════════════════════════════════════
//  CLAVE DINÁMICA — obtener clave actual
// ══════════════════════════════════════════
router.get('/clave-dinamica', auth, (req, res) => {
  if (req.user.tipo !== 'user')
    return res.status(403).json({ error: 'Solo usuarios pueden obtener clave dinámica' });
  const { clave, restantes, ventana } = claveActual(req.user.cedula);
  res.json({ clave, restantes, ventana });
});

// ══════════════════════════════════════════
//  ADMIN — gestión de vigilantes
// ══════════════════════════════════════════

// GET vigilantes pendientes
router.get('/admin/vigilantes-pendientes', auth, soloAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, cedula, nombre, creado_en FROM usuarios WHERE tipo="guard" AND estado="pendiente" ORDER BY creado_en DESC'
    );
    res.json(rows);
  } catch { res.status(500).json({ error: 'Error obteniendo pendientes' }); }
});

// GET todos los vigilantes
router.get('/admin/vigilantes', auth, soloAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, cedula, nombre, estado, creado_en FROM usuarios WHERE tipo="guard" ORDER BY creado_en DESC'
    );
    res.json(rows);
  } catch { res.status(500).json({ error: 'Error obteniendo vigilantes' }); }
});

// POST aprobar vigilante
router.post('/admin/aprobar/:id', auth, soloAdmin, async (req, res) => {
  try {
    await db.query('UPDATE usuarios SET estado="activo" WHERE id=? AND tipo="guard"', [req.params.id]);
    res.json({ message: 'Vigilante aprobado' });
  } catch { res.status(500).json({ error: 'Error aprobando' }); }
});

// POST rechazar/bloquear vigilante
router.post('/admin/bloquear/:id', auth, soloAdmin, async (req, res) => {
  try {
    await db.query('UPDATE usuarios SET estado="bloqueado" WHERE id=? AND tipo IN ("guard","user")', [req.params.id]);
    res.json({ message: 'Usuario bloqueado' });
  } catch { res.status(500).json({ error: 'Error bloqueando' }); }
});

// POST resetear contraseña de un usuario (admin)
router.post('/admin/reset-password/:id', auth, soloAdmin, async (req, res) => {
  const { nueva_password } = req.body;
  if (!nueva_password || nueva_password.length < 4)
    return res.status(400).json({ error: 'Contraseña mínimo 4 caracteres' });
  try {
    const hash = await bcrypt.hash(nueva_password, 10);
    await db.query('UPDATE usuarios SET password=? WHERE id=?', [hash, req.params.id]);
    res.json({ message: 'Contraseña reseteada' });
  } catch { res.status(500).json({ error: 'Error reseteando' }); }
});

module.exports = router;
