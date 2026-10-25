import { expect, test, type APIRequestContext } from "@playwright/test";

const API = "http://localhost:3333";
// accounts created by `npm run seed -w apps/api`
const PASSWORD = "demo12345";
const AUCTIONEER = "leiloeiro@leiloes.dev";
const BIDDER = "bruno@leiloes.dev";
const RIVAL = "ana@leiloes.dev";

async function apiLogin(request: APIRequestContext, email: string) {
  const res = await request.post(`${API}/auth/login`, { data: { email, password: PASSWORD } });
  expect(res.ok(), `login of ${email} (is the database seeded?)`).toBeTruthy();
  return { Authorization: `Bearer ${(await res.json()).token}` };
}

// Own lot per run, so the test does not depend on (or disturb) the seeded lots.
const title = `[e2e] smoke ${Date.now()}`;
let lotId: string;

test.beforeAll(async ({ request }) => {
  const headers = await apiLogin(request, AUCTIONEER);
  const now = Date.now();
  const res = await request.post(`${API}/lots`, {
    headers,
    data: {
      externalId: "e2e",
      title,
      imageUrl: null,
      attributes: { artist: "Playwright" },
      startingBidCents: 1000,
      minIncrementCents: 100,
      startsAt: new Date(now - 3_600_000).toISOString(),
      endsAt: new Date(now + 86_400_000).toISOString(),
    },
  });
  expect(res.status()).toBe(201);
  lotId = (await res.json()).id;
});

// Cancelling releases whatever the bidder had committed, leaving the seeded balances as they were.
test.afterAll(async ({ request }) => {
  const headers = await apiLogin(request, AUCTIONEER);
  await request.post(`${API}/lots/${lotId}/cancel`, { headers });
});

test("from login to a bid, being outbid in real time, and the public audit", async ({ page, request }) => {
  // login through the form, with the show/hide password button
  await page.goto("/login");
  await page.locator("input[name=email]").fill(BIDDER);
  await page.locator("input[name=password]").fill(PASSWORD);
  await page.getByRole("button", { name: "Exibir senha" }).click();
  await expect(page.locator("input[name=password]")).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.locator("header")).toContainText("Bruno");

  // find the lot in the showcase by its title and open it
  await page.getByRole("searchbox").fill(title);
  await page.getByRole("link", { name: new RegExp(title.replace(/[[\]]/g, "\\$&")) }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  // refused bid, then a valid one
  await page.locator("#bid").fill("5");
  await page.getByRole("button", { name: "Dar lance" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "O lance mínimo é" })).toBeVisible();

  await page.locator("#bid").fill("10,00");
  await page.getByRole("button", { name: "Dar lance" }).click();
  await expect(page.getByText("Lance de R$ 10,00 registrado.")).toBeVisible();
  await expect(page.getByText(/Você está ganhando este lote/)).toBeVisible();

  // someone else outbids from outside the page; the room updates without a reload
  const rival = await apiLogin(request, RIVAL);
  const outbid = await request.post(`${API}/lots/${lotId}/bids`, { headers: rival, data: { amountCents: 1100 } });
  expect(outbid.status()).toBe(201);
  await expect(page.getByText(/Você foi superado/)).toBeVisible({ timeout: 10_000 });

  // the public audit shows an intact chain with both bids
  await page.getByRole("link", { name: "Auditar o histórico de lances" }).click();
  await expect(page.getByText(/Histórico íntegro/)).toBeVisible();
  await expect(page.getByText(/#1 ·/)).toBeVisible();
  await expect(page.getByText(/#2 ·/)).toBeVisible();
});
