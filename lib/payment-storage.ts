import "server-only";
import { serverSupabase } from "./supabase/server";
import { isStoredPaymentId, publicPayment } from "./stored-payments";

export async function readStoredPayment(id: string) {
  if (!isStoredPaymentId(id)) return { payment: null, unavailable: false };
  try {
    const { data, error } = await serverSupabase().rpc("paylink_get_payment_request_v2", { p_id: id });
    if (error) return { payment: null, unavailable: true };
    if (!Array.isArray(data) || data.length > 1) return { payment: null, unavailable: true };
    if (!data.length) return { payment: null, unavailable: false };
    const payment = publicPayment(data[0]);
    return { payment, unavailable: !payment };
  } catch {
    return { payment: null, unavailable: true };
  }
}
