"use client";
import { QRCodeSVG } from "qrcode.react";
import { CopyButton } from "@/components/ui/copy-button";
import { useId, useRef, useState } from "react";
import { Feedback } from "@/components/ui/feedback";
export function QrPayment({ url, viewOnly = false }: { url: string; viewOnly?: boolean }) {
  const [feedback, setFeedback] = useState({ url: "", message: "" });
  const [sharing, setSharing] = useState(false);
  const inFlight = useRef(false);
  const urlId = useId();
  async function share() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSharing(true);
    setFeedback({ url, message: "" });
    try {
      if (navigator.share) {
        await navigator.share({ title: "PayLink payment request", url });
        setFeedback({ url, message: "Payment link shared." });
      } else {
        await navigator.clipboard.writeText(url);
        setFeedback({ url, message: "Payment link copied. Paste it into a message." });
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setFeedback({ url, message: "Sharing is unavailable. Use Copy link, or select and copy the payment URL." });
    } finally {
      inFlight.current = false;
      setSharing(false);
    }
  }
  return (
    <section className="qr-panel" aria-label="Share payment request">
      <div>
        <h3>{viewOnly ? "Scan to view request" : "Share your payment request"}</h3>
        <p className="small muted">Send it in a message. Your payer opens the same request.</p>
      </div>
      <div className="share-actions">
        <CopyButton value={url} label="Copy link" className="button primary full" />
        <button type="button" className="button secondary" onClick={share} disabled={sharing}>
          {sharing ? "Sharing…" : "Share link"}
        </button>
      </div>
      <Feedback message={feedback.url === url ? feedback.message : ""} tone="neutral" />
      <label className="field-label" htmlFor={urlId}>
        Payment URL
      </label>
      <textarea
        id={urlId}
        className="share-url mono"
        value={url}
        readOnly
        rows={2}
        onFocus={(e) => e.target.select()}
      />
      <div className="qr-alternative">
        <div className="qr-code">
          <QRCodeSVG
            value={url}
            size={224}
            level="M"
            marginSize={4}
            title="Scan to open this PayLink payment request"
          />
        </div>
        <div><h4>Sharing in person?</h4><p className="small muted">Scan this QR code to open the payment details.</p></div>
      </div>
    </section>
  );
}
