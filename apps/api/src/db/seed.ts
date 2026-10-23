import { fileURLToPath } from "node:url";
import { hashPassword } from "../auth/password.js";
import { placeBid } from "../domain/bids.js";
import { createLot } from "../domain/lots.js";
import { settleLot } from "../domain/settlement.js";
import { deposit } from "../domain/wallet.js";
import { imageUrl } from "../external/artic.js";
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

// Snapshots of real Art Institute of Chicago works (public domain), so the seed needs no network.
const artworks = {
  seurat: {
    externalId: "27992",
    title: "A Sunday on La Grande Jatte — 1884",
    imageUrl: imageUrl("2d484387-2509-5e8e-2c43-22f9981972eb"),
    attributes: { artist: "Georges Seurat (French, 1859–1891)", date: "1884–86", medium: "Oil on canvas", origin: "France" },
  },
  vanGogh: {
    externalId: "28560",
    title: "The Bedroom",
    imageUrl: imageUrl("6644829f-f292-c5c4-a73c-0356a6fdbf0d"),
    attributes: { artist: "Vincent van Gogh (Dutch, 1853–1890)", date: "1889", medium: "Oil on canvas", origin: "Saint-Rémy-de-Provence" },
  },
  waterLilies: {
    externalId: "16568",
    title: "Water Lilies",
    imageUrl: imageUrl("3c27b499-af56-f0d5-93b5-a7f2f1ad5813"),
    attributes: { artist: "Claude Monet (French, 1840–1926)", medium: "Oil on canvas", origin: "France" },
  },
  caillebotte: {
    externalId: "20684",
    title: "Paris Street; Rainy Day",
    imageUrl: imageUrl("f8fd76e9-c396-5678-36ed-6a348c904d27"),
    attributes: { artist: "Gustave Caillebotte (French, 1848–1894)", date: "1877", medium: "Oil on canvas", origin: "Paris" },
  },
  normandyTrain: {
    externalId: "16571",
    title: "Arrival of the Normandy Train, Gare Saint-Lazare",
    imageUrl: imageUrl("0f1cc0e0-e42e-be16-3f71-2022da38cb93"),
    attributes: { artist: "Claude Monet (French, 1840–1926)", medium: "Oil on canvas", origin: "France" },
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
  const live = await lot(artworks.seurat, at(-DAY), at(3 * DAY));
  await placeBid(live.id, ana, 100_000);
  await placeBid(live.id, bruno, 105_000);
  await placeBid(live.id, ana, 115_000);

  // live, no bids yet
  await lot(artworks.vanGogh, at(-DAY), at(2 * DAY));
  await lot(artworks.waterLilies, at(-DAY / 2), at(5 * DAY));

  // scheduled
  await lot(artworks.caillebotte, at(DAY), at(4 * DAY));

  // ended and settled, with a receipt
  const ended = await lot(artworks.normandyTrain, at(-3 * DAY), at(DAY));
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
