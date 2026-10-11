import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { parseCreateRequest, publicPayment } from "../lib/stored-payments";
import { PAYMENT_TOKENS } from "../lib/tokens";
import { buildPaymentTransfer } from "../lib/payment-transfer";
import { decodeFunctionData, erc20Abi, parseUnits } from "viem";

const draft = { amount: "0.000000000000000001", recipient: "0x1234567890123456789012345678901234567890",
  recipientName: "Ada Studio", description: "Design work", expiry: "", token: "MON", network: 10143 };
async function auth(request: APIRequestContext) {
  const response = await request.post("http://127.0.0.1:3101/auth/v1/signup", { data: {} });
  const { access_token } = await response.json();
  return { Authorization: `Bearer ${access_token}` };
}

test("request parser rejects privilege fields, floating values and ambiguous expiry", () => {
  const valid = { ...draft, clientRequestId: randomUUID() };
  expect(parseCreateRequest(valid)?.draft.amount).toBe(draft.amount);
  for (const change of [{ owner_id: randomUUID() }, { status: "paid" }, { transaction_hash: "0x123" },
    { paid_at: new Date().toISOString() }, { creator_wallet: draft.recipient },
    { amount: 0.1 }, { expiry: "2030-01-01T12:00" }, { clientRequestId: "bad" }])
    expect(parseCreateRequest({ ...valid, ...change })).toBeNull();
  expect(publicPayment({ ...valid, status: "paid" })).toBeNull();
});

test("database field mapping preserves exact amounts and never exposes private or settlement fields", () => {
  const row = { id: randomUUID(), amount: "999999999.123456", recipient_wallet: draft.recipient,
    recipient_name: "Ada", description: "Design", token_symbol: "USDC", network: "Monad Testnet",
    status: "pending", created_at: new Date().toISOString(), expires_at: null,
    owner_id: randomUUID(), client_request_id: randomUUID(), creator_wallet: draft.recipient,
    transaction_hash: null, paid_at: null };
  const payment = publicPayment(row)!;
  expect(payment.amount).toBe(row.amount);
  expect(payment.recipient).toBe(row.recipient_wallet);
  expect(payment.token).toBe("USDC");
  expect(payment.network).toBe(10143);
  expect(payment.status).toBe("unpaid");
  for (const key of ["owner_id", "client_request_id", "creator_wallet", "transaction_hash", "paid_at"])
    expect(payment).not.toHaveProperty(key);
  for (const change of [{ amount: 999999999.123456 }, { amount: "0.0000001" },
    { network: "Monad Mainnet" }, { network: 10143 }, { status: "paid" }, { token_symbol: "USDT" }])
    expect(publicPayment({ ...row, ...change })).toBeNull();
});

test("token and chain validation never rounds USDC or accepts client metadata", () => {
  const valid = { ...draft, token: "USDC", amount: "999999999.123456", clientRequestId: randomUUID() };
  expect(parseCreateRequest(valid)?.draft.amount).toBe(valid.amount);
  for (const change of [{ amount: "0.0000001" }, { amount: "1.0000000" }, { amount: "1e-6" },
    { amount: "-1" }, { amount: "0" }, { amount: 0.1 }, { network: 143 }, { network: "10143" },
    { token: "usdc" }, { token: "USDT" }, { token: null }, { tokenAddress: PAYMENT_TOKENS.USDC.address }, { decimals: 18 }])
    expect(parseCreateRequest({ ...valid, ...change })).toBeNull();
  expect(parseCreateRequest({ ...valid, token: "MON", amount: draft.amount })).not.toBeNull();
});

test("stored MON and USDC wallet transactions preserve exact amounts", () => {
  const common = {
    id: randomUUID(), recipient: draft.recipient as `0x${string}`, recipientName: "Ada",
    description: "Design", network: 10143, expiresAt: null, status: "unpaid" as const,
    createdAt: Date.now(),
  };
  const mon = buildPaymentTransfer({ ...common, token: "MON", amount: "0.000000000000000001" });
  expect(mon.to).toBe(draft.recipient);
  expect(mon.value).toBe(BigInt(1));
  expect(mon.amountAtomic).toBe(BigInt(1));
  expect(mon.data).toMatch(/^0x/);

  const usdc = buildPaymentTransfer({ ...common, token: "USDC", amount: "12.345678" });
  expect(usdc.to).toBe(PAYMENT_TOKENS.USDC.address);
  expect(usdc.value).toBe(BigInt(0));
  expect(usdc.amountAtomic).toBe(parseUnits("12.345678", 6));
  const decoded = decodeFunctionData({ abi: erc20Abi, data: usdc.data });
  expect(decoded.functionName).toBe("transfer");
  expect(decoded.args).toEqual([draft.recipient, BigInt(12345678)]);
});

