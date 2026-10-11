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
import { Feedback } from "@/components/ui/feedback";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
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
export function PaymentRequestView({
  payment,
  stored = false,
}: {
  payment: PaymentRequest;
  stored?: boolean;
}) {
  const { isConnected } = useConnection();
  const browserReady = useBrowserReady();
  const now = useClock();
  const expired = now > 0 && isExpired(payment, now);
  const { hash, signing, error, pay, verification, ready } =
    usePayment(payment);
  const [reviewed, setReviewed] = useState(false);
  const terminalFailure = !stored && verification.error instanceof VerificationError;
  const status: PaymentStatus = !stored && verification.data
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
          Payment request
        </span>
        <h1>Review your payment.</h1>
        <p>Check the amount and recipient before connecting your wallet.</p>
      </div>
      <div className="pay-grid">
        <div className="payment-overview">
          <PaymentTicket {...payment} status={status}>
            <a className="text-link full review-link" href="#payment-review">
              Review payment details <Icon name="arrow" size={17} />
            </a>
          </PaymentTicket>
          <p className="testnet-note">
            Monad Testnet · Test tokens only. No real money.
          </p>
        </div>
        <div className="payment-review" id="payment-review" tabIndex={-1}>
          <PaymentSummary payment={payment} />
          <section
            className="payment-actions"
            aria-labelledby="payment-action-title"
          >
            <h2 id="payment-action-title">
              {hash ? "Payment progress" : "Your approval"}
            </h2>

            {!stored && status === "confirmed" && hash ? (
              <Link
                className="button primary full"
                href={receiptPath(payment.id, hash)}
              >
                View verified receipt <Icon name="arrow" />
              </Link>
            ) : hash ? (
              <div className="stack">
                <p className="notice" role="status">
                  {stored
                    ? "Transaction submitted. Secure server verification is not enabled yet, so this request remains pending. Donâ€™t send another payment."
                    : terminalFailure
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
                {!stored && verification.isError && !terminalFailure && (
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
                  {signing ? <LoadingIndicator /> : <Icon name="arrow" />}
                </button>
                <p className="small muted">
                  Next, your wallet asks you to sign. A network fee is added.
                  Payments cannot be undone.
                </p>
              </>
            )}
            <Feedback message={error} />
          </section>
        </div>
        <details className="payment-sharing share-details">
          <summary>
            <span>Share this request / QR code</span>
            <Icon name="chevron" size={18} />
          </summary>
          {browserReady && (
            <QrPayment url={`${window.location.origin}/pay/${payment.id}`} />
          )}
        </details>
      </div>
      <p className="payment-limit-note">
        {stored
          ? "A submitted transaction does not mark this request paid. PayLink will do that only after independent server verification is enabled."
          : "Already paid from another device? Check with the recipient before paying again. This MVP does not track payment status across devices."}
      </p>
    </>
  );
}
