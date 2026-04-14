// backend/routes/registros.js
require('dotenv').config();
const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const db      = require('../db');
const { validarClave, qrSeed } = require('../utils/claveDinamica');

function auth(req, res, next) {
  const h = req.headers['authorization'];
  if (!h) return res.status(401).json({ error: 'Token requerido' });
  try { req.user = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token inválido' }); }
}
function soloVigilante(req, res, next) {
  if (req.user.tipo !== 'guard' && req.user.tipo !== 'admin')
    return res.status(403).json({ error: 'Solo vigilantes pueden registrar' });
  next();
}

// ══════════════════════════════════════════
//  EQUIPOS
// ══════════════════════════════════════════
router.get('/equipos', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM equipos WHERE usuario_id=? ORDER BY creado_en DESC', [req.user.id]);
    res.json(rows);
  } catch { res.status(500).json({ error: 'Error obteniendo equipos' }); }
});

router.post('/equipos', auth, async (req, res) => {
  const { nombre, tipo, marca, serial, modelo, color } = req.body;
  if (!nombre || !tipo || !marca || !serial)
    return res.status(400).json({ error: 'Nombre, tipo, marca y serial son requeridos' });
  try {
    const [dup] = await db.query('SELECT id FROM equipos WHERE serial=?', [serial]);
    if (dup.length) return res.status(409).json({ error: 'Ese número de serie ya está registrado' });
    const [r] = await db.query(
      'INSERT INTO equipos (usuario_id,nombre,tipo,marca,serial,modelo,color) VALUES (?,?,?,?,?,?,?)',
      [req.user.id, nombre, tipo, marca, serial, modelo||'', color||'Plata']
    );
    res.status(201).json({ message: 'Equipo registrado', id: r.insertId });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error registrando equipo' }); }
});

router.put('/equipos/:id', auth, async (req, res) => {
  const { nombre, tipo, marca, serial, modelo, color } = req.body;
  if (!nombre || !tipo || !marca || !serial)
    return res.status(400).json({ error: 'Campos requeridos incompletos' });
  try {
    const [mine] = await db.query('SELECT id FROM equipos WHERE id=? AND usuario_id=?', [req.params.id, req.user.id]);
    if (!mine.length) return res.status(404).json({ error: 'Equipo no encontrado' });
    const [dup] = await db.query('SELECT id FROM equipos WHERE serial=? AND id!=?', [serial, req.params.id]);
    if (dup.length) return res.status(409).json({ error: 'Ese serial ya lo tiene otro equipo' });
    await db.query('UPDATE equipos SET nombre=?,tipo=?,marca=?,serial=?,modelo=?,color=? WHERE id=?',
      [nombre, tipo, marca, serial, modelo||'', color||'Plata', req.params.id]);
    res.json({ message: 'Equipo actualizado' });
  } catch { res.status(500).json({ error: 'Error actualizando' }); }
});

router.delete('/equipos/:id', auth, async (req, res) => {
  try {
    const [mine] = await db.query('SELECT id FROM equipos WHERE id=? AND usuario_id=?', [req.params.id, req.user.id]);
    if (!mine.length) return res.status(404).json({ error: 'Equipo no encontrado' });
    await db.query('DELETE FROM equipos WHERE id=?', [req.params.id]);
    res.json({ message: 'Equipo eliminado' });
  } catch { res.status(500).json({ error: 'Error eliminando' }); }
});

// ══════════════════════════════════════════
//  REGISTROS — escanear QR
// ══════════════════════════════════════════
router.post('/registros/escanear', auth, soloVigilante, async (req, res) => {
  const { cedula_usuario, serial_equipo, qr_seed } = req.body;
  if (!cedula_usuario || !serial_equipo)
    return res.status(400).json({ error: 'Datos incompletos del QR' });

  try {
    // Validar seed del QR (anti-captura)
    const seedEsperado = qrSeed(cedula_usuario);
    if (qr_seed && qr_seed !== seedEsperado)
      return res.status(401).json({ error: 'QR expirado o inválido. Pídele al usuario que refresque su código.' });

    const [usuarios] = await db.query('SELECT id FROM usuarios WHERE cedula=?', [cedula_usuario]);
    if (!usuarios.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    const [equipos] = await db.query('SELECT id FROM equipos WHERE serial=?', [serial_equipo]);
    if (!equipos.length) return res.status(404).json({ error: 'Equipo no registrado' });

    const uid  = usuarios[0].id;
    const eid  = equipos[0].id;
    const [ul] = await db.query('SELECT tipo FROM registros WHERE equipo_id=? ORDER BY timestamp DESC LIMIT 1', [eid]);
    const tipo = (!ul.length || ul[0].tipo === 'salida') ? 'entrada' : 'salida';

    await db.query('INSERT INTO registros (equipo_id,usuario_id,vigilante_id,tipo,metodo) VALUES (?,?,?,?,?)',
      [eid, uid, req.user.id, tipo, 'qr']);
    res.status(201).json({ message: `${tipo} registrada`, tipo });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error registrando' }); }
});

// ══════════════════════════════════════════
//  REGISTROS — clave dinámica
// ══════════════════════════════════════════
router.post('/registros/clave', auth, soloVigilante, async (req, res) => {
  const { cedula_usuario, serial_equipo, clave } = req.body;
  if (!cedula_usuario || !serial_equipo || !clave)
    return res.status(400).json({ error: 'Cédula, serial y clave son requeridos' });

  try {
    // Validar clave dinámica
    if (!validarClave(cedula_usuario, clave))
      return res.status(401).json({ error: 'Clave inválida o expirada. Pídele al usuario su clave actual.' });

    const [usuarios] = await db.query('SELECT id,nombre,rol FROM usuarios WHERE cedula=?', [cedula_usuario]);
    if (!usuarios.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    const [equipos]  = await db.query('SELECT id,nombre,tipo,serial,color,marca FROM equipos WHERE serial=?', [serial_equipo]);
    if (!equipos.length) return res.status(404).json({ error: 'Equipo no registrado en el sistema' });

    const u    = usuarios[0];
    const eq   = equipos[0];
    const [ul] = await db.query('SELECT tipo FROM registros WHERE equipo_id=? ORDER BY timestamp DESC LIMIT 1', [eq.id]);
    const tipo = (!ul.length || ul[0].tipo === 'salida') ? 'entrada' : 'salida';

    await db.query('INSERT INTO registros (equipo_id,usuario_id,vigilante_id,tipo,metodo) VALUES (?,?,?,?,?)',
      [eq.id, u.id, req.user.id, tipo, 'clave']);

    res.status(201).json({
      message: `${tipo} registrada`,
      tipo,
      usuario: { nombre: u.nombre, cedula: cedula_usuario, rol: u.rol },
      equipo:  { nombre: eq.nombre, tipo: eq.tipo, serial: eq.serial, color: eq.color, marca: eq.marca }
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error registrando' }); }
});

// ══════════════════════════════════════════
//  CONSULTAR EQUIPO POR SERIAL + CLAVE
// ══════════════════════════════════════════
router.post('/registros/consultar', auth, soloVigilante, async (req, res) => {
  const { cedula_usuario, serial_equipo, clave } = req.body;
  if (!cedula_usuario || !serial_equipo || !clave)
    return res.status(400).json({ error: 'Todos los campos son requeridos' });

  try {
    if (!validarClave(cedula_usuario, clave))
      return res.status(401).json({ error: 'Clave inválida o expirada' });

    const [usuarios] = await db.query('SELECT id,nombre,rol FROM usuarios WHERE cedula=?', [cedula_usuario]);
    if (!usuarios.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    const [equipos]  = await db.query('SELECT * FROM equipos WHERE serial=? AND usuario_id=?',
      [serial_equipo, usuarios[0].id]);
    if (!equipos.length) return res.status(404).json({ error: 'Equipo no pertenece a ese usuario' });

    const [ul] = await db.query('SELECT tipo, timestamp FROM registros WHERE equipo_id=? ORDER BY timestamp DESC LIMIT 1', [equipos[0].id]);
    res.json({
      usuario: { nombre: usuarios[0].nombre, cedula: cedula_usuario, rol: usuarios[0].rol },
      equipo:  equipos[0],
      ultimo_movimiento: ul[0] || null
    });
  } catch { res.status(500).json({ error: 'Error consultando' }); }
});

// ══════════════════════════════════════════
//  HISTORIAL
// ══════════════════════════════════════════
router.get('/registros/mios', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.id,r.tipo,r.metodo,r.timestamp,
              e.nombre AS equipo_nombre,e.serial,e.color,e.tipo AS equipo_tipo,e.id AS equipo_id
       FROM registros r JOIN equipos e ON r.equipo_id=e.id
       WHERE r.usuario_id=? ORDER BY r.timestamp DESC LIMIT 200`, [req.user.id]);
    res.json(rows);
  } catch { res.status(500).json({ error: 'Error obteniendo historial' }); }
});

router.get('/registros/todos', auth, async (req, res) => {
  if (req.user.tipo !== 'guard' && req.user.tipo !== 'admin')
    return res.status(403).json({ error: 'Acceso denegado' });
  const { tipo, fecha, buscar, limite = 300 } = req.query;
  let sql = 'SELECT * FROM vista_registros WHERE 1=1';
  const p = [];
  if (tipo && tipo !== 'all') { sql += ' AND tipo=?'; p.push(tipo); }
  if (fecha === 'hoy') { sql += ' AND DATE(timestamp)=CURDATE()'; }
  if (buscar) {
    sql += ' AND (nombre_usuario LIKE ? OR serial LIKE ? OR equipo_nombre LIKE ?)';
    const q = `%${buscar}%`; p.push(q, q, q);
  }
  sql += ' LIMIT ?'; p.push(parseInt(limite));
  try {
    const [rows] = await db.query(sql, p);
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error obteniendo registros' }); }
});

router.get('/registros/stats', auth, async (req, res) => {
  if (req.user.tipo !== 'guard' && req.user.tipo !== 'admin')
    return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const [r] = await db.query(`SELECT COUNT(*) AS total, SUM(tipo='entrada') AS entradas, SUM(tipo='salida') AS salidas FROM registros WHERE DATE(timestamp)=CURDATE()`);
    res.json(r[0]);
  } catch { res.status(500).json({ error: 'Error stats' }); }
});

router.delete('/registros/limpiar', auth, async (req, res) => {
  if (req.user.tipo !== 'admin') return res.status(403).json({ error: 'Solo el admin' });
  try { await db.query('DELETE FROM registros'); res.json({ message: 'Historial eliminado' }); }
  catch { res.status(500).json({ error: 'Error limpiando' }); }
});

module.exports = router;