test("USDC API persists exact precision and rejects changed token retries", async ({ request }) => {
  const headers = await auth(request);
  const data = { ...draft, token: "USDC", amount: "999999999.123456", clientRequestId: randomUUID() };
  const response = await request.post("/api/payments", { data, headers });
  expect(response.status()).toBe(201);
  const { payment } = await response.json();
  expect(payment.amount).toBe(data.amount);
  expect(payment.token).toBe("USDC");
  expect(payment.network).toBe(10143);
  const publicResponse = await request.get(`/api/payments/${payment.id}`);
  expect((await publicResponse.json()).payment).toEqual(payment);
  expect(Object.keys(payment).sort()).toEqual(["id", "amount", "recipient", "recipientName", "description", "token", "network", "status", "createdAt", "expiresAt"].sort());
  expect((await request.post("/api/payments", { data: { ...data, token: "MON" }, headers })).status()).toBe(409);
  for (const change of [{ token: "USDT" }, { network: 143 }, { amount: "0.0000001" }])
    expect((await request.post("/api/payments", { data: { ...data, ...change }, headers })).status()).toBe(400);
  expect((await request.patch(`/api/payments/${payment.id}`, { data: { status: "paid" }, headers })).status()).toBe(405);
});

test("decimal-equivalent retries recover one request without floating-point conversion", async ({ request }) => {
  const headers = await auth(request);
  const data = { ...draft, token: "USDC", amount: "12.340000", clientRequestId: randomUUID() };
  const first = await request.post("/api/payments", { data, headers });
  expect(first.status()).toBe(201);
  const saved = (await first.json()).payment;
  expect(saved.amount).toBe("12.34");
  const retry = await request.post("/api/payments", { data: { ...data, amount: "12.34" }, headers });
  expect(retry.status()).toBe(201);
  expect((await retry.json()).payment.id).toBe(saved.id);
});

