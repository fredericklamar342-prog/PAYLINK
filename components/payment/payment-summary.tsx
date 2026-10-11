import type { PaymentRequest } from "@/lib/types";
import { paymentChain } from "@/lib/chain";
import { CopyButton } from "@/components/ui/copy-button";
import { PAYMENT_TOKENS } from "@/lib/tokens";
export function PaymentSummary({ payment, viewOnly = false }: { payment: PaymentRequest; viewOnly?: boolean }) {
  return (
    <section className="payment-summary">
      <h2>{viewOnly ? "Request details" : "Know before you pay."}</h2>
      <dl className="details-list">
        <div>
          <dt>Amount</dt>
          <dd>
            {payment.amount} {payment.token}
          </dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>{paymentChain.name}</dd>
        </div>
        <div>
          <dt>Payment purpose</dt>
          <dd>{payment.description}</dd>
        </div>
        <div className="address-detail">
          <dt>Recipient wallet</dt>
          <dd>
            <span className="address">{payment.recipient}</span>
            <CopyButton value={payment.recipient} label="Copy address" />
          </dd>
        </div>
        {payment.token === "USDC" && <div className="address-detail">
          <dt>USDC contract</dt>
          <dd><span className="address">{PAYMENT_TOKENS.USDC.address}</span>
            <CopyButton value={PAYMENT_TOKENS.USDC.address} label="Copy token contract" /></dd>
        </div>}
        <div>
          <dt>Network fee</dt>
          <dd>{viewOnly ? "None to create or view this request" : "Shown in your wallet"}</dd>
        </div>
        {payment.expiresAt && (
          <div>
            <dt>Expires</dt>
            <dd>
              {new Date(payment.expiresAt)
                .toISOString()
                .replace("T", " ")
                .slice(0, 16)}{" "}
              UTC
            </dd>
          </div>
        )}
      </dl>
      <p className="review-sentence">
        {viewOnly ? "This request is for" : "You are paying"}{" "}
        <strong>
          {payment.amount} {payment.token}
        </strong>{" "}
        on <strong>{paymentChain.name}</strong> to{" "}
        <span className="address">{payment.recipient}</span>
      </p>
      <p className="small muted">
        This link’s name and description are provided by its creator. Confirm
        the recipient address with someone you trust.
      </p>
    </section>
  );
}
