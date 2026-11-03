import pg from "pg";

export const connectionString = process.env.DATABASE_URL ?? "postgres://leilao:leilao@localhost:5432/leilao";

export const pool = new pg.Pool({ connectionString });
