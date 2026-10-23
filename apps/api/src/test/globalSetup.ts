import pg from "pg";

const admin = "postgres://leilao:leilao@localhost:5432/postgres";
const testUrl = "postgres://leilao:leilao@localhost:5432/leilao_test";

export default async function setup() {
  const client = new pg.Client({ connectionString: admin });
  await client.connect();
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = 'leilao_test'");
  if (exists.rowCount === 0) await client.query("CREATE DATABASE leilao_test");
  await client.end();

  process.env.DATABASE_URL = testUrl;
  const { migrate } = await import("../db/migrate.js");
  const { pool } = await import("../db/pool.js");
  await migrate();
  await pool.end();
}
