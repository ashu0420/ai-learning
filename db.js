require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    ssl: {
        rejectUnauthorized: true
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000
});

pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL pool error:", err.message);
});

async function checkDatabase() {
    await pool.query("SELECT 1");
    return true;
}

async function closePool() {
    await pool.end();
}

module.exports = {
    pool,
    checkDatabase,
    closePool
};