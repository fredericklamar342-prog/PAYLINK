import { Suspense } from "react";
import { PaymentPage } from "@/components/payment/payment-page";
export const metadata = {
  title: "Payment request",
  robots: { index: false, follow: false },
};
async function Request({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
