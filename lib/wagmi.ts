import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { paymentChain } from "./chain";

export function makeWalletConfig() {
  return createConfig({
    chains: [paymentChain],
    connectors: [injected()],
    ssr: true,
    transports: { [paymentChain.id]: http() },
  });
}
