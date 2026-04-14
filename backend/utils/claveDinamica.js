// backend/utils/claveDinamica.js
// Genera y valida claves dinámicas de 6 dígitos que cambian cada 60 segundos
// Similar a Nequi/Bancolombia — sin librerías externas

require('dotenv').config();
const crypto = require('crypto');

const WINDOW  = parseInt(process.env.TOTP_WINDOW) || 60;   // segundos
const SECRET  = process.env.TOTP_SECRET || 'SenaTechSecret2026';

/**
 * Genera el contador actual basado en el tiempo
 */
function getContador() {
  return Math.floor(Date.now() / 1000 / WINDOW);
}

/**
 * Genera clave de 6 dígitos para un usuario + contador dado
 */
function generarClave(cedula, contador) {
  const data = `${SECRET}:${cedula}:${contador}`;
  const hash = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  // Tomar 6 dígitos del hash
  const num  = parseInt(hash.substring(0, 10), 16);
  return String(num % 1000000).padStart(6, '0');
}

/**
 * Obtiene la clave actual del usuario (+ segundos restantes)
 */
function claveActual(cedula) {
  const contador  = getContador();
  const clave     = generarClave(cedula, contador);
  const ahora     = Math.floor(Date.now() / 1000);
  const restantes = WINDOW - (ahora % WINDOW);
  return { clave, restantes, ventana: WINDOW };
}

/**
 * Valida si una clave es correcta (acepta ventana actual y la anterior)
 */
function validarClave(cedula, claveIngresada) {
  const contador = getContador();
  // Aceptar ventana actual y la anterior (gracia de ~1 min)
  for (let delta = 0; delta <= 1; delta++) {
    if (generarClave(cedula, contador - delta) === claveIngresada) {
      return true;
    }
  }
  return false;
}

/**
 * Genera el "seed" del QR rotativo (cambia cada minuto)
 * El QR incluye este seed para que no sea capturable
 */
function qrSeed(cedula) {
  const contador = getContador();
  const data     = `QR:${SECRET}:${cedula}:${contador}`;
  return crypto.createHmac('sha256', SECRET).update(data).digest('hex').substring(0, 16);
}

module.exports = { claveActual, validarClave, qrSeed, WINDOW };
