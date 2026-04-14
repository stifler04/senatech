// backend/db.js
require('dotenv').config();

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.MYSQLHOST,
    port: 3306,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE || 'senatech'
});

pool.getConnection()
    .then(() => {
        console.log("✅ La casa se conectó al cuarto secreto");
    })
    .catch((error) => {
        console.log("❌ No pude conectarme al cuarto secreto");
        console.log(error.message);
    });

module.exports = pool;