"use client";
import { useRef, useState } from "react";
import { useConnection, useWalletClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { parseUnits, type Hash } from "viem";
import { paymentChain, publicClient } from "@/lib/chain";
import { isExpired, paymentReference } from "@/lib/payments";
import {
  readPaymentHash,
  savePaymentHash,
  usePaymentHash,
} from "@/lib/browser-state";
import {
  VerificationError,
  verifyPayment,
  walletError,
} from "@/lib/transactions";
import type { PaymentRequest } from "@/lib/types";

export function useVerifiedReceipt(
  payment: PaymentRequest | null,
  hash?: Hash,
) {
  return useQuery({
    queryKey: ["verified-payment", payment?.id, hash],
    queryFn: () => verifyPayment(payment!, hash!),
    enabled: !!payment && !!hash,
    retry: false,
    refetchInterval: (query) =>
      query.state.data || query.state.error instanceof VerificationError
        ? false
        : 4000,
  });
}
export function usePayment(payment: PaymentRequest) {
  const { address, chainId } = useConnection();
  const { data: wallet } = useWalletClient();
  const storedHash = usePaymentHash(payment.id);
  const [memoryHash, setMemoryHash] = useState<Hash>();
  const hash = memoryHash || storedHash;
  const verification = useVerifiedReceipt(payment, hash);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function pay() {
    if (inFlight.current || hash) return;
    inFlight.current = true;
    setError("");
    setSigning(true);
    try {
      if (!navigator.locks)
        throw new Error(
          "Secure browser storage is required. Open this page over HTTPS or localhost.",
        );
      await navigator.locks.request(
        `paylink:${payment.id}`,
        { ifAvailable: true },
        async (lock) => {
          if (!lock || readPaymentHash(payment.id))
            throw new Error(
              "This request already has a payment in progress. Check the existing transaction before paying again.",
            );
          if (isExpired(payment))
            throw new Error(
              "This request has expired. Ask the recipient for a new link.",
            );
          if (
            !wallet ||
            !address ||
            chainId !== paymentChain.id ||
            (await wallet.getChainId()) !== paymentChain.id
          )
            throw new Error(
              "Switch your wallet to Monad Testnet before paying.",
            );
          // Check persistence before signing; keep a returned hash in memory even if storage later fails.
          localStorage.setItem("paylink:storage-check", "ok");
          localStorage.removeItem("paylink:storage-check");
          const value = parseUnits(payment.amount, 18);
          const data = paymentReference(payment.id);
          const [gas, gasPrice, balance] = await Promise.all([
            publicClient.estimateGas({
              account: address,
              to: payment.recipient,
              value,
              data,
            }),
            publicClient.getGasPrice(),
            publicClient.getBalance({ address }),
          ]);
          if (balance < value + gas * gasPrice)
            throw new Error(
              "Not enough testnet MON. Leave a little extra for the network fee.",
            );
          if (isExpired(payment))
            throw new Error(
              "This request has expired. Ask the recipient for a new link.",
            );
          const nextHash = await wallet.sendTransaction({
            account: address,
            chain: paymentChain,
            to: payment.recipient,
            value,
            data,
          });
          setMemoryHash(nextHash);
          try {
            savePaymentHash(payment.id, nextHash);
          } catch {
            setError(
              "Payment submitted. Keep this page open: your browser could not save the transaction for later.",
            );
          }
        },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setError(
        /expired|already has|Secure browser|Not enough/.test(message)
          ? message
          : walletError(e),
      );
    } finally {
      setSigning(false);
      inFlight.current = false;
    }
  }
  return {
    hash,
    signing,
    error,
    pay,
    verification,
    ready: !!wallet && chainId === paymentChain.id,
  };
}