test("USDC selection validates precision, preserves input and shares a payable request", async ({ page, browser }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/create");
  await page.locator("#amount").fill("0.0000001");
  await page.locator("#token").focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#token")).toHaveValue("USDC");
  await expect(page.locator("#amount")).toHaveValue("0.0000001");
  await expect(page.locator("#amount-help")).toHaveText("Up to 6 decimal places.");
  await page.locator("#recipient").fill(draft.recipient);
  await page.locator("#description").fill(draft.description);
  await page.getByRole("button", { name: "Create Payment Link", exact: true }).click();
  await expect(page.locator("#amount-error")).toContainText("6 decimal places");
  await expect(page.locator("#amount")).toBeFocused();
  await page.locator("#amount").fill("0.000001");
  await expect(page.locator(".ticket-amount")).toContainText("0.000001 USDC");
  await page.setViewportSize({ width: 375, height: 850 });
  await page.screenshot({ path: "test-results/usdc-create-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Create Payment Link", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your link is ready." })).toBeVisible();
  const url = await page.getByLabel("Payment URL").inputValue();
  const fresh = await browser.newContext();
  const recipient = await fresh.newPage();
  await recipient.goto(url);
  await expect(recipient.locator(".payment-summary")).toContainText("0.000001 USDC");
  await expect(recipient.locator(".payment-summary")).toContainText(PAYMENT_TOKENS.USDC.address);
  await expect(recipient.getByRole("main").getByRole("button", { name: "Connect Wallet" })).toBeVisible();
  for (const width of [1440, 375]) {
    await recipient.setViewportSize({ width, height: 900 });
    expect(await recipient.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await recipient.screenshot({ path: `test-results/usdc-request-${width}.png`, fullPage: true });
  }
  await fresh.close();
  expect(errors).toEqual([]);
});

test("API requires verified auth, validates JSON and enforces body limits", async ({ request }) => {
  const data = { ...draft, clientRequestId: randomUUID() };
  expect((await request.post("/api/payments", { data })).status()).toBe(401);
  expect((await request.post("/api/payments", { data, headers: { Authorization: "Bearer invalid" } })).status()).toBe(401);
  const headers = await auth(request);
  for (const change of [{ amount: "0" }, { recipient: "0x0" }, { owner_id: randomUUID() }, { status: "paid" }, { expiry: "2020-01-01T00:00:00Z" }])
    expect((await request.post("/api/payments", { data: { ...data, ...change }, headers })).status()).toBe(400);
  expect((await request.post("/api/payments", { data: "{", headers: { ...headers, "Content-Type": "application/json" } })).status()).toBe(400);
  expect((await request.post("/api/payments", { data: "hello", headers })).status()).toBe(415);
  expect((await request.post("/api/payments", { data: { ...data, description: "x".repeat(5000) }, headers })).status()).toBe(413);
});

test("concurrent API retries return one ID and recipient responses exclude internal fields", async ({ request, page }) => {
  const headers = await auth(request);
  const data = { ...draft, clientRequestId: randomUUID() };
  const results = await Promise.all(Array.from({ length: 4 }, () => request.post("/api/payments", { data, headers })));
  const bodies = await Promise.all(results.map((response) => response.json()));
  for (const response of results) expect(response.status()).toBe(201);
  expect(new Set(bodies.map((body) => body.payment.id)).size).toBe(1);
  const payment = bodies[0].payment;
  expect(payment.amount).toBe(draft.amount);
  expect(payment.status).toBe("unpaid");
  expect(payment.owner_id).toBeUndefined();
  expect(payment.client_request_id).toBeUndefined();
  expect((await request.post("/api/payments", { data: { ...data, amount: "2" }, headers })).status()).toBe(409);
  const other = await request.post("/api/payments", { data, headers: await auth(request) });
  expect((await other.json()).payment.id).not.toBe(payment.id);
  const publicResponse = await request.get(`/api/payments/${payment.id}`);
  expect(publicResponse.headers()["cache-control"]).toBe("no-store");
  expect((await publicResponse.json()).payment).toEqual(payment);
  await page.goto(bodies[0].path);
  await expect(page.getByText("Review your payment.")).toBeVisible();
  await expect(page.locator(".payment-summary")).toContainText(draft.recipient);
  await expect(page.getByRole("main").getByRole("button", { name: "Connect Wallet" })).toBeVisible();
  await expect(page.getByText("Payment complete.")).toHaveCount(0);
  expect((await request.get(`/api/payments/${randomUUID()}`)).status()).toBe(404);
  expect((await request.get("/api/payments/invalid")).status()).toBe(404);
});

for (const [mode, expected] of [["forbidden", 403], ["rate-limit", 429], ["unavailable", 503], ["auth-unavailable", 503], ["timeout", 503]] as const)
  test(`API safely handles ${mode}`, async ({ request }) => {
    const headers = await auth(request);
    await request.post("http://127.0.0.1:3101/__scenario", { data: { token: headers.Authorization.slice(7), mode } });
    const response = await request.post("/api/payments", { data: { ...draft, clientRequestId: randomUUID() }, headers });
    expect(response.status()).toBe(expected);
    expect(await response.text()).not.toContain("Internal fixture detail");
    if (expected === 429) expect(response.headers()["retry-after"]).toBe("3600");
  });

test("form preserves inputs and submission ID after a lost save response", async ({ page }) => {
  await page.goto("/create");
  await page.locator("#amount").fill(draft.amount);
  await page.locator("#recipient").fill(draft.recipient);
  await page.locator("#description").fill(draft.description);
  const ids: string[] = [];
  let savedId = "";
  await page.route("**/api/payments", async (route) => {
    ids.push(route.request().postDataJSON().clientRequestId);
    const response = await route.fetch();
    if (ids.length === 1) {
      savedId = (await response.json()).payment.id;
      await route.fulfill({ status: 503, json: { error: "Could not confirm the save. Please retry." } });
    } else await route.fulfill({ response });
  });
  const submit = page.getByRole("button", { name: "Create Payment Link", exact: true });
  await submit.dblclick();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Could not confirm the save");
  await expect(page.locator("#amount")).toHaveValue(draft.amount);
  await submit.click();
  await expect(page.getByRole("heading", { name: "Your link is ready." })).toBeVisible();
  await expect(page.getByLabel("Payment URL")).toHaveValue(new RegExp(`/pay/${savedId}$`));
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
});
