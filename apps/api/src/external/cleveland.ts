import { z } from "zod";
import { HttpError } from "../errors.js";

// Cleveland Museum of Art Open Access API (CC0 works). It needs no key, allows browser
// hotlinking of its images (the Art Institute of Chicago CDN does not) and returns the
// whole artwork in one call, so a search is a single request.
const BASE = "https://openaccess-api.clevelandart.org/api/artworks/";
const TTL_MS = 10 * 60_000;
const TIMEOUT_MS = 5_000;

export interface CatalogItem {
  externalId: string;
  title: string;
  imageUrl: string;
  attributes: Record<string, string>;
}

const FIELDS = "id,title,creators,creation_date,technique,culture,images";

const artworkSchema = z.object({
  id: z.number(),
  title: z.string(),
  creation_date: z.string().nullish(),
  technique: z.string().nullish(),
  culture: z.array(z.string()).nullish(),
  creators: z.array(z.object({ description: z.string().nullish() })).nullish(),
  images: z.object({ web: z.object({ url: z.string() }).nullish() }).nullish(),
});
type Artwork = z.infer<typeof artworkSchema>;

const searchSchema = z.object({ data: z.array(artworkSchema) });
const itemSchema = z.object({ data: artworkSchema });

// null when the artwork has no usable image: a lot needs one for the showcase.
function toItem(a: Artwork): CatalogItem | null {
  const imageUrl = a.images?.web?.url;
  if (!imageUrl) return null;
  return {
    externalId: String(a.id),
    title: a.title,
    imageUrl,
    attributes: Object.fromEntries(
      Object.entries({
        artist: a.creators?.[0]?.description,
        date: a.creation_date,
        medium: a.technique,
        origin: a.culture?.[0],
      }).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ),
  };
}

const cache = new Map<string, { at: number; items: CatalogItem[] }>();
export const clearCatalogCache = () => cache.clear();

async function fetchItems(q: string, limit: number): Promise<CatalogItem[]> {
  const url = new URL(BASE);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("has_image", "1");
  url.searchParams.set("cc0", "1");
  url.searchParams.set("fields", FIELDS);

  const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`catalog responded ${res.status}`);

  return searchSchema
    .parse(await res.json())
    .data.map(toItem)
    .filter((item): item is CatalogItem => item !== null);
}

// The server, not the client, decides what a lot shows: the item is read from the museum API by its
// id when the lot is created, and that snapshot is what the lot keeps from then on.
export async function fetchCatalogItem(externalId: string): Promise<CatalogItem> {
  const unavailable = new HttpError(
    503,
    "catalog_unavailable",
    "O catálogo de obras está indisponível no momento. Tente novamente em instantes.",
  );
  let res: Response;
  try {
    res = await fetch(new URL(`${externalId}?fields=${FIELDS}`, BASE), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error("catalog item fetch failed", err);
    throw unavailable;
  }
  if (res.status === 404) throw new HttpError(404, "item_not_found", "Essa obra não existe no catálogo.");
  if (!res.ok) {
    console.error(`catalog item responded ${res.status}`);
    throw unavailable;
  }
  const parsed = itemSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw unavailable;
  const item = toItem(parsed.data.data);
  if (!item) throw new HttpError(422, "item_without_image", "Essa obra não tem imagem disponível para o leilão.");
  return item;
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
