const mysql = require('mysql2');

// Railway variables are exposed as MYSQLHOST/MYSQLPORT/... when referencing a
// MySQL service. Keep the DB_* names for existing local .env files.
function envValue(...names) {
    for (const name of names) {
        const value = process.env[name];
        if (value) return value.trim();
    }
}

// Accept either a raw host or an accidentally pasted dotenv assignment.
const host = envValue('MYSQLHOST', 'MYSQL_HOST', 'DB_HOST')?.replace(/^DB_HOST\s*=\s*/i, '').replace(/^['"]|['"]$/g, '');
const port = Number(envValue('MYSQLPORT', 'MYSQL_PORT', 'DB_PORT') || 3306);

if (!host) {
    throw new Error('Configure MYSQLHOST (Railway) ou DB_HOST (local) para conectar ao MySQL.');
}

const db = mysql.createConnection({
    host,
    user: envValue('MYSQLUSER', 'MYSQL_USER', 'DB_USER'),
    password: envValue('MYSQLPASSWORD', 'MYSQL_PASSWORD', 'DB_PASS'),
    database: envValue('MYSQLDATABASE', 'MYSQL_DATABASE', 'DB_NAME'),
    port,
});

// mysql2 connections emit network errors; handle them so an unreachable DB
// does not crash the web process with an unhandled EventEmitter error.
db.on('error', (err) => {
    console.error('Falha na conexão com MySQL:', err.code || err.message);
});

module.exports = db;
