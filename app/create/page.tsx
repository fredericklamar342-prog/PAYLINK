import type { Metadata } from "next";
import Link from "next/link";
import { PaymentForm } from "@/components/payment/payment-form";
export const metadata: Metadata = { title: "Create a payment link" };
export default function CreatePage() {
  return (
    <main id="main-content" className="container workspace">
      <Link className="back-link" href="/">
        ← Back to PayLink
      </Link>
      <PaymentForm />
    </main>
  );
}
