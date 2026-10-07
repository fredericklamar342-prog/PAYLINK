"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Hash } from "viem";
import { decodePayment, displayAmount } from "@/lib/payments";
import { paymentChain, transactionUrl } from "@/lib/chain";
import { VerificationError } from "@/lib/transactions";
import { useVerifiedReceipt } from "./use-payment";
import { PayLinkLogo } from "@/components/branding/logo";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { CopyButton } from "@/components/ui/copy-button";
export function ReceiptPage() {
  const params = useSearchParams();
  const payment = decodePayment(params.get("request") || "");
  const tx = params.get("tx") || "";
  const hash = /^0x[a-fA-F0-9]{64}$/.test(tx) ? (tx as Hash) : undefined;
  const verification = useVerifiedReceipt(payment, hash);
  const [feedback, setFeedback] = useState("");
  if (!payment || !hash)
    return (
      <div className="empty-state">
        <span className="section-kicker">Your proof of payment</span>
        <h1>
          A receipt starts
          <br />
          with a payment.
        </h1>
        <p>
          After an onchain payment is confirmed, your verified receipt appears
          here. Open a payment link to get started.
        </p>
        <Link className="button primary" href="/create">
          Create a Payment Link
        </Link>
      </div>
    );
  if (!verification.data)
    return (
      <div className="empty-state">
        <Icon name="shield" size={32} />
        <h1>
          {verification.error instanceof VerificationError
            ? "Payment not verified."
            : "Checking your payment."}
        </h1>
        <p role="status">
          {verification.error instanceof VerificationError
            ? verification.error.message
            : verification.isError
              ? "We can’t confirm this transaction yet. It may be pending, or the network may be unavailable. No completed receipt has been issued."
              : "Matching the transaction to your request on Monad. This can take a moment."}
        </p>
        <div className="stack">
          <button
            className="button primary"
            onClick={() => verification.refetch()}
            disabled={verification.isFetching}
          >
            Check again
          </button>
          <a
            href={transactionUrl(hash)}
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            View transaction
          </a>
          <Link className="text-link" href={`/pay/${payment.id}`}>
            Back to payment request
          </Link>
        </div>
      </div>
    );
  const receipt = verification.data;
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({
          title: "PayLink verified receipt",
          url: window.location.href,
        });
      else {
        await navigator.clipboard.writeText(window.location.href);
        setFeedback("Receipt link copied.");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setFeedback(
          "Sharing is unavailable. Copy the address from your browser.",
        );
    }
  }
  return (
    <>
      <div className="receipt-title">
        <span className="success-check">
          <Icon name="check" size={26} />
        </span>
        <h1>Payment complete.</h1>
        <p>One less thing to think about.</p>
      </div>
      <article className="receipt-paper">
        <div className="row-between">
          <PayLinkLogo />
          <StatusBadge status="confirmed" />
        </div>
        <div className="receipt-amount">
          {displayAmount(receipt.amount)} <span>{receipt.token}</span>
        </div>
        <p className="receipt-purpose">{payment.description}</p>
        <div className="ticket-perforation" />
        <dl className="details-list">
          <div>
            <dt>Paid to</dt>
            <dd>{payment.recipientName || "Recipient wallet"}</dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>{paymentChain.name}</dd>
          </div>
          <div>
            <dt>Confirmed at</dt>
            <dd>
              {new Date(receipt.timestamp)
                .toISOString()
                .replace("T", " ")
                .slice(0, 19)}{" "}
              UTC
            </dd>
          </div>
          <div className="address-detail">
            <dt>Sender</dt>
            <dd className="address">{receipt.sender}</dd>
          </div>
          <div className="address-detail">
            <dt>Recipient</dt>
            <dd className="address">{receipt.recipient}</dd>
          </div>
          <div className="address-detail">
            <dt>Transaction hash</dt>
            <dd>
              <span className="address">{receipt.transactionHash}</span>
              <CopyButton
                value={receipt.transactionHash}
                label="Copy transaction"
              />
            </dd>
          </div>
        </dl>
        <p className="receipt-verification">
          <Icon name="shield" size={17} />
          Transaction verified onchain
        </p>
        <p className="small muted">
          Testnet receipt. Display names are provided by the request creator.
        </p>
      </article>
      <div className="receipt-actions">
        <a
          className="button primary"
          href={transactionUrl(hash)}
          target="_blank"
          rel="noreferrer"
        >
          View transaction <Icon name="external" size={16} />
        </a>
        <button className="button secondary" onClick={share}>
          Share receipt
        </button>
        <button className="text-link" onClick={() => window.print()}>
          Print receipt
        </button>
      </div>
      <p role="status" className="center small">
        {feedback}
      </p>
      <Link href="/create" className="text-link receipt-create">
        Create your own Payment Link <Icon name="arrow" size={17} />
      </Link>
    </>
  );
}
