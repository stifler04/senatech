// backend/db.js
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.MYSQLHOST || process.env.DB_HOST,
    port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'senatech',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true
});

// Prueba de conexión al iniciar
pool.getConnection()
    .then(connection => {
        console.log('✅ MySQL conectado correctamente en Railway');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Error al conectar con MySQL:', err.message);
        console.error('Revisa las variables de entorno en Railway');
        // process.exit(1);   ← Comenta esta línea temporalmente para ver los logs
    });

module.exports = pool;