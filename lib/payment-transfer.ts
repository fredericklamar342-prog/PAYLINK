import {
  encodeFunctionData,
  erc20Abi,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { paymentReference } from "./payments";
import { PAYMENT_TOKENS } from "./tokens";
import type { PaymentRequest } from "./types";

export interface PaymentTransfer {
  to: Address;
  value: bigint;
  data: Hex;
  amountAtomic: bigint;
}

// Exact wallet transaction required by SETTLEMENT_SPEC_V1. This stays pure so
// amount conversion and calldata can be tested without connecting a wallet.
export function buildPaymentTransfer(payment: PaymentRequest): PaymentTransfer {
  const token = PAYMENT_TOKENS[payment.token];
  const amountAtomic = parseUnits(payment.amount, token.decimals);
  if (payment.token === "MON")
    return {
      to: payment.recipient,
      value: amountAtomic,
      data: paymentReference(payment.id),
      amountAtomic,
    };
  return {
    to: PAYMENT_TOKENS.USDC.address,
    value: BigInt(0),
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [payment.recipient, amountAtomic],
    }),
    amountAtomic,
  };
}
