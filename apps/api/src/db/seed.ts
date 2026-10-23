import { fileURLToPath } from "node:url";
import { hashPassword } from "../auth/password.js";
import { placeBid } from "../domain/bids.js";
import { createLot } from "../domain/lots.js";
import { settleLot } from "../domain/settlement.js";
import { deposit } from "../domain/wallet.js";
import { migrate } from "./migrate.js";
import { pool } from "./pool.js";

export const DEMO_PASSWORD = "demo12345";
const DAY = 86_400_000;
const at = (ms: number) => new Date(Date.now() + ms);

async function createUser(email: string, nickname: string, role: "auctioneer" | "bidder") {
  const { rows } = await pool.query(
    "INSERT INTO users (email, password_hash, nickname, role) VALUES ($1, $2, $3, $4) RETURNING id",
    [email, await hashPassword(DEMO_PASSWORD), nickname, role],
  );
  return rows[0].id as string;
}

// Snapshots of real Cleveland Museum of Art works (CC0), so the seed needs no network.
const cdn = (accession: string) => `https://openaccess-cdn.clevelandart.org/${accession}/${accession}_web.jpg`;
const artworks = {
  redKerchief: {
    externalId: "135382",
    title: "The Red Kerchief",
    imageUrl: cdn("1958.39"),
    attributes: { artist: "Claude Monet (French, 1840–1926)", date: "c. 1868–73", medium: "oil on fabric", origin: "France, 19th century" },
  },
  fuji: {
    externalId: "111654",
    title: "South Wind, Clear Sky, from Thirty-Six Views of Mount Fuji",
    imageUrl: cdn("1930.189"),
    attributes: { artist: "Katsushika Hokusai (Japanese, 1760–1849)", date: "early 1830s", medium: "color woodblock print", origin: "Japan, Edo period (1615–1868)" },
  },
  turner: {
    externalId: "122351",
    title: "The Burning of the Houses of Lords and Commons, 16 October 1834",
    imageUrl: cdn("1942.647"),
    attributes: { artist: "Joseph Mallord William Turner (British, 1775–1851)", date: "1835", medium: "oil on canvas", origin: "England, 19th century" },
  },
  caravaggio: {
    externalId: "148758",
    title: "The Crucifixion of Saint Andrew",
    imageUrl: cdn("1976.2"),
    attributes: { artist: "Caravaggio (Italian, 1571–1610)", date: "1606–7", medium: "oil on canvas", origin: "Italy, Naples" },
  },
  rodin: {
    externalId: "98627",
    title: "The Age of Bronze",
    imageUrl: cdn("1918.328"),
    attributes: { artist: "Auguste Rodin (French, 1840–1917)", date: "1875–76", medium: "bronze", origin: "France, 19th century" },
  },
};

export async function seed() {
  await migrate();
  const exists = await pool.query("SELECT 1 FROM users WHERE email = 'leiloeiro@leiloes.dev'");
  if (exists.rowCount) {
    console.log("seed already applied, skipping");
    return;
  }

  const seller = await createUser("leiloeiro@leiloes.dev", "Casa Demo", "auctioneer");
  const ana = await createUser("ana@leiloes.dev", "Ana", "bidder");
  const bruno = await createUser("bruno@leiloes.dev", "Bruno", "bidder");
  await deposit(ana, 5_000_000);
  await deposit(bruno, 5_000_000);

  const lot = (art: (typeof artworks)[keyof typeof artworks], startsAt: Date, endsAt: Date) =>
    createLot(seller, { ...art, startingBidCents: 100_000, minIncrementCents: 5_000, startsAt, endsAt });

  // live, with open bids
  const live = await lot(artworks.redKerchief, at(-DAY), at(3 * DAY));
  await placeBid(live.id, ana, 100_000);
  await placeBid(live.id, bruno, 105_000);
  await placeBid(live.id, ana, 115_000);

  // live, no bids yet
  await lot(artworks.fuji, at(-DAY), at(2 * DAY));
  await lot(artworks.turner, at(-DAY / 2), at(5 * DAY));

  // scheduled
  await lot(artworks.caravaggio, at(DAY), at(4 * DAY));

  // ended and settled, with a receipt
  const ended = await lot(artworks.rodin, at(-3 * DAY), at(DAY));
  await placeBid(ended.id, ana, 100_000);
  await placeBid(ended.id, bruno, 120_000);
  await pool.query("UPDATE lots SET starts_at = now() - interval '3 days', ends_at = now() - interval '1 day' WHERE id = $1", [ended.id]);
  await settleLot(ended.id);

  console.log(`seeded: leiloeiro@leiloes.dev, ana@leiloes.dev, bruno@leiloes.dev (password: ${DEMO_PASSWORD})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await seed();
  await pool.end();
}
