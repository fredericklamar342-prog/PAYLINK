"use client";
import type { PaymentStatus } from "@/lib/types";
import { Icon } from "./icon";
import { LoadingIndicator } from "./loading-indicator";
import { useFeedbackMotion } from "./use-feedback-motion";
const labels: Record<PaymentStatus, string> = {
  unpaid: "Awaiting payment",
  signing: "Check your wallet",
  pending: "Awaiting verification",
  confirmed: "Verified paid",
  failed: "Payment failed",
  expired: "Request expired",
};
export function StatusBadge({ status }: { status: PaymentStatus }) {
  const scope = useFeedbackMotion<HTMLSpanElement>(status);
  return (
    <span
      className={`status-badge status-${status}`}
      role="status"
      aria-atomic="true"
    >
      <span className="status-icon" ref={scope}>
        {status === "pending" || status === "signing" ? (
          <LoadingIndicator />
        ) : (
          <Icon
            name={
              status === "confirmed"
                ? "check"
                : status === "failed" || status === "expired"
                  ? "warning"
                  : "clock"
            }
            size={14}
          />
        )}
      </span>
      {labels[status]}
    </span>
  );
}
