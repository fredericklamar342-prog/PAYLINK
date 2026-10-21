"use client";
import { useId, useRef, useState } from "react";
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
import { Feedback } from "@/components/ui/feedback";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { animateFeedback } from "@/components/ui/use-feedback-motion";

export function WalletButton({ primary = false }: { primary?: boolean }) {
  const { address, chainId, isConnected, isConnecting, isReconnecting } =
    useConnection();
  const connect = useConnect();
  const connectors = useConnectors();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
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
        aria-haspopup="dialog"
        disabled={busy}
        onClick={() => {
          setError("");
          dialog.current?.showModal();
          if (dialog.current) animateFeedback(dialog.current, 6);
        }}
      >
        {busy ? <LoadingIndicator /> : <Icon name="wallet" size={17} />}
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
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <div className="wallet-dialog-mark" aria-hidden="true">
          <Icon name="wallet" size={26} />
        </div>
        <div className="dialog-heading">
          <h2 id={titleId}>
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
        <p className="muted" id={descriptionId}>
          {isConnected
            ? "You stay in control of every payment."
            : "Choose a browser wallet. Connecting never moves your funds."}
        </p>
        <p className={`wallet-context ${wrongChain ? "wallet-context-warning" : ""}`}>
          <span className="network-glyph" aria-hidden="true" />
          {wrongChain ? "Switch to Monad Testnet to make this payment." : "Monad Testnet · Test tokens only"}
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
                {switchChain.isPending && <LoadingIndicator />}
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
                {busy ? <LoadingIndicator /> : <Icon name="wallet" />}
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
        <Feedback message={error} />
        <p className="wallet-assurance"><Icon name="shield" size={15} /> Every payment needs your approval.</p>
      </dialog>
    </>
  );
}
