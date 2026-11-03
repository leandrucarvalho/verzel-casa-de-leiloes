import { vi } from "vitest";

// Stands in for the museum API: lots now read their item from the catalog by id,
// so tests register the items they need and get back a catalog-shaped answer.
const items = new Map<string, { title: string; artist?: string }>();
let nextId = 1000;

export function addItem(title: string, artist?: string): string {
  const id = String(nextId++);
  items.set(id, { title, artist });
  return id;
}

export function stubCatalog() {
  const real = globalThis.fetch;
  vi.stubGlobal("fetch", (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const match = String(input).match(/openaccess-api\.clevelandart\.org\/api\/artworks\/(\d+)\?/);
    if (!match) return real(input, init);
    const item = items.get(match[1]!);
    if (!item) return Promise.resolve(new Response("{}", { status: 404 }));
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: {
            id: Number(match[1]),
            title: item.title,
            creators: item.artist ? [{ description: item.artist }] : [],
            images: { web: { url: `https://openaccess-cdn.clevelandart.org/${match[1]}.jpg` } },
          },
        }),
      ),
    );
  });
}
