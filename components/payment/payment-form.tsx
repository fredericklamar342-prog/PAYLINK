"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useConnection } from "wagmi";
import { createPayment, validateDraft } from "@/lib/payments";
import type { PaymentDraft, PaymentRequest } from "@/lib/types";
import { PaymentTicket } from "./payment-ticket";
import { QrPayment } from "./qr-payment";
import { Icon } from "@/components/ui/icon";
export function PaymentForm() {
  const { address } = useConnection();
  const [draft, setDraft] = useState<PaymentDraft>({
    amount: "",
    recipient: "",
    recipientName: "",
    description: "",
    expiry: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof PaymentDraft, string>>
  >({});
  const [created, setCreated] = useState<{
    payment: PaymentRequest;
    url: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const result = useRef<HTMLHeadingElement>(null);
  function update(key: keyof PaymentDraft, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) {
      form.current?.querySelector<HTMLElement>(`#${first}`)?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payment = createPayment(draft);
      setCreated({
        payment,
        url: `${window.location.origin}/pay/${payment.id}`,
      });
      requestAnimationFrame(() => result.current?.focus());
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not create the link. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (created)
    return (
      <div className="create-grid created-grid">
        <section>
          <span className="success-check">
            <Icon name="check" size={24} />
          </span>
          <h1 ref={result} tabIndex={-1}>
            Your link is ready.
          </h1>
          <p className="page-description">
            Send it in a message, or let someone scan to pay.
          </p>
          <QrPayment url={created.url} />
          <Link
            className="button primary full"
            href={`/pay/${created.payment.id}`}
          >
            Open payment page <Icon name="arrow" />
          </Link>
          <button className="text-link full" onClick={() => setCreated(null)}>
            Create another link
          </button>
        </section>
        <aside className="live-preview">
          <div className="preview-heading">
            Your payment ticket <span>Ready to share</span>
          </div>
          <PaymentTicket {...created.payment}>
            <p className="small muted">
              The payer connects their wallet and reviews the details before
              signing.
            </p>
          </PaymentTicket>
          <p className="small muted preview-disclaimer">
            Anyone with this link can read the payment details. Share it with
            your intended payer.
          </p>
        </aside>
      </div>
    );
  return (
    <div className="create-grid">
      <section>
        <span className="section-kicker">A request, ready to send</span>
        <h1>
          Let’s make
          <br />
          getting paid simpler.
        </h1>
        <p className="page-description">
          The details go here. The link goes anywhere.
        </p>
        <form ref={form} onSubmit={submit} noValidate className="payment-form">
          <div className="form-row">
            <div className="field">
              <label htmlFor="amount">
                Amount <span className="required-note">Required</span>
              </label>
              <input
                id="amount"
                inputMode="decimal"
                placeholder="0.00"
                value={draft.amount}
                onChange={(e) => update("amount", e.target.value)}
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? "amount-error" : undefined}
              />
              {errors.amount && (
                <p id="amount-error" className="field-error">
                  {errors.amount}
                </p>
              )}
            </div>
            <div className="field token-field">
              <label htmlFor="token">Token</label>
              <select id="token" defaultValue="MON">
                <option value="MON">MON</option>
                <option disabled value="USDC">
                  USDC — coming soon
                </option>
              </select>
            </div>
          </div>
          <p className="network-notice">
            <span className="network-glyph" />
            Monad Testnet <span>Test tokens only. No real money.</span>
          </p>
          <div className="field">
            <label htmlFor="recipient">
              Recipient wallet <span className="required-note">Required</span>
            </label>
            <input
              id="recipient"
              className="mono"
              placeholder="0x…"
              value={draft.recipient}
              onChange={(e) => update("recipient", e.target.value.trim())}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={!!errors.recipient}
              aria-describedby="recipient-help"
            />
            <div id="recipient-help">
              {errors.recipient ? (
                <p className="field-error">{errors.recipient}</p>
              ) : (
                <p className="field-hint">
                  The full wallet address that will receive the payment.
                </p>
              )}
            </div>
            {address && (
              <button
                type="button"
                className="text-link small"
                onClick={() => update("recipient", address)}
              >
                Use my connected wallet
              </button>
            )}
          </div>
          <div className="field">
            <label htmlFor="recipientName">
              Recipient name <span className="optional">Optional</span>
            </label>
            <input
              id="recipientName"
              maxLength={50}
              placeholder="Your name or business"
              value={draft.recipientName}
              onChange={(e) => update("recipientName", e.target.value)}
              aria-invalid={!!errors.recipientName}
            />
            <p className="field-hint">
              A display name, not a verified identity.
            </p>
          </div>
          <div className="field">
            <label htmlFor="description">
              What’s the payment for?{" "}
              <span className="required-note">Required</span>
            </label>
            <textarea
              id="description"
              placeholder="e.g. Website development"
              rows={2}
              maxLength={140}
              value={draft.description}
              onChange={(e) => update("description", e.target.value)}
              aria-invalid={!!errors.description}
              aria-describedby="description-help"
            />
            <div className="row-between" id="description-help">
              <span
                className={errors.description ? "field-error" : "field-hint"}
              >
                {errors.description || "Keep it clear for your payer."}
              </span>
              <span className="field-hint">{draft.description.length}/140</span>
            </div>
          </div>
          <div className="field">
            <label htmlFor="expiry">
              Expires on <span className="optional">Optional</span>
            </label>
            <input
              id="expiry"
              type="datetime-local"
              value={draft.expiry}
              onChange={(e) => update("expiry", e.target.value)}
              aria-invalid={!!errors.expiry}
              aria-describedby="expiry-help"
            />
            <p
              id="expiry-help"
              className={errors.expiry ? "field-error" : "field-hint"}
            >
              {errors.expiry || "Your local time. Leave empty for no expiry."}
            </p>
          </div>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary full" disabled={busy} type="submit">
            {busy ? "Creating your link…" : "Create Payment Link"}
            <Icon name="arrow" />
          </button>
          <p className="form-footnote">
            <Icon name="shield" size={14} />
            No transaction or wallet signature needed to create a link.
          </p>
        </form>
      </section>
      <aside className="live-preview">
        <div className="preview-heading">
          Your payment ticket{" "}
          <span>
            <span className="live-dot" />
            Live preview
          </span>
        </div>
        <PaymentTicket
          amount={draft.amount}
          token="MON"
          recipient={draft.recipient}
          recipientName={draft.recipientName}
          description={draft.description}
          preview
        >
          <button className="button primary full" disabled>
            Pay {draft.amount || "0"} MON <Icon name="arrow" />
          </button>
        </PaymentTicket>
        <p className="small muted preview-disclaimer">
          A little clarity goes a long way.
          <br />
          Your payer sees these details before they approve.
        </p>
      </aside>
    </div>
  );
}
