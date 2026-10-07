import { Suspense } from "react";
import { ReceiptPage } from "@/components/payment/receipt";
export const metadata = {
  title: "Payment receipt",
  robots: { index: false, follow: false },
};
export default function SuccessPage() {
  return (
    <main id="main-content" className="container receipt-workspace">
      <Suspense
        fallback={
          <p className="loading-state" role="status">
            Opening receipt…
          </p>
        }
      >
        <ReceiptPage />
      </Suspense>
    </main>
  );
}
