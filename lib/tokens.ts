import type { Address } from "viem";
import type { TokenSymbol } from "./types";

export const PAYMENT_CHAIN_ID = 10143;
export const PAYMENT_NETWORK_NAME = "Monad Testnet";
// Verified against Circle's USDC addresses and Monad's official testnet token list.
// https://developers.circle.com/stablecoins/usdc-contract-addresses
// https://github.com/monad-crypto/token-list/blob/main/tokenlist-testnet.json
export const PAYMENT_TOKENS = {
  MON: { symbol: "MON", decimals: 18, address: null },
  USDC: { symbol: "USDC", decimals: 6, address: "0x534b2f3A21130d7a60830c2Df862319e593943A3" as Address },
} as const;

export function isPaymentToken(value: unknown): value is TokenSymbol {
  return value === "MON" || value === "USDC";
}
