import { createPublicClient, http } from "viem";
import { monadTestnet } from "viem/chains";

// One explicit environment. Never silently switch a payment to mainnet.
export const paymentChain = monadTestnet;
export const publicClient = createPublicClient({
  chain: paymentChain,
  transport: http(paymentChain.rpcUrls.default.http[0], {
    timeout: 15_000,
    retryCount: 1,
  }),
});
export const transactionUrl = (hash: string) =>
  `${paymentChain.blockExplorers.default.url}/tx/${hash}`;
