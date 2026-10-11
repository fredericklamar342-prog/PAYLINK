import { serverSupabase } from "@/lib/supabase/server";
import { parseCreateRequest, publicPayment } from "@/lib/stored-payments";
import { PAYMENT_CHAIN_ID } from "@/lib/tokens";

const json = (body: unknown, status: number, headers?: Record<string, string>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token || token.length > 8192) return json({ error: "A valid creator session is required." }, 401);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
    return json({ error: "Send payment details as JSON." }, 415);
  if (Number(request.headers.get("content-length")) > 4096)
    return json({ error: "The request is too large." }, 413);
  let body: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Payment details are required." }, 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return json({ error: "The request is too large." }, 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch { return json({ error: "Send valid JSON payment details." }, 400); }
  const input = parseCreateRequest(body);
  if (!input) return json({ error: "Check the amount, recipient, purpose, expiry, and request identifier." }, 400);

  let supabase;
  try { supabase = serverSupabase(token); }
  catch { return json({ error: "Payment storage is not configured. Please contact the site owner." }, 503); }
  try {
    const auth = await supabase.auth.getUser(token);
    if (auth.error || !auth.data.user) {
      return json({ error: "Your creator session could not be verified. Please refresh and try again." },
        auth.error && ((auth.error.status ?? 0) === 0 || (auth.error.status ?? 0) >= 500) ? 503 : 401);
    }
    const { draft, clientRequestId } = input;
    const { data, error } = await supabase.rpc("paylink_create_payment_request_v2", {
      p_token_symbol: draft.token, p_chain_id: PAYMENT_CHAIN_ID,
      p_client_request_id: clientRequestId, p_amount: draft.amount,
      p_recipient_wallet: draft.recipient, p_recipient_name: draft.recipientName,
      p_description: draft.description, p_expires_at: draft.expiry || null,
    });
    if (error) {
      if (error.code === "PT429") return json({ error: "Too many requests created. Please try again later." }, 429, { "Retry-After": "3600" });
      if (error.code === "PT409") return json({ error: "This submission already exists with different details. Restore the original details or start a new request." }, 409);
      if (["23514", "23502", "22P02", "22007", "PT400"].includes(error.code)) return json({ error: "Some payment details are invalid. Check them and try again." }, 400);
      if (["42501", "PT403"].includes(error.code)) return json({ error: "This session is not allowed to create payment requests." }, 403);
      // Never expose database messages, tokens, submitted bodies, or infrastructure URLs.
      console.error(JSON.stringify({ operation: "create_payment_request", kind: "storage_failure" }));
      return json({ error: "Payment storage is unavailable. Your details are still here; please try again." }, 503);
    }
    const payment = publicPayment(Array.isArray(data) && data.length === 1 ? data[0] : null);
    if (!payment) return json({ error: "Could not confirm the saved request. Please retry with the same details." }, 503);
    return json({ payment, path: `/pay/${payment.id}` }, 201);
  } catch {
    return json({ error: "The save could not be confirmed. Please retry with the same details." }, 503);
  }
}
