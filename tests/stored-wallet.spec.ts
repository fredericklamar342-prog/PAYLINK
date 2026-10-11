import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { decodeFunctionData, erc20Abi, parseUnits } from "viem";
import { paymentReference } from "../lib/payments";
import { PAYMENT_TOKENS } from "../lib/tokens";

const sender = "0x2222222222222222222222222222222222222222";
const recipient = "0x1234567890123456789012345678901234567890";
const txHash = `0x${"ab".repeat(32)}`;

type Token = "MON" | "USDC";
type WalletMode = "success" | "rejected" | "transaction-error";

async function auth(request: APIRequestContext) {
  const response = await request.post("http://127.0.0.1:3101/auth/v1/signup", { data: {} });
  return { Authorization: `Bearer ${(await response.json()).access_token}` };
}

async function createStoredPayment(
  request: APIRequestContext,
  token: Token,
  amount: string,
  expiry = "",
) {
  const response = await request.post("/api/payments", {
    headers: await auth(request),
    data: {
      amount,
      recipient,
      recipientName: "Ada Studio",
      description: "Stored payment test",
      expiry,
      token,
      network: 10143,
      clientRequestId: randomUUID(),
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).payment as { id: string };
}

async function installWallet(
  page: Page,
  options: {
    mode?: WalletMode;
    nativeBalance?: bigint;
    usdcBalance?: bigint;
  } = {},
) {
  const mode = options.mode ?? "success";
  const nativeBalance = options.nativeBalance ?? parseUnits("10", 18);
  const usdcBalance = options.usdcBalance ?? parseUnits("1000", 6);
  await page.addInitScript(
    ({ sender, txHash, mode }) => {
      let connected = false;
      const listeners: Record<string, ((data: unknown) => void)[]> = {};
      Object.defineProperty(window, "ethereum", {
        value: {
          isMetaMask: true,
          on(event: string, callback: (data: unknown) => void) {
            (listeners[event] ||= []).push(callback);
          },
          removeListener(event: string, callback: (data: unknown) => void) {
            listeners[event] = (listeners[event] || []).filter((item) => item !== callback);
          },
          async request({ method, params }: { method: string; params?: unknown[] }) {
            if (method === "eth_chainId") {
              sessionStorage.setItem("test-chain-id", "0x279f");
              return "0x279f";
            }
            if (method === "eth_accounts") return connected ? [sender] : [];
            if (method === "eth_requestAccounts") {
              connected = true;
              return [sender];
            }
            if (method === "wallet_requestPermissions") return [{ parentCapability: "eth_accounts" }];
            if (method === "wallet_getCapabilities") return {};
            if (method === "eth_sendTransaction") {
              if (mode === "rejected")
                throw Object.assign(new Error("User rejected the request"), { code: 4001 });
              if (mode === "transaction-error") throw new Error("Transaction submission failed");
              sessionStorage.setItem("test-sent-transaction", JSON.stringify(params?.[0]));
              sessionStorage.setItem(
                "test-send-count",
                String(Number(sessionStorage.getItem("test-send-count") || "0") + 1),
              );
              return txHash;
            }
            throw new Error(`Unexpected test wallet method: ${method}`);
          },
        },
      });
    },
    { sender, txHash, mode },
  );
  await page.route("https://testnet-rpc.monad.xyz/**", async (route) => {
    const payload = route.request().postDataJSON();
    const respond = (call: { id: number; method: string }) => {
      let result: string;
      switch (call.method) {
        case "eth_chainId": result = "0x279f"; break;
        case "eth_gasPrice": result = "0x1"; break;
        case "eth_getBalance": result = `0x${nativeBalance.toString(16)}`; break;
        case "eth_estimateGas": result = "0x10000"; break;
        case "eth_call": result = `0x${usdcBalance.toString(16).padStart(64, "0")}`; break;
        default:
          return { jsonrpc: "2.0", id: call.id, error: { code: -32601, message: call.method } };
      }
      return { jsonrpc: "2.0", id: call.id, result };
    };
    await route.fulfill({ json: Array.isArray(payload) ? payload.map(respond) : respond(payload) });
  });
}

async function connectAndReview(page: Page) {
  await page.getByRole("main").getByRole("button", { name: "Connect Wallet" }).click();
  await page.getByRole("button", { name: "Browser wallet", exact: true }).click();
  await page.getByRole("checkbox").check();
}

test("stored MON submits the exact recipient, amount, reference and chain once", async ({ page, request }) => {
  await installWallet(page);
  const payment = await createStoredPayment(request, "MON", "0.25");
  await page.goto(`/pay/${payment.id}`);
  await connectAndReview(page);
  await page.getByRole("button", { name: "Pay 0.25 MON", exact: true }).click();
  await expect(page.getByText(/Secure server verification is not enabled yet/)).toBeVisible();
  const sent = await page.evaluate(() => JSON.parse(sessionStorage.getItem("test-sent-transaction") || "{}"));
  expect(sent.to.toLowerCase()).toBe(recipient.toLowerCase());
  expect(BigInt(sent.value)).toBe(parseUnits("0.25", 18));
  expect(sent.data).toBe(paymentReference(payment.id));
  expect(await page.evaluate(() => sessionStorage.getItem("test-chain-id"))).toBe("0x279f");
  await page.reload();
  await expect(page.getByText(/Secure server verification is not enabled yet/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Pay 0.25 MON" })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("test-send-count"))).toBe("1");
});

test("stored USDC submits exact transfer calldata to the verified contract", async ({ page, request }) => {
  await installWallet(page);
  const payment = await createStoredPayment(request, "USDC", "12.345678");
  await page.goto(`/pay/${payment.id}`);
  await connectAndReview(page);
  await page.getByRole("button", { name: "Pay 12.345678 USDC", exact: true }).click();
  await expect(page.getByText(/Secure server verification is not enabled yet/)).toBeVisible();
  const sent = await page.evaluate(() => JSON.parse(sessionStorage.getItem("test-sent-transaction") || "{}"));
  expect(sent.to).toBe(PAYMENT_TOKENS.USDC.address);
  expect(BigInt(sent.value ?? "0x0")).toBe(BigInt(0));
  const decoded = decodeFunctionData({ abi: erc20Abi, data: sent.data });
  expect(decoded.functionName).toBe("transfer");
  expect(decoded.args).toEqual([recipient, parseUnits("12.345678", 6)]);
  expect(await page.evaluate(() => sessionStorage.getItem("test-chain-id"))).toBe("0x279f");
});

for (const scenario of [
  { name: "insufficient MON payment balance", token: "MON" as const, amount: "1", nativeBalance: BigInt(0), usdcBalance: parseUnits("1000", 6), message: "Not enough testnet MON" },
  { name: "insufficient USDC token balance", token: "USDC" as const, amount: "1", nativeBalance: parseUnits("1", 18), usdcBalance: BigInt(0), message: "Not enough testnet USDC" },
  { name: "insufficient MON gas for USDC", token: "USDC" as const, amount: "1", nativeBalance: BigInt(0), usdcBalance: parseUnits("1000", 6), message: "Not enough testnet MON for the network fee" },
]) test(`blocks ${scenario.name}`, async ({ page, request }) => {
  await installWallet(page, scenario);
  const payment = await createStoredPayment(request, scenario.token, scenario.amount);
  await page.goto(`/pay/${payment.id}`);
  await connectAndReview(page);
  await page.getByRole("button", { name: `Pay ${scenario.amount} ${scenario.token}` }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(scenario.message);
  expect(await page.evaluate(() => sessionStorage.getItem("test-send-count"))).toBeNull();
});

for (const mode of ["rejected", "transaction-error"] as const)
  test(`surfaces ${mode} without recording a submission`, async ({ page, request }) => {
    await installWallet(page, { mode });
    const payment = await createStoredPayment(request, "MON", "0.25");
    await page.goto(`/pay/${payment.id}`);
    await connectAndReview(page);
    await page.getByRole("button", { name: "Pay 0.25 MON" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem("test-send-count"))).toBeNull();
    await expect(page.getByRole("button", { name: "Pay 0.25 MON" })).toBeEnabled();
  });

test("expired stored request never offers a wallet transaction", async ({ page, request }) => {
  await installWallet(page);
  const expiry = new Date(Date.now() + 2_000).toISOString();
  const payment = await createStoredPayment(request, "MON", "0.25", expiry);
  await page.goto(`/pay/${payment.id}`);
  await expect(page.getByText("Request expired")).toBeVisible({ timeout: 8_000 });
  await expect(page.getByRole("button", { name: "Pay 0.25 MON" })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("test-send-count"))).toBeNull();
});

test("stored expiry countdown uses the persisted timestamp across refresh", async ({ page, request }) => {
  const expiry = new Date(Date.now() + 65_000).toISOString();
  const payment = await createStoredPayment(request, "MON", "0.25", expiry);
  await page.goto(`/pay/${payment.id}`);
  const countdown = page.locator(".countdown");
  await expect(page.getByText("Payment expires in", { exact: true })).toBeVisible();
  await expect(countdown).toBeVisible();
  const seconds = (label: string | null) => {
    const values = label?.match(/\d+/g)?.map(Number) ?? [];
    return values.length === 4
      ? values[0] * 86_400 + values[1] * 3_600 + values[2] * 60 + values[3]
      : 0;
  };
  await expect.poll(async () => seconds(await countdown.getAttribute("aria-label"))).toBeGreaterThan(0);
  const first = await countdown.getAttribute("aria-label");
  await page.waitForTimeout(1_200);
  await page.reload();
  await expect(countdown).toBeVisible();
  await expect.poll(async () => seconds(await countdown.getAttribute("aria-label"))).toBeGreaterThan(0);
  const second = await countdown.getAttribute("aria-label");
  expect(seconds(second)).toBeLessThan(seconds(first));
});
