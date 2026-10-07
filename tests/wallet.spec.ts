import { test, expect, type Page } from "@playwright/test";
import { createPayment, paymentReference, receiptPath } from "../lib/payments";
import { parseUnits } from "viem";

// These providers and RPC responses exist only in the test runner, never in the app.
const sender = "0x2222222222222222222222222222222222222222";
const txHash = `0x${"ab".repeat(32)}`;
const blockHash = `0x${"cd".repeat(32)}`;
const draft = {
  amount: "0.25",
  recipient: "0x1234567890123456789012345678901234567890",
  recipientName: "Ada Studio",
  description: "Brand identity",
  expiry: "",
};
type Mode = "success" | "rejected" | "pending" | "failed" | "mismatch";

async function setup(page: Page, mode: Mode = "success", wrongChain = false) {
  const payment = createPayment(draft);
  await page.addInitScript(
    ({ sender, txHash, mode, wrongChain }) => {
      let connected = false;
      let chain = wrongChain ? "0x1" : "0x279f";
      const listeners: Record<string, ((data: unknown) => void)[]> = {};
      Object.defineProperty(window, "ethereum", {
        value: {
          isMetaMask: true,
          on(event: string, callback: (data: unknown) => void) {
            (listeners[event] ||= []).push(callback);
          },
          removeListener(event: string, callback: (data: unknown) => void) {
            listeners[event] = (listeners[event] || []).filter(
              (c) => c !== callback,
            );
          },
          async request({
            method,
            params,
          }: {
            method: string;
            params?: { chainId: string }[];
          }) {
            if (method === "eth_chainId") return chain;
            if (method === "eth_accounts") return connected ? [sender] : [];
            if (method === "eth_requestAccounts") {
              connected = true;
              return [sender];
            }
            if (method === "wallet_switchEthereumChain") {
              chain = params![0].chainId;
              (listeners.chainChanged || []).forEach((c) => c(chain));
              return null;
            }
            if (method === "wallet_requestPermissions")
              return [{ parentCapability: "eth_accounts" }];
            if (method === "wallet_getCapabilities") return {};
            if (method === "eth_sendTransaction") {
              if (mode === "rejected")
                throw Object.assign(new Error("User rejected the request"), {
                  code: 4001,
                });
              sessionStorage.setItem(
                "test-send-count",
                String(
                  Number(sessionStorage.getItem("test-send-count") || "0") + 1,
                ),
              );
              return txHash;
            }
            throw new Error(`Unexpected test wallet method: ${method}`);
          },
        },
      });
    },
    { sender, txHash, mode, wrongChain },
  );
  await page.route("https://testnet-rpc.monad.xyz/**", async (route) => {
    const body = route.request().postDataJSON();
    function respond(request: { id: number; method: string }) {
      let result: unknown;
      switch (request.method) {
        case "eth_chainId":
          result = "0x279f";
          break;
        case "eth_estimateGas":
          result = "0x10000";
          break;
        case "eth_gasPrice":
          result = "0x1";
          break;
        case "eth_getBalance":
          result = "0x56bc75e2d63100000";
          break;
        case "eth_getTransactionByHash":
          result = {
            hash: txHash,
            from: sender,
            to: mode === "mismatch" ? sender : payment.recipient,
            value: `0x${parseUnits(payment.amount, 18).toString(16)}`,
            input: paymentReference(payment.id),
            chainId: "0x279f",
            blockHash,
            blockNumber: "0x1",
            transactionIndex: "0x0",
            nonce: "0x0",
            gas: "0x10000",
            gasPrice: "0x1",
            type: "0x0",
            v: "0x1b",
            r: "0x1",
            s: "0x2",
          };
          break;
        case "eth_getTransactionReceipt":
          result =
            mode === "pending"
              ? null
              : {
                  transactionHash: txHash,
                  blockHash,
                  blockNumber: "0x1",
                  from: sender,
                  to: payment.recipient,
                  status: mode === "failed" ? "0x0" : "0x1",
                  transactionIndex: "0x0",
                  cumulativeGasUsed: "0x5208",
                  gasUsed: "0x5208",
                  effectiveGasPrice: "0x1",
                  logs: [],
                  logsBloom: `0x${"00".repeat(256)}`,
                  contractAddress: null,
                  type: "0x0",
                };
          break;
        case "eth_getBlockByHash":
          result = {
            hash: blockHash,
            number: "0x1",
            timestamp: "0x68e00000",
            transactions: [],
            gasLimit: "0x100000",
            gasUsed: "0x5208",
            size: "0x100",
            difficulty: "0x0",
            totalDifficulty: "0x0",
            extraData: "0x",
          };
          break;
        default:
          return {
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32601,
              message: `Unhandled fixture method ${request.method}`,
            },
          };
      }
      return { jsonrpc: "2.0", id: request.id, result };
    }
    await route.fulfill({
      json: Array.isArray(body) ? body.map(respond) : respond(body),
    });
  });
  return payment;
}
async function connect(page: Page) {
  await page.getByRole("button", { name: "Connect Wallet" }).last().click();
  await page
    .getByRole("button", { name: "Browser wallet", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
test("wallet switches chain, requires review, confirms and verifies receipt", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const payment = await setup(page, "success", true);
  await page.goto(`/pay/${payment.id}`);
  await connect(page);
  await page.getByRole("button", { name: "Switch network" }).last().click();
  await page
    .getByRole("button", { name: "Switch to Monad Testnet", exact: true })
    .click();
  const pay = page.getByRole("button", { name: "Pay 0.25 MON", exact: true });
  await expect(pay).toBeDisabled();
  await page.getByRole("checkbox").check();
  await pay.click();
  await expect(
    page.getByText("Payment verified", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View verified receipt" }).click();
  await expect(
    page.getByRole("heading", { name: "Payment complete." }),
  ).toBeVisible();
  await expect(page.getByText(txHash, { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/verified-receipt.png",
    fullPage: true,
  });
  await page.goto(`/pay/${payment.id}`);
  await expect(
    page.getByText("Payment verified", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pay 0.25 MON", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => sessionStorage.getItem("test-send-count")),
  ).toBe("1");
  expect(errors).toEqual([]);
});
for (const mode of ["rejected", "pending", "failed"] as const)
  test(`payment handles ${mode}`, async ({ page }) => {
    const payment = await setup(page, mode);
    await page.goto(`/pay/${payment.id}`);
    await connect(page);
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Pay 0.25 MON", exact: true })
      .click();
    if (mode === "rejected") {
      await expect(page.getByRole("main").getByRole("alert")).toContainText("Request declined");
      await expect(
        page.getByRole("button", { name: "Pay 0.25 MON", exact: true }),
      ).toBeEnabled();
    } else {
      await expect(
        page.getByText(
          mode === "failed" ? "Payment failed" : "Confirming onchain",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Pay 0.25 MON", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "View verified receipt" }),
      ).toHaveCount(0);
    }
  });
test("receipt rejects a transaction sent to a different recipient", async ({
  page,
}) => {
  const payment = await setup(page, "mismatch");
  await page.goto(receiptPath(payment.id, txHash));
  await expect(
    page.getByRole("heading", { name: "Payment not verified." }),
  ).toBeVisible();
  await expect(
    page.getByText("This transaction does not match this payment request."),
  ).toBeVisible();
});
