import http from "node:http";
import { randomUUID } from "node:crypto";

// HTTP CONTRACT fixture only. This does not implement or verify PostgreSQL/RLS.
export async function startFixture() {
  const sessions = new Map();
  const submissions = new Map();
  const rows = new Map();
  const scenarios = new Map();
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3100");
    res.setHeader("Access-Control-Allow-Headers", "authorization,apikey,content-type,x-client-info,x-supabase-api-version");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Content-Type", "application/json");
    const send = (status, value) => { res.writeHead(status); res.end(JSON.stringify(value)); };
    if (req.method === "OPTIONS") return send(200, {});
    let body = {};
    try {
      let text = "";
      for await (const chunk of req) text += chunk;
      if (text) body = JSON.parse(text);
    } catch { return send(400, {}); }
    const path = new URL(req.url, "http://127.0.0.1:3101").pathname;
    const token = req.headers.authorization?.replace(/^Bearer /i, "");
    const user = sessions.get(token);
    if (path === "/__scenario") {
      scenarios.set(body.token, body.mode);
      return send(200, {});
    }
    if (path === "/auth/v1/signup") {
      const id = randomUUID();
      const user = { id, aud: "authenticated", role: "authenticated", email: "",
        is_anonymous: true, app_metadata: { provider: "anonymous" }, user_metadata: {},
        created_at: new Date().toISOString() };
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
      const access = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, aud: "authenticated", role: "authenticated", exp: expires, is_anonymous: true })}.local-fixture-signature`;
      sessions.set(access, user);
      return send(200, { access_token: access, refresh_token: randomUUID(), token_type: "bearer", expires_in: 3600, expires_at: expires, user });
    }
    if (path === "/auth/v1/user") {
      if (scenarios.get(token) === "auth-unavailable") return send(503, { message: "Fixture authentication outage" });
      return user ? send(200, user) : send(401, { message: "Invalid token" });
    }
    if (path === "/rest/v1/rpc/paylink_create_payment_request_v2") {
      if (!user) return send(403, { code: "42501", message: "Denied" });
      if (body.p_chain_id !== 10143 || !["MON", "USDC"].includes(body.p_token_symbol)
        || typeof body.p_recipient_wallet !== "string" || typeof body.p_amount !== "string")
        return send(400, { code: "PT400", message: "RPC contract mismatch" });
      const mode = scenarios.get(token);
      if (mode === "timeout") {
        const timer = setTimeout(() => send(503, { code: "XX000" }), 11_000);
        res.on("close", () => clearTimeout(timer));
        return;
      }
      if (mode === "unavailable") return send(503, { code: "XX000", message: "Internal fixture detail must not escape" });
      if (mode === "forbidden") return send(403, { code: "42501", message: "Denied" });
      if (mode === "rate-limit") return send(429, { code: "PT429", message: "Limit" });
      const key = `${user.id}:${body.p_client_request_id}`;
      // Match the RPC's numeric text output without introducing floating-point amounts.
      const normalizedAmount = body.p_amount.includes(".") ? body.p_amount.replace(/0+$/, "").replace(/\.$/, "") : body.p_amount;
      const fingerprint = JSON.stringify({ ...body, p_amount: normalizedAmount,
        p_recipient_wallet: body.p_recipient_wallet.toLowerCase() });
      const prior = submissions.get(key);
      if (prior) {
        if (prior.fingerprint !== fingerprint) return send(409, { code: "PT409", message: "Conflict" });
        return send(200, [rows.get(prior.id)]);
      }
      const row = { id: randomUUID(), owner_id: user.id,
        client_request_id: body.p_client_request_id, amount: normalizedAmount,
        recipient_wallet: body.p_recipient_wallet.toLowerCase(), recipient_name: body.p_recipient_name,
        description: body.p_description, token_symbol: body.p_token_symbol, network: "Monad Testnet", status: "pending",
        creator_wallet: null, transaction_hash: null, paid_at: null,
        created_at: new Date().toISOString(), expires_at: body.p_expires_at };
      // Include internal columns on purpose: the app must explicitly strip them.
      rows.set(row.id, row);
      submissions.set(key, { id: row.id, fingerprint });
      return send(200, [row]);
    }
    if (path === "/rest/v1/rpc/paylink_get_payment_request_v2") {
      return send(200, rows.has(body.p_id) ? [rows.get(body.p_id)] : []);
    }
    return send(404, {});
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(3101, "127.0.0.1", resolve);
  });
  return server;
}
