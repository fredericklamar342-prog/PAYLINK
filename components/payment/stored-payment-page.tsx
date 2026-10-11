import type { PaymentRequest } from "@/lib/types";
import { PaymentRequestView } from "./payment-page";

export function StoredPaymentPage({ payment }: { payment: PaymentRequest }) {
  return <PaymentRequestView payment={payment} stored />;
}
