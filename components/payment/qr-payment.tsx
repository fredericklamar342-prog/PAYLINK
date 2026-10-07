"use client";
import { QRCodeSVG } from "qrcode.react";
import { CopyButton } from "@/components/ui/copy-button";
import { useState } from "react";
export function QrPayment({ url }: { url: string }) {
  const [feedback, setFeedback] = useState("");
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({ title: "PayLink payment request", url });
      else {
        await navigator.clipboard.writeText(url);
        setFeedback("Payment link copied. Paste it into a message.");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setFeedback("Sharing is unavailable. Copy the payment link below.");
    }
  }
  return (
    <section className="qr-panel" aria-label="Share payment request">
      <div>
        <h3>Scan to pay</h3>
        <p className="small muted">One link. Any screen.</p>
      </div>
      <div className="qr-code">
        <QRCodeSVG
          value={url}
          size={224}
          level="M"
          marginSize={4}
          title="Scan to open this PayLink payment request"
        />
      </div>
      <label className="field-label" htmlFor="payment-url">
        Payment URL
      </label>
      <textarea
        id="payment-url"
        className="share-url mono"
        value={url}
        readOnly
        rows={2}
        onFocus={(e) => e.target.select()}
      />
      <div className="share-actions">
        <CopyButton value={url} label="Copy link" />
        <button className="button secondary compact" onClick={share}>
          Share link
        </button>
      </div>
      <p role="status" className="small muted">
        {feedback}
      </p>
    </section>
  );
}
