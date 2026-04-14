// backend/server.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const os      = require('os');

const authRoutes      = require('./routes/auth');
const registrosRoutes = require('./routes/registros');

const app  = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // 0.0.0.0 = acepta conexiones de cualquier dispositivo en la red

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Rutas API
app.use('/api/auth',  authRoutes);
app.use('/api',       registrosRoutes);

// Fallback → index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Obtener IP local para mostrar instrucciones de acceso móvil
function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'tu-ip-local';
}

app.listen(PORT, HOST, () => {
  const ip = getLocalIP();
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║       SENA TECH v3.0 — CORRIENDO    ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  💻 PC:     http://localhost:${PORT}      ║`);
  console.log(`║  📱 Móvil:  http://${ip}:${PORT}   ║`);
  console.log('║                                      ║');
  console.log('║  Conecta el celular a la misma WiFi  ║');
  console.log('║  y abre la dirección 📱 en el browser ║');
  console.log('╚══════════════════════════════════════╝\n');
});
