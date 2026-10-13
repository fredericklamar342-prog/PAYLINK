import { test, expect } from "@playwright/test";
import { hashTypedData, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { settlementTypedData, verifySettlementProof } from "../lib/settlement-proof";
import type { PaymentRequest } from "../lib/types";

// Public test key, never funded or used outside local signature tests.
const payer = privateKeyToAccount(`0x${"01".repeat(32)}`);
const identity = { deploymentId: "paylink-staging-v1", canonicalOrigin: "https://staging.example.invalid" };
const hash: Hash = `0x${"ab".repeat(32)}`;
const request: PaymentRequest = {
  id: "abcdefab-1111-4111-8111-111111111111", recipient: "0x2222222222222222222222222222222222222222",
  amount: "1.234567", token: "USDC", network: 10143, status: "unpaid",
  recipientName: "", description: "Test", createdAt: 1, expiresAt: null,
};

test("proof accepts exact amounts for both tokens and canonicalizes UUID casing", async () => {
  for (const payment of [request, { ...request, token: "MON" as const, amount: "0.000000000000000001" }]) {
    const data = settlementTypedData(identity, payment, hash);
    expect(data.message.amountAtomic).toBe(payment.token === "MON" ? BigInt(1) : BigInt(1234567));
    const signature = await payer.signTypedData(data);
    expect(await verifySettlementProof(identity, payment, hash, signature, payer.address)).toBe(hashTypedData(data));
    expect(settlementTypedData(identity, { ...payment, id: payment.id.toUpperCase() }, hash)).toEqual(data);
  }
});

test("proof rejects replay across every signed request and deployment field", async () => {
  const signature = await payer.signTypedData(settlementTypedData(identity, request, hash));
  for (const changed of [
    { ...request, id: "bbbbbbbb-1111-4111-8111-111111111111" },
    { ...request, amount: "1.234568" },
    { ...request, token: "MON" as const },
    { ...request, recipient: payer.address },
    { ...request, network: 143 },
  ]) expect(await verifySettlementProof(identity, changed, hash, signature, payer.address)).toBeNull();
  for (const changed of [
    { ...identity, deploymentId: "production" },
    { ...identity, canonicalOrigin: "https://other.example.invalid" },
  ]) expect(await verifySettlementProof(changed, request, hash, signature, payer.address)).toBeNull();
  expect(await verifySettlementProof(identity, request, `0x${"cd".repeat(32)}`, signature, payer.address)).toBeNull();
  expect(await verifySettlementProof(identity, request, hash, signature, request.recipient)).toBeNull();
  expect(await verifySettlementProof(identity, request, hash, "0x00", payer.address)).toBeNull();
  expect(await verifySettlementProof(identity, request, hash, `0x${"00".repeat(65)}`, payer.address)).toBeNull();
});

test("signing rejects ambiguous origins, missing identity and rounded amounts", () => {
  for (const canonicalOrigin of ["", "http://example.invalid", "https://EXAMPLE.invalid", "https://example.invalid/", "https://example.invalid/path", "https://user:pass@example.invalid", "https://example.invalid?x=1", "https://example.invalid#x"]) {
    expect(() => settlementTypedData({ ...identity, canonicalOrigin }, request, hash)).toThrow();
  }
  expect(() => settlementTypedData({ ...identity, deploymentId: "" }, request, hash)).toThrow();
  for (const amount of ["1.2345671", "0", "1e3", "-1"]) {
    expect(() => settlementTypedData(identity, { ...request, amount }, hash)).toThrow();
  }
});
