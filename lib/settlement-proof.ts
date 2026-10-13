import { getAddress, hashTypedData, keccak256, parseUnits, recoverTypedDataAddress, stringToHex, type Address, type Hash, type Hex } from "viem";
import { validAmount } from "./payments";
import { isStoredPaymentId } from "./stored-payments";
import { PAYMENT_TOKENS } from "./tokens";
import type { PaymentRequest } from "./types";

export interface SettlementIdentity {
  deploymentId: string;
  canonicalOrigin: string;
}

const types = {
  PayLinkSettlement: [
    { name: "requestId", type: "string" },
    { name: "transactionHash", type: "bytes32" },
    { name: "chainId", type: "uint256" },
    { name: "token", type: "string" },
    { name: "recipient", type: "address" },
    { name: "amountAtomic", type: "uint256" },
  ],
} as const;

// Public signing schema shared by a future wallet flow and server verifier.
// The server must supply its configured identity and independently loaded request.
export function settlementTypedData(identity: SettlementIdentity, request: PaymentRequest, transactionHash: Hash) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(identity.deploymentId))
    throw new Error("Invalid settlement deployment identifier.");
  const origin = new URL(identity.canonicalOrigin);
  if (origin.protocol !== "https:" || origin.origin !== identity.canonicalOrigin ||
      identity.canonicalOrigin !== identity.canonicalOrigin.toLowerCase())
    throw new Error("Settlement requires an exact lowercase HTTPS origin.");
  if (!isStoredPaymentId(request.id) || request.network !== 10143 ||
      !validAmount(request.amount, request.token) || !/^0x[0-9a-fA-F]{64}$/.test(transactionHash))
    throw new Error("Invalid settlement request or transaction hash.");
  return {
    domain: {
      name: "PayLink Stored Payment", version: "1", chainId: 10143,
      salt: keccak256(stringToHex(`paylink-settlement:${identity.deploymentId}:${identity.canonicalOrigin}`)),
    },
    types,
    primaryType: "PayLinkSettlement" as const,
    message: {
      requestId: request.id.toLowerCase(), transactionHash,
      chainId: BigInt(10143), token: request.token,
      recipient: getAddress(request.recipient),
      amountAtomic: parseUnits(request.amount, PAYMENT_TOKENS[request.token].decimals),
    },
  };
}

// This proves authorization by the EOA only. Chain finality, transfer matching,
// historical EOA code checks and database replay protection remain separate gates.
export async function verifySettlementProof(
  identity: SettlementIdentity, request: PaymentRequest, transactionHash: Hash,
  signature: Hex, chainPayer: Address,
): Promise<Hash | null> {
  try {
    if (!/^0x(?:[0-9a-fA-F]{2}){65}$/.test(signature)) return null;
    const data = settlementTypedData(identity, request, transactionHash);
    const signer = await recoverTypedDataAddress({ ...data, signature });
    return getAddress(signer) === getAddress(chainPayer) ? hashTypedData(data) : null;
  } catch {
    return null;
  }
}
