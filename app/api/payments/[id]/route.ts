import { isStoredPaymentId } from "@/lib/stored-payments";
import { readStoredPayment } from "@/lib/payment-storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers = { "Cache-Control": "no-store" };
  if (!isStoredPaymentId(id)) return Response.json({ error: "Request not found." }, { status: 404, headers });
  const { payment, unavailable } = await readStoredPayment(id);
  if (unavailable) return Response.json({ error: "Payment storage is temporarily unavailable." }, { status: 503, headers });
  if (!payment) return Response.json({ error: "Request not found." }, { status: 404, headers });
  return Response.json({ payment }, { headers });
}
