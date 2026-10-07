import {
  getAddress,
  isAddress,
  keccak256,
  parseUnits,
  stringToHex,
  toBytes,
  zeroAddress,
} from "viem";
import { paymentChain } from "./chain";
import type { PaymentDraft, PaymentRequest } from "./types";

export function shortAddress(address: string) {
  return address.length > 16
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}
export function displayAmount(amount: string) {
  if (!/^\d+(\.\d+)?$/.test(amount)) return "0.00";
  const [whole, decimal = ""] = amount.split(".");
  return `${whole}.${decimal.padEnd(2, "0")}`;
}
export function validAmount(amount: string) {
  if (!/^(0|[1-9]\d{0,8})(\.\d{1,18})?$/.test(amount)) return false;
  return parseUnits(amount, 18) > BigInt(0);
}
export function validateDraft(draft: PaymentDraft, now = Date.now()) {
  const errors: Partial<Record<keyof PaymentDraft, string>> = {};
  if (!validAmount(draft.amount))
    errors.amount =
      "Enter an amount greater than zero, with up to 18 decimal places.";
  if (
    !isAddress(draft.recipient) ||
    draft.recipient.toLowerCase() === zeroAddress
  )
    errors.recipient =
      "Enter a valid recipient wallet address (0x followed by 40 characters).";
  if (!draft.description.trim() || draft.description.trim().length > 140)
    errors.description = "Add a payment description of 1–140 characters.";
  if (draft.recipientName.trim().length > 50)
    errors.recipientName = "Keep the display name under 51 characters.";
  if (
    draft.expiry &&
    (!Number.isFinite(Date.parse(draft.expiry)) ||
      Date.parse(draft.expiry) <= now)
  )
    errors.expiry = "Choose an expiry in the future.";
  return errors;
}

// Versioned, self-contained URL payload. Public, unsigned request data, not proof of identity.
export function createPayment(draft: PaymentDraft): PaymentRequest {
  if (Object.keys(validateDraft(draft)).length)
    throw new Error("Check the payment details.");
  const payload = {
    v: 1,
    r: getAddress(draft.recipient),
    n: draft.recipientName.trim(),
    a: draft.amount,
    d: draft.description.trim(),
    c: paymentChain.id,
    t: Date.now(),
    e: draft.expiry ? Date.parse(draft.expiry) : null,
    u: crypto.randomUUID(),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const id = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const request = decodePayment(id);
  if (!request)
    throw new Error(
      "Could not create this request. Check the details and try again.",
    );
  return request;
}
export function decodePayment(id: string): PaymentRequest | null {
  try {
    if (id.length > 1800 || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(atob(id.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
        c.charCodeAt(0),
      ),
    );
    const p: unknown = JSON.parse(text);
    if (!p || typeof p !== "object") return null;
    const x = p as Record<string, unknown>;
    if (
      x.v !== 1 ||
      x.c !== paymentChain.id ||
      typeof x.r !== "string" ||
      !isAddress(x.r) ||
      x.r.toLowerCase() === zeroAddress ||
      typeof x.a !== "string" ||
      !validAmount(x.a) ||
      typeof x.n !== "string" ||
      x.n.length > 50 ||
      typeof x.d !== "string" ||
      !x.d.trim() ||
      x.d.length > 140 ||
      typeof x.t !== "number" ||
      !Number.isSafeInteger(x.t) ||
      x.t < 0 ||
      x.t > 8640000000000000 ||
      (x.e !== null &&
        (typeof x.e !== "number" ||
          !Number.isSafeInteger(x.e) ||
          x.e <= x.t ||
          x.e > 8640000000000000)) ||
      typeof x.u !== "string" ||
      !/^[a-f0-9-]{36}$/.test(x.u)
    )
      return null;
    return {
      id,
      recipient: getAddress(x.r),
      recipientName: x.n,
      amount: x.a,
      token: "MON",
      description: x.d,
      network: paymentChain.id,
      createdAt: x.t,
      expiresAt: x.e as number | null,
      status: "unpaid",
    };
  } catch {
    return null;
  }
}
export const paymentReference = (id: string) =>
  stringToHex(`PayLink:${keccak256(toBytes(id))}`);
export const isExpired = (payment: PaymentRequest, now = Date.now()) =>
  payment.expiresAt !== null && payment.expiresAt <= now;
export const receiptPath = (id: string, hash: string) =>
  `/success?request=${encodeURIComponent(id)}&tx=${encodeURIComponent(hash)}`;
