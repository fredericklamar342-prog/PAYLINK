import { Suspense } from "react";
import { PaymentPage } from "@/components/payment/payment-page";
import { StoredPaymentPage } from "@/components/payment/stored-payment-page";
import { isStoredPaymentId } from "@/lib/stored-payments";
import { readStoredPayment } from "@/lib/payment-storage";
export const metadata = {
  title: "Payment request",
  robots: { index: false, follow: false },
};
async function Request({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isStoredPaymentId(id)) {
    const { payment, unavailable } = await readStoredPayment(id);
    if (payment) return <StoredPaymentPage payment={payment} />;
    return (
      <div className="empty-state">
        <h1>{unavailable ? "Request temporarily unavailable." : "Request not found."}</h1>
        <p>{unavailable ? "We could not load the saved details. Please try again shortly." : "Check that you copied the full link, or ask the sender for a new one."}</p>
        {unavailable && <a className="button secondary" href={`/pay/${id}`}>Try again</a>}
      </div>
    );
  }
  return <PaymentPage id={id} />;
}
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main id="main-content" className="container payment-workspace">
      <Suspense
        fallback={
          <p className="loading-state" role="status">
            Opening payment request…
          </p>
        }
      >
        <Request params={params} />
      </Suspense>
    </main>
  );
}
