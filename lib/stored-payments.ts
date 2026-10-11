import { getAddress } from "viem";
import { validateDraft } from "./payments";
import type { PaymentDraft, PaymentRequest } from "./types";
import { isPaymentToken, PAYMENT_CHAIN_ID, PAYMENT_NETWORK_NAME } from "./tokens";

export const isStoredPaymentId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

export function parseCreateRequest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const fields = ["amount", "recipient", "recipientName", "description", "expiry", "clientRequestId", "token"];
  if (Object.keys(input).some((key) => ![...fields, "network"].includes(key)) ||
      fields.some((key) => typeof input[key] !== "string")) return null;
  if (!isPaymentToken(input.token) || input.network !== PAYMENT_CHAIN_ID) return null;
  if (!isStoredPaymentId(input.clientRequestId as string)) return null;
  const draft: PaymentDraft = {
    token: input.token,
    amount: input.amount as string,
    recipient: (input.recipient as string).trim(),
    recipientName: (input.recipientName as string).trim(),
    description: (input.description as string).trim(),
    expiry: input.expiry as string,
  };
  // Require an explicit timezone over the API; browser-local dates are converted first.
  if (draft.expiry && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(draft.expiry)) return null;
  if (Object.keys(validateDraft(draft)).length) return null;
  return { draft, clientRequestId: input.clientRequestId as string };
}

// Explicit allowlist; never serialize owner/session/idempotency fields to a payer.
export function publicPayment(value: unknown): PaymentRequest | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !isStoredPaymentId(row.id) ||
      typeof row.amount !== "string" || typeof row.recipient_wallet !== "string" ||
      typeof row.recipient_name !== "string" || typeof row.description !== "string" ||
      !isPaymentToken(row.token_symbol) || row.network !== PAYMENT_NETWORK_NAME || row.status !== "pending" ||
      typeof row.created_at !== "string" ||
      (row.expires_at !== null && typeof row.expires_at !== "string")) return null;
  const createdAt = Date.parse(row.created_at);
  const expiresAt = row.expires_at === null ? null : Date.parse(row.expires_at as string);
  if (!Number.isFinite(createdAt) || (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= createdAt))) return null;
  if (Object.keys(validateDraft({ token: row.token_symbol, amount: row.amount, recipient: row.recipient_wallet,
    recipientName: row.recipient_name, description: row.description, expiry: "" }, 0)).length) return null;
  // DB pending means an unpaid request, not the UI's pending on-chain transaction state.
  return { id: row.id, amount: row.amount, recipient: getAddress(row.recipient_wallet),
    recipientName: row.recipient_name, description: row.description, token: row.token_symbol,
    network: PAYMENT_CHAIN_ID, status: "unpaid", createdAt, expiresAt };
}
