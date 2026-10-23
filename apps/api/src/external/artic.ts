import { z } from "zod";
import { HttpError } from "../errors.js";

// Art Institute of Chicago public API. It sits behind Cloudflare, which challenges
// requests without an identified user agent, so we always send one.
const BASE = "https://api.artic.edu/api/v1/artworks/search";
const USER_AGENT = "verzel-casa-de-leiloes/1.0 (teste tecnico)";
const TTL_MS = 10 * 60_000;
const TIMEOUT_MS = 5_000;

export interface CatalogItem {
  externalId: string;
  title: string;
  imageUrl: string;
  attributes: Record<string, string>;
}

const responseSchema = z.object({
  data: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      image_id: z.string().nullable(),
      artist_display: z.string().nullish(),
      date_display: z.string().nullish(),
      medium_display: z.string().nullish(),
      place_of_origin: z.string().nullish(),
    }),
  ),
});

export const imageUrl = (imageId: string) => `https://www.artic.edu/iiif/2/${imageId}/full/843,/0/default.jpg`;

const cache = new Map<string, { at: number; items: CatalogItem[] }>();
export const clearCatalogCache = () => cache.clear();

async function fetchItems(q: string, limit: number): Promise<CatalogItem[]> {
  const url = new URL(BASE);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("query[term][is_public_domain]", "true");
  url.searchParams.set("fields", "id,title,image_id,artist_display,date_display,medium_display,place_of_origin");

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "AIC-User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`catalog responded ${res.status}`);

  return responseSchema
    .parse(await res.json())
    .data.filter((a) => a.image_id)
    .map((a) => ({
      externalId: String(a.id),
      title: a.title,
      imageUrl: imageUrl(a.image_id!),
      attributes: Object.fromEntries(
        Object.entries({
          artist: a.artist_display?.replace(/\s*\n\s*/g, " — "),
          date: a.date_display,
          medium: a.medium_display,
          origin: a.place_of_origin,
        }).filter((entry): entry is [string, string] => Boolean(entry[1])),
      ),
    }));
}

// Fresh cache first; on failure, a stale cached answer is better than none.
// Lots keep their own snapshot, so only the search depends on this API.
export async function searchCatalog(query: string, limit = 12): Promise<{ items: CatalogItem[]; stale: boolean }> {
  const key = `${query.toLowerCase()}|${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return { items: hit.items, stale: false };
  try {
    const items = await fetchItems(query, limit);
    cache.set(key, { at: Date.now(), items });
    return { items, stale: false };
  } catch (err) {
    console.error("catalog search failed", err);
    if (hit) return { items: hit.items, stale: true };
    throw new HttpError(
      503,
      "catalog_unavailable",
      "O catálogo de obras está indisponível no momento. Tente novamente em instantes.",
    );
  }
}
