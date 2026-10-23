import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://leilao:leilao@localhost:5432/leilao",
});
