"use client";

import { useClock } from "@/lib/browser-state";
import { Icon } from "@/components/ui/icon";

function countdown(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  return { days, hours, minutes, seconds: remainingSeconds };
}

export function ExpiryCountdown({ expiresAt }: { expiresAt: number }) {
  const now = useClock();
  const expired = now > 0 && now >= expiresAt;
  const remaining = countdown(expiresAt - (now || expiresAt));

  return (
    <section className={`expiry-card${expired ? " is-expired" : ""}`} aria-live="polite">
      <div className="expiry-card-heading">
        <Icon name={expired ? "warning" : "clock"} size={18} />
        <span>{expired ? "Payment Link Expired" : "Payment expires in"}</span>
      </div>
      {expired ? (
        <p>Ask the recipient to create and share a new payment link.</p>
      ) : (
        <>
          <div className="countdown" aria-label={`${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes, ${remaining.seconds} seconds remaining`}>
            {remaining.days > 0 && <span><strong>{remaining.days}</strong><small>d</small></span>}
            <span><strong>{String(remaining.hours).padStart(2, "0")}</strong><small>h</small></span>
            <span><strong>{String(remaining.minutes).padStart(2, "0")}</strong><small>m</small></span>
            <span><strong>{String(remaining.seconds).padStart(2, "0")}</strong><small>s</small></span>
          </div>
          <p suppressHydrationWarning>Exact expiry: {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "long" }).format(expiresAt)}</p>
        </>
      )}
    </section>
  );
}
