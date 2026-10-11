"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useConnection } from "wagmi";
import { validateDraft } from "@/lib/payments";
import { creatorAccessToken } from "@/lib/supabase/browser";
import { isStoredPaymentId } from "@/lib/stored-payments";
import type { PaymentDraft, PaymentRequest } from "@/lib/types";
import { isPaymentToken, PAYMENT_CHAIN_ID, PAYMENT_TOKENS } from "@/lib/tokens";
import { PaymentTicket } from "./payment-ticket";
import { QrPayment } from "./qr-payment";
import { Icon } from "@/components/ui/icon";
import { Feedback } from "@/components/ui/feedback";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { ExpirationSelector } from "./expiration-selector";
export function PaymentForm() {
  const { address } = useConnection();
  const [draft, setDraft] = useState<PaymentDraft>({
    token: "MON",
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
  const composer = useRef<HTMLHeadingElement>(null);
  const inFlight = useRef(false);
  const submission = useRef<{ fingerprint: string; id: string } | null>(null);
  function update(key: keyof PaymentDraft, value: string) {
    if (key === "token" && !isPaymentToken(value)) return;
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, ...(key === "token" ? { amount: undefined } : {}) }));
  }
  // Required-field completion is time-independent; submit validates expiry.
  const requiredErrors = validateDraft({ ...draft, expiry: "" }, 0);
  const requiredDetails = [
    { key: "amount", label: "Payment amount", ready: !requiredErrors.amount },
    { key: "recipient", label: "Recipient address", ready: !requiredErrors.recipient },
    { key: "description", label: "Payment purpose", ready: !requiredErrors.description },
  ];
  const completedDetails = requiredDetails.filter((detail) => detail.ready).length;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) {
      // Commit error descriptions before moving focus to their control.
      requestAnimationFrame(() =>
        form.current?.querySelector<HTMLElement>(`#${first}`)?.focus(),
      );
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = { ...draft, network: PAYMENT_CHAIN_ID, expiry: draft.expiry ? new Date(draft.expiry).toISOString() : "" };
      const fingerprint = JSON.stringify(payload);
      if (submission.current?.fingerprint !== fingerprint)
        submission.current = { fingerprint, id: crypto.randomUUID() };
      const token = await creatorAccessToken();
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...payload, clientRequestId: submission.current.id }),
        signal: AbortSignal.timeout(25_000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save this request. Please try again.");
      const payment: PaymentRequest = data.payment;
      if (!payment || !isStoredPaymentId(payment.id)) throw new Error("Could not confirm the saved request. Please retry with the same details.");
      setCreated({
        payment,
        url: `${window.location.origin}/pay/${payment.id}`,
      });
      requestAnimationFrame(() => result.current?.focus());
    } catch (e) {
      setError(
        e instanceof DOMException && ["TimeoutError", "AbortError"].includes(e.name)
          ? "The save could not be confirmed. Your details are still here. Retry with the same details to recover the request."
          : e instanceof Error
          ? e.message
          : "Could not create the link. Please try again.",
      );
    } finally {
      inFlight.current = false;
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
            Copy, share, or scan the real payment URL below. It stays available after you leave this page.
          </p>
          <QrPayment url={created.url} />
          <Link
            className="button primary full"
            href={`/pay/${created.payment.id}`}
          >
            Open payment page <Icon name="arrow" />
          </Link>
          <button
            className="text-link full"
            onClick={() => {
              setCreated(null);
              submission.current = null;
              requestAnimationFrame(() => composer.current?.focus());
            }}
          >
            Create another link
          </button>
        </section>
        <aside className="live-preview">
          <div className="preview-heading">
            Your payment ticket <span>Ready to share</span>
          </div>
          <PaymentTicket {...created.payment}>
            <p className="small muted">
              This request is saved. The recipient can review it and submit a testnet payment from their wallet.
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
    <div className="create-grid composer-grid">
      <section>
        <span className="section-kicker">Create a request</span>
        <h1 ref={composer} tabIndex={-1}>
          Your payment details.
        </h1>
        <p className="page-description">
          Set the amount and recipient. You’ll get a link and QR code to share.
        </p>
        <form ref={form} onSubmit={submit} noValidate className="payment-form">
          <fieldset className="form-section">
            <legend><span>1</span> Payment amount</legend>
            <div className="form-row">
              <div className="field">
                <label htmlFor="amount">
                  Amount <span className="required-note">Required</span>
                </label>
                <input
                  id="amount"
                  required
                  inputMode="decimal"
                  placeholder="0.00"
                  value={draft.amount}
                  onChange={(e) => update("amount", e.target.value)}
                  aria-invalid={errors.amount ? true : undefined}
                  aria-describedby={errors.amount ? "amount-error amount-help" : "amount-help"}
                />
                <p id="amount-help" className="field-hint">Up to {PAYMENT_TOKENS[draft.token ?? "MON"].decimals} decimal places.</p>
                {errors.amount && (
                  <p id="amount-error" className="field-error">
                    {errors.amount}
                  </p>
                )}
              </div>
              <div className="field token-field">
                <label htmlFor="token">Token</label>
                <select id="token" value={draft.token} disabled={busy}
                  onChange={(event) => update("token", event.target.value)}>
                  <option value="MON">MON</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>
            </div>
            <p className="network-notice">
              <span className="network-glyph" />
              Monad Testnet <span>Test tokens only. No real money.</span>
            </p>
          </fieldset>
          <fieldset className="form-section">
            <legend><span>2</span> Who gets paid</legend>
            <div className="field">
              <label htmlFor="recipient">
                Recipient wallet <span className="required-note">Required</span>
              </label>
              <input
                id="recipient"
                required
                className="mono"
                placeholder="0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
                value={draft.recipient}
                onChange={(e) => update("recipient", e.target.value.trim())}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={errors.recipient ? true : undefined}
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
                aria-invalid={errors.recipientName ? true : undefined}
                aria-describedby="recipient-name-help"
              />
              <p
                id="recipient-name-help"
                className={errors.recipientName ? "field-error" : "field-hint"}
              >
                {errors.recipientName ||
                  "A display name, not a verified identity."}
              </p>
            </div>
          </fieldset>
          <fieldset className="form-section">
            <legend><span>3</span> Purpose and timing</legend>
            <div className="field">
              <label htmlFor="description">
                What’s the payment for?{" "}
                <span className="required-note">Required</span>
              </label>
              <textarea
                id="description"
                required
                placeholder="e.g. Website design payment"
                rows={2}
                maxLength={140}
                value={draft.description}
                onChange={(e) => update("description", e.target.value)}
                aria-invalid={errors.description ? true : undefined}
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
            <ExpirationSelector
              value={draft.expiry}
              error={errors.expiry}
              disabled={busy}
              onChange={(value) => update("expiry", value)}
            />
          </fieldset>
          <Feedback message={error} />
          <button className="button primary full" disabled={busy} type="submit">
            {busy ? "Creating your link…" : "Create Payment Link"}
            {busy ? <LoadingIndicator /> : <Icon name="arrow" />}
          </button>
          <p className="form-footnote">
            <Icon name="shield" size={14} />
          No wallet signature needed. Creating a request does not collect money.
          </p>
        </form>
      </section>
      <aside className="live-preview composer-preview">
        <div className="preview-heading">
          Your payment ticket{" "}
          <span>
            <span className="live-dot" />
            Live preview
          </span>
        </div>
        <div className="composer-ticket-stage">
          <PaymentTicket
            amount={draft.amount}
            token={draft.token ?? "MON"}
            recipient={draft.recipient}
            recipientName={draft.recipientName}
            description={draft.description}
            preview
            requestOnly
          >
            <p className="preview-expiry">
              <Icon name="clock" size={15} />
              {draft.expiry
                ? `Expires ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(Date.parse(draft.expiry))}`
                : "No expiration set"}
            </p>
            <button className="button primary full" disabled>
              Request preview <Icon name="link" />
            </button>
          </PaymentTicket>
        </div>
        <section className="request-readiness" aria-labelledby="readiness-heading">
          <div className="row-between">
            <h2 id="readiness-heading">Required details</h2>
            <span>{completedDetails} of 3 ready</span>
          </div>
          <progress
            value={completedDetails}
            max={3}
            aria-label="Required details completed"
          />
          <ul>
            {requiredDetails.map(({ key, label, ready }) => (
              <li key={key} data-ready={ready}>
                <Icon name={ready ? "check" : "chevron"} size={16} />
                <a
                  href={`#${key}`}
                  onClick={(event) => {
                    event.preventDefault();
                    form.current?.querySelector<HTMLElement>(`#${key}`)?.focus();
                  }}
                >
                  {label}
                </a>
                <span>{ready ? "Ready" : "To add"}</span>
              </li>
            ))}
          </ul>
        </section>
        <p className="small muted preview-disclaimer">
          This preview updates as you type. Your payer reviews the full address
          and payment details before approving.
        </p>
      </aside>
    </div>
  );
}
