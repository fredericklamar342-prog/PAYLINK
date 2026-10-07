import type { PaymentRequest } from "@/lib/types";
import { paymentChain } from "@/lib/chain";
import { CopyButton } from "@/components/ui/copy-button";
export function PaymentSummary({ payment }: { payment: PaymentRequest }) {
  return (
    <section className="payment-summary">
      <h2>Know before you pay.</h2>
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
        <div>
          <dt>Network fee</dt>
          <dd>Shown in your wallet</dd>
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
        You are paying{" "}
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
