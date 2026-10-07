"use client";
import Link from "next/link";
import { useState } from "react";
import { useConnection } from "wagmi";
import { decodePayment, isExpired, receiptPath } from "@/lib/payments";
import { transactionUrl } from "@/lib/chain";
import { useBrowserReady, useClock } from "@/lib/browser-state";
import type { PaymentRequest, PaymentStatus } from "@/lib/types";
import { VerificationError } from "@/lib/transactions";
import { WalletButton } from "@/components/wallet/wallet-button";
import { Icon } from "@/components/ui/icon";
import { PaymentTicket } from "./payment-ticket";
import { PaymentSummary } from "./payment-summary";
import { QrPayment } from "./qr-payment";
import { usePayment } from "./use-payment";

export function PaymentPage({ id }: { id: string }) {
  const payment = decodePayment(id);
  if (!payment)
    return (
      <div className="empty-state">
        <span className="section-kicker">Request unavailable</span>
        <h1>This payment link isn’t valid.</h1>
        <p>
          It may be incomplete or use an unsupported network. Ask the sender for
          a new link.
        </p>
        <Link href="/create" className="button primary">
          Create a Payment Link
        </Link>
      </div>
    );
  return <PaymentRequestView key={id} payment={payment} />;
}
function PaymentRequestView({ payment }: { payment: PaymentRequest }) {
  const { isConnected } = useConnection();
  const browserReady = useBrowserReady();
  const now = useClock();
  const expired = now > 0 && isExpired(payment, now);
  const { hash, signing, error, pay, verification, ready } =
    usePayment(payment);
  const [reviewed, setReviewed] = useState(false);
  const terminalFailure = verification.error instanceof VerificationError;
  const status: PaymentStatus = verification.data
    ? "confirmed"
    : terminalFailure
      ? "failed"
      : hash
        ? "pending"
        : signing
          ? "signing"
          : expired
            ? "expired"
            : "unpaid";
  return (
    <>
      <div className="payment-page-heading">
        <span className="section-kicker">
          A clear request. A confident payment.
        </span>
        <h1>You’re in the right place.</h1>
        <p>Review the details. Your wallet takes it from here.</p>
      </div>
      <div className="pay-grid">
        <div>
          <PaymentTicket {...payment} status={status}>
            {status === "confirmed" && hash ? (
              <Link
                className="button primary full"
                href={receiptPath(payment.id, hash)}
              >
                View verified receipt <Icon name="arrow" />
              </Link>
            ) : hash ? (
              <div className="stack">
                <p className="notice" role="status">
                  {terminalFailure
                    ? verification.error?.message
                    : "Payment submitted. We’re checking the transaction on Monad. Don’t send another payment."}
                </p>
                <a
                  className="button secondary full"
                  href={transactionUrl(hash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction <Icon name="external" size={16} />
                </a>
                {verification.isError && !terminalFailure && (
                  <>
                    <p className="small muted">
                      Confirmation is taking longer than expected. Your payment
                      may still be pending. Checking again automatically.
                    </p>
                    <button
                      className="button secondary full"
                      onClick={() => verification.refetch()}
                      disabled={verification.isFetching}
                    >
                      Check confirmation
                    </button>
                  </>
                )}
              </div>
            ) : expired ? (
              <p className="notice warning" role="status">
                This request has expired. Ask the recipient for a new link.
              </p>
            ) : !isConnected || !ready ? (
              <WalletButton primary />
            ) : (
              <>
                <label className="review-checkbox">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                    disabled={signing}
                  />
                  <span>
                    I’ve checked the amount and full recipient address in the
                    payment details.
                  </span>
                </label>
                <button
                  className="button primary full"
                  onClick={pay}
                  disabled={!reviewed || signing || !now}
                >
                  {signing
                    ? "Check your wallet…"
                    : `Pay ${payment.amount} ${payment.token}`}
                  <Icon name="arrow" />
                </button>
                <p className="small muted">
                  Next, your wallet asks you to sign. A network fee is added.
                  Payments cannot be undone.
                </p>
              </>
            )}
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
          </PaymentTicket>
          <p className="testnet-note">
            Monad Testnet · Test tokens only. No real money.
          </p>
          <details className="share-details">
            <summary>Share this request / QR code</summary>
            {browserReady && (
              <QrPayment url={`${window.location.origin}/pay/${payment.id}`} />
            )}
          </details>
        </div>
        <PaymentSummary payment={payment} />
      </div>
      <p className="payment-limit-note">
        Already paid from another device? Check with the recipient before paying
        again. This MVP does not track payment status across devices.
      </p>
    </>
  );
}
