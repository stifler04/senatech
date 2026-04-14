// backend/db.js
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool(process.env.DATABASE_URL);

pool.getConnection()
  .then(c => { console.log('✅ MySQL conectado'); c.release(); })
  .catch(e => { console.error('❌ MySQL error:', e.message); process.exit(1); });

module.exports = pool;