import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.PAYLINK_STAGING_SUPABASE_URL;
const key = process.env.PAYLINK_STAGING_SUPABASE_PUBLISHABLE_KEY;
const expectedRef = process.env.PAYLINK_STAGING_PROJECT_REF;
if (!url || !key || !expectedRef) throw new Error(
  "Set PAYLINK_STAGING_SUPABASE_URL, PAYLINK_STAGING_SUPABASE_PUBLISHABLE_KEY and PAYLINK_STAGING_PROJECT_REF."
);
const parsed = new URL(url);
if (parsed.protocol !== "https:" || parsed.hostname !== `${expectedRef}.supabase.co`)
  throw new Error("Staging URL does not match PAYLINK_STAGING_PROJECT_REF; refusing to run.");

const client = () => createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const a = client(), b = client(), publicClient = client();
const pass = (name, condition, detail = "") => {
  if (!condition) throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  console.log(`PASS ${name}`);
};
const signIn = async (instance, label) => {
  const { data, error } = await instance.auth.signInAnonymously();
  pass(`${label} anonymous Auth session`, !error && Boolean(data.user?.id), error?.message);
  return data.user.id;
};
const create = async (instance, overrides = {}) => {
  const args = {
    p_client_request_id: randomUUID(), p_amount: "0.000001",
    p_recipient_wallet: "0x1234567890123456789012345678901234567890",
    p_recipient_name: "Staging recipient", p_description: "Hosted staging rehearsal",
    p_expires_at: null, p_token_symbol: "USDC", p_chain_id: 10143, ...overrides,
  };
  const result = await instance.rpc("paylink_create_payment_request_v2", args);
  return { ...result, args, row: Array.isArray(result.data) ? result.data[0] : null };
};

const userA = await signIn(a, "Session A");
await signIn(b, "Session B");
pass("Independent anonymous identities", userA !== (await b.auth.getUser()).data.user?.id);

const usdc = await create(a);
pass("USDC minimum precision creation", !usdc.error && usdc.row?.amount === "0.000001", usdc.error?.message);
const mon = await create(a, { p_amount: "0.000000000000000001", p_token_symbol: "MON" });
pass("MON minimum precision creation", !mon.error && mon.row?.amount === "0.000000000000000001", mon.error?.message);

const retry = await a.rpc("paylink_create_payment_request_v2", usdc.args);
pass("Idempotent retry returns same ID", !retry.error && retry.data?.[0]?.id === usdc.row.id, retry.error?.message);
const conflict = await a.rpc("paylink_create_payment_request_v2", {
  ...usdc.args, p_token_symbol: "MON",
});
pass("Changed idempotent payload is rejected", conflict.error?.code === "PT409", conflict.error?.code);

const otherRead = await b.from("payment_requests").select("id").eq("id", usdc.row.id);
pass("Session B cannot table-read Session A", !otherRead.error && otherRead.data.length === 0, otherRead.error?.message);
const publicRead = await publicClient.rpc("paylink_get_payment_request_v2", { p_id: usdc.row.id });
const allowed = ["amount","created_at","description","expires_at","id","network",
  "recipient_name","recipient_wallet","status","token_symbol"].sort();
pass("Public exact-ID read is allowlisted", !publicRead.error && publicRead.data?.length === 1 &&
  Object.keys(publicRead.data[0]).sort().join() === allowed.join(), publicRead.error?.message);
const publicList = await publicClient.from("payment_requests").select("id");
pass("Unauthenticated table listing denied", Boolean(publicList.error), publicList.error?.message);

const directInsert = await a.from("payment_requests").insert({
  recipient_wallet: usdc.args.p_recipient_wallet, amount: "1",
});
pass("Direct authenticated insert denied", Boolean(directInsert.error), directInsert.error?.message);
const directUpdate = await a.from("payment_requests").update({
  status: "paid", transaction_hash: "0xdeadbeef",
}).eq("id", usdc.row.id);
pass("Direct paid-status/hash update denied", Boolean(directUpdate.error), directUpdate.error?.message);
const directDelete = await a.from("payment_requests").delete().eq("id", usdc.row.id);
pass("Direct delete denied", Boolean(directDelete.error), directDelete.error?.message);
const anonCreate = await create(publicClient);
pass("Unauthenticated creation denied", Boolean(anonCreate.error), anonCreate.error?.message);
const precision = await create(a, { p_amount: "0.0000001" });
pass("Excess USDC precision rejected", precision.error?.code === "PT400", precision.error?.code);

console.log("Hosted staging API rehearsal passed. Two anonymous Auth users and two pending test rows remain in staging for SQL inspection.");
