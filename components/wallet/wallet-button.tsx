"use client";
import { useRef, useState } from "react";
import {
  useConnection,
  useConnect,
  useConnectors,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { paymentChain } from "@/lib/chain";
import { shortAddress } from "@/lib/payments";
import { walletError } from "@/lib/transactions";
import { Icon } from "@/components/ui/icon";
import { CopyButton } from "@/components/ui/copy-button";

export function WalletButton({ primary = false }: { primary?: boolean }) {
  const { address, chainId, isConnected, isConnecting, isReconnecting } =
    useConnection();
  const connect = useConnect();
  const connectors = useConnectors();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const busy =
    connect.isPending ||
    switchChain.isPending ||
    isConnecting ||
    isReconnecting;
  const wrongChain = isConnected && chainId !== paymentChain.id;
  return (
    <>
      <button
        className={`button ${primary ? "primary full" : "secondary compact"}`}
        disabled={busy}
        onClick={() => {
          setError("");
          dialog.current?.showModal();
        }}
      >
        <Icon name="wallet" size={17} />
        {busy
          ? "Connecting…"
          : wrongChain
            ? "Switch network"
            : address
              ? shortAddress(address)
              : "Connect Wallet"}
      </button>
      <dialog
        ref={dialog}
        className="wallet-dialog"
        aria-labelledby="wallet-title"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <div className="dialog-heading">
          <h2 id="wallet-title">
            {isConnected ? "Your wallet" : "Connect your wallet"}
          </h2>
          <button
            className="icon-button"
            aria-label="Close wallet dialog"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <p className="muted">
          {isConnected
            ? "You stay in control of every payment."
            : "Choose a browser wallet. Connecting never moves your funds."}
        </p>
        {address ? (
          <div className="stack">
            <p className="address">{address}</p>
            <CopyButton value={address} label="Copy address" />
            <p className="network-line">
              <span className="network-glyph" />
              {wrongChain ? "Wrong network" : paymentChain.name}
            </p>
            {wrongChain && (
              <button
                className="button primary full"
                disabled={switchChain.isPending}
                onClick={async () => {
                  try {
                    await switchChain.mutateAsync({ chainId: paymentChain.id });
                    setError("");
                    dialog.current?.close();
                  } catch (e) {
                    setError(walletError(e));
                  }
                }}
              >
                {switchChain.isPending
                  ? "Switching…"
                  : "Switch to Monad Testnet"}
              </button>
            )}
            <button
              className="button secondary full"
              onClick={() => {
                disconnect.mutate();
                dialog.current?.close();
              }}
            >
              Disconnect wallet
            </button>
          </div>
        ) : (
          <div className="stack">
            {connectors.map((connector) => (
              <button
                className="button secondary full"
                key={connector.uid}
                disabled={busy}
                onClick={async () => {
                  setError("");
                  try {
                    if (!(await connector.getProvider())) {
                      setError(
                        "No browser wallet found. Install a wallet or open this link in your wallet’s browser.",
                      );
                      return;
                    }
                    await connect.mutateAsync({ connector });
                    dialog.current?.close();
                  } catch (e) {
                    setError(walletError(e));
                  }
                }}
              >
                <Icon name="wallet" />
                {busy
                  ? "Check your wallet…"
                  : connector.name === "Injected"
                    ? "Browser wallet"
                    : connector.name}
              </button>
            ))}
            <p className="small muted">
              On mobile, open PayLink in your wallet’s built-in browser. A
              browser extension is needed on desktop.
            </p>
          </div>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </dialog>
    </>
  );
}
