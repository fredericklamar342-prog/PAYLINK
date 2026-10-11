import "server-only";
import type { Address, Hash, Hex } from "viem";
import type { TokenSymbol } from "@/lib/types";

// Boundary between public submission handling, chain verification, and the
// disabled database settlement executor. No function in this module writes to
// Supabase or treats a client-supplied hash as proof of payment.
export interface SettlementSubmission {
  transactionHash: Hash;
  signature: Hex;
}

export interface VerifiedSettlementEvidence {
  requestId: string;
  transactionHash: Hash;
  payer: Address;
  chainId: 10143;
  blockNumber: bigint;
  blockHash: Hash;
  blockTime: Date;
  token: TokenSymbol;
  tokenAddress: Address | null;
  amountAtomic: bigint;
  proofScheme: "eip712_eoa";
  proofDigest: Hash;
  proofSignature: Hex;
  verificationVersion: 1;
}

export interface SettlementVerificationDependencies {
  loadAuthoritativeRequest(requestId: string): Promise<unknown>;
  verifyWithPrimaryRpc(request: unknown, submission: SettlementSubmission): Promise<VerifiedSettlementEvidence>;
  verifyWithIndependentRpc(request: unknown, evidence: VerifiedSettlementEvidence): Promise<void>;
  recordWithRestrictedExecutor(evidence: VerifiedSettlementEvidence): Promise<void>;
}

export function parseSettlementSubmission(value: unknown): SettlementSubmission | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["transactionHash", "signature"].includes(key))) return null;
  if (typeof input.transactionHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(input.transactionHash)) return null;
  if (typeof input.signature !== "string" || !/^0x(?:[0-9a-fA-F]{2}){65}$/.test(input.signature)) return null;
  return { transactionHash: input.transactionHash as Hash, signature: input.signature as Hex };
}
