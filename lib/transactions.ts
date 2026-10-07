import { parseUnits, type Hash } from "viem";
import { publicClient, paymentChain } from "./chain";
import { paymentReference } from "./payments";
import type { PaymentRequest, TransactionReceipt } from "./types";

export class VerificationError extends Error {}
export async function verifyPayment(
  payment: PaymentRequest,
  hash: Hash,
): Promise<TransactionReceipt> {
  const [transaction, receipt] = await Promise.all([
    publicClient.getTransaction({ hash }),
    publicClient.getTransactionReceipt({ hash }),
  ]);
  if (receipt.status !== "success")
    throw new VerificationError(
      "This transaction failed. No payment was completed.",
    );
  if (
    transaction.chainId !== paymentChain.id ||
    transaction.to?.toLowerCase() !== payment.recipient.toLowerCase() ||
    transaction.value !== parseUnits(payment.amount, 18) ||
    transaction.input !== paymentReference(payment.id)
  )
    throw new VerificationError(
      "This transaction does not match this payment request.",
    );
  const block = await publicClient.getBlock({ blockHash: receipt.blockHash });
  return {
    transactionHash: hash,
    sender: transaction.from,
    recipient: payment.recipient,
    amount: payment.amount,
    token: payment.token,
    network: payment.network,
    timestamp: Number(block.timestamp) * 1000,
    status: "confirmed",
  };
}
export function walletError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (/reject|denied|4001/.test(message))
    return "Request declined in your wallet. You can try again when you’re ready.";
  if (/insufficient|exceeds.*balance/.test(message))
    return "Not enough testnet MON. Leave a little extra for the network fee.";
  if (/chain|network/.test(message))
    return "Your wallet is on a different network. Switch to Monad Testnet and try again.";
  if (/provider|not found|not installed/.test(message))
    return "No browser wallet found. Install a wallet or open this link in your wallet’s browser.";
  return "We couldn’t complete the wallet request. Check your wallet and connection, then try again.";
}
