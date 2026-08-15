// Conexion a Postgres. DATABASE_URL viene de Render (env var), nunca hardcodeada.
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;
