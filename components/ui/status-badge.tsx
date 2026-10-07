import type { PaymentStatus } from "@/lib/types";
const labels: Record<PaymentStatus, string> = {
  unpaid: "Awaiting payment",
  signing: "Check your wallet",
  pending: "Confirming onchain",
  confirmed: "Payment verified",
  failed: "Payment failed",
  expired: "Request expired",
};
export function StatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
