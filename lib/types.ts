import type { Address, Hash } from "viem";

export type PaymentStatus =
  "unpaid" | "signing" | "pending" | "confirmed" | "failed" | "expired";
export type TokenSymbol = "MON" | "USDC";
export interface PaymentRequest {
  id: string;
  recipient: Address;
  recipientName: string;
  amount: string;
  token: TokenSymbol;
  description: string;
  network: number;
  expiresAt: number | null;
  status: PaymentStatus;
  createdAt: number;
}
export interface TransactionReceipt {
  transactionHash: Hash;
  sender: Address;
  recipient: Address;
  amount: string;
  token: TokenSymbol;
  network: number;
  timestamp: number;
  status: "confirmed";
}
export interface PaymentDraft {
  amount: string;
  recipient: string;
  recipientName: string;
  description: string;
  expiry: string;
}
