const fs = require("node:fs");
const { Pool } = require("pg");
const config = require("./config");

const pool = new Pool({
  connectionString: config.databaseUrl,
});

async function runMigrations() {
  const sql = fs.readFileSync(config.migrationsPath, "utf8");
  await pool.query(sql);
}

module.exports = {
  pool,
  query: (...args) => pool.query(...args),
  runMigrations,
};
