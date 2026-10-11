import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";

// Never loads .env, Supabase credentials, DATABASE_URL or a remote connection string.
const psql = "C:/Program Files/PostgreSQL/18/bin/psql.exe";
const root = process.cwd();
const membershipRun = process.argv.includes("--memberships");
const restricted = process.argv.includes("--restricted") || process.argv.includes("--final") || membershipRun;
const finalRun = process.argv.includes("--final");
const port = membershipRun ? "55442" : finalRun ? "55441" : restricted ? "55440" : "55439";
const admin = restricted ? "review_admin" : "postgres";
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG|DATABASE_URL|SUPABASE/i.test(key)));
const results = [];
async function query(sql, database = "postgres", allowFailure = false, user = admin) {
  const result = await new Promise((resolveResult, reject) => {
    const child = spawn(psql, ["-X", "-h", "127.0.0.1", "-p", port, "-U", user,
      "-d", database, "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-Atq"], { env, windowsHide: true });
    let stdout = "", stderr = "";
    child.stdout.on("data", (data) => stdout += data);
    child.stderr.on("data", (data) => stderr += data);
    child.on("error", reject);
    child.on("close", (code) => resolveResult({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
    child.stdin.end(sql);
  });
  if (result.code !== 0 && !allowFailure) throw new Error(result.stderr);
  return result;
}
function check(name, condition, detail) {
  if (!condition) throw new Error(`${name}: ${detail ?? "assertion failed"}`);
  results.push({ name, passed: true });
  console.log(`PASS ${name}`);
}
const directory = (await query("show data_directory")).stdout.replaceAll("\\", "/").toLowerCase();
if (directory !== resolve(root, `test-results/db-review/${membershipRun ? "membership-cluster" : finalRun ? "final-cluster" : restricted ? "restricted-cluster" : "cluster"}`).replaceAll("\\", "/").toLowerCase())
  throw new Error("Refusing to mutate: server is not the dedicated disposable cluster.");
const version = (await query("select version()")).stdout;
if (restricted) await query("do $$ begin if not exists(select 1 from pg_roles where rolname='postgres') then create role postgres login nosuperuser createdb createrole bypassrls; end if; end $$;");
await query("do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end $$;");
if (membershipRun) await query(`do $$ begin
  if not exists(select 1 from pg_roles where rolname='authenticator') then create role authenticator login noinherit; end if;
  if not exists(select 1 from pg_roles where rolname='supabase_realtime_admin') then create role supabase_realtime_admin login; end if;
end $$;
grant anon, authenticated to authenticator, postgres, supabase_realtime_admin;`);
const reuse = process.argv.includes("--reuse");
const database = reuse ? JSON.parse(await readFile("test-results/db-review/results.json", "utf8")).database
  : `paylink_review_${randomUUID().replaceAll("-", "")}`;
if (!/^paylink_review_[a-f0-9]{32}$/.test(database)) throw new Error("Invalid disposable database name");
if (!reuse) {
  await query(`create database ${database} owner postgres`);
  await query(await readFile("supabase/tests/schema-fixture.sql", "utf8"), database, false, "postgres");
}
if (process.argv.includes("--baseline")) {
  const baseline = await query(await readFile("test-results/db-review/original-migration.sql", "utf8"), database, true);
  console.log(JSON.stringify({ version, exitCode: baseline.code, error: baseline.stderr }));
  await writeFile("test-results/db-review/baseline.json", JSON.stringify(baseline, null, 2));
  process.exit(baseline.code === 0 ? 1 : 0);
}
const migration = await readFile("supabase/proposals/003_adapt_verified_payment_requests.sql", "utf8");
const hash = createHash("sha256").update(migration).digest("hex");
if (!reuse) await query(migration, database, false, "postgres");
check("Complete migration executes and commits", true);
if(restricted) check("Migration runs as non-superuser postgres with CREATEROLE",(await query("select not rolsuper and rolcreaterole from pg_roles where rolname='postgres'")).stdout==="t");
if(membershipRun) check("Expected Supabase memberships do not trip migration preflight",
  (await query("select count(*) from pg_auth_members m join pg_roles r on r.oid=m.roleid where r.rolname in ('anon','authenticated') and pg_get_userbyid(m.member) in ('authenticator','postgres','supabase_realtime_admin')")).stdout==="6");
const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
const userC = "33333333-3333-4333-8333-333333333333";
const recipient = "0x1234567890123456789012345678901234567890";
const quote = (value) => value === null ? "null" : `'${String(value).replaceAll("'", "''")}'`;
const rpc = (options = {}) => {
  const p = { submission: randomUUID(), amount: "0.000001", recipient, name: "Ada", description: "Review fixture",
    expiry: null, token: "USDC", chain: 10143, ...options };
  return `public.paylink_create_payment_request_v2(${[p.submission,p.amount,p.recipient,p.name,p.description,p.expiry,p.token,p.chain].map(quote).join(",")})`;
};
async function as(role, uid, sql, allowFailure = false) {
  // Simulates the verified JWT context, not the Auth service or PostgREST itself.
  return query(`set session authorization ${role}; set request.jwt.claim.sub = ${quote(uid ?? "")}; ${sql}`, database, allowFailure);
}
async function denied(name, sql, code = "42501", role = "authenticated", uid = userA) {
  const result = await as(role, uid, sql, true);
  check(name, result.code !== 0 && result.stderr.includes(code), result.stderr || result.stdout);
}
const lastJson = (result) => JSON.parse(result.stdout.split(/\r?\n/).at(-1));
async function create(options = {}, uid = userA) {
  return lastJson(await as("authenticated", uid, `select row_to_json(r) from ${rpc(options)} r;`));
}
const firstSubmission = randomUUID();
const first = await create({ submission: firstSubmission, amount: "999999999.123456" });
check("RETURN QUERY and nested function invocation return exact USDC text", first.amount === "999999999.123456" && first.status === "pending" && first.token_symbol === "USDC");
const mon = await create({ token: "MON", amount: "0.000000000000000001" });
check("MON stores and returns 18-decimal precision", mon.amount === "0.000000000000000001");
const claimsSubmission = randomUUID();
const claimsOnly = lastJson(await query(`set session authorization authenticated;
  set request.jwt.claim.sub = '';
  set request.jwt.claims = ${quote(JSON.stringify({ sub: userA, role: "authenticated" }))};
  select row_to_json(r) from ${rpc({ submission: claimsSubmission })} r;`, database));
check("Current JSON JWT claims establish server-verified ownership", claimsOnly.id &&
  (await query(`select owner_id from public.payment_requests where id=${quote(claimsOnly.id)}`,database)).stdout===userA);
const details = lastJson(await query(`select row_to_json(r) from public.payment_requests r where id=${quote(first.id)}`, database));
check("Verified owner and null settlement fields are stored", details.owner_id === userA && details.creator_wallet === null && details.transaction_hash === null && details.paid_at === null);
const publicRow = lastJson(await as("anon", null, `select row_to_json(r) from public.paylink_get_payment_request_v2(${quote(first.id)}) r`));
check("Public UUID read is exactly allowlisted", Object.keys(publicRow).sort().join() === ["id","amount","recipient_wallet","recipient_name","description","token_symbol","network","status","created_at","expires_at"].sort().join());
check("Unknown public UUID reveals no row", (await as("anon", null, `select count(*) from public.paylink_get_payment_request_v2(${quote(randomUUID())})`)).stdout === "0");
check("Owner SELECT sees their rows", (await as("authenticated", userA, `select count(*) from public.payment_requests where id=${quote(first.id)}`)).stdout === "1");
check("Other owner SELECT cannot see the row", (await as("authenticated", userB, `select count(*) from public.payment_requests where id=${quote(first.id)}`)).stdout === "0");
await denied("Anon cannot list the table", "select * from public.payment_requests", "42501", "anon", null);
await denied("Anon cannot invoke creation", `select * from ${rpc()}`, "42501", "anon", null);
await denied("Missing Auth identity is rejected", `select * from ${rpc()}`, "PT403", "authenticated", null);
await denied("Direct INSERT is denied", `insert into public.payment_requests(recipient_wallet,amount,owner_id,client_request_id) values(${quote(recipient)},1,${quote(userA)},${quote(randomUUID())})`);
await denied("Direct paid-status UPDATE is denied", `update public.payment_requests set status='paid' where id=${quote(first.id)}`);
await denied("Column-level transaction hash UPDATE is denied", `update public.payment_requests set transaction_hash='0xabc' where id=${quote(first.id)}`);
await denied("Direct DELETE is denied", `delete from public.payment_requests where id=${quote(first.id)}`);
await denied("Client cannot assume SECURITY DEFINER owner role", "set role paylink_request_api");
await denied("Client cannot override RPC owner parameter", `select * from public.paylink_create_payment_request_v2(p_owner_id => ${quote(userB)}::uuid)`, "42883");
const privilege = lastJson(await query(`select json_build_object(
  'authenticated_select',has_table_privilege('authenticated','public.payment_requests','SELECT'),
  'authenticated_select_or_update',has_table_privilege('authenticated','public.payment_requests','SELECT,UPDATE'),
  'authenticated_update',has_table_privilege('authenticated','public.payment_requests','UPDATE'),
  'anon_any',has_table_privilege('anon','public.payment_requests','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'),
  'column_update',has_any_column_privilege('authenticated','public.payment_requests','UPDATE,INSERT,REFERENCES'),
  'api_insert',has_table_privilege('paylink_request_api','public.payment_requests','INSERT'),
  'api_select',has_table_privilege('paylink_request_api','public.payment_requests','SELECT'),
  'api_write',has_table_privilege('paylink_request_api','public.payment_requests','UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'),
  'api_create',has_schema_privilege('paylink_request_api','public','CREATE'),
  'api_auth_usage',has_schema_privilege('paylink_request_api','auth','USAGE'),
  'api_auth_uid',has_function_privilege('paylink_request_api','auth.uid()','EXECUTE'))`, database));
check("Multi-privilege checks use ANY semantics; allowed SELECT does not mask forbidden UPDATE", privilege.authenticated_select && privilege.authenticated_select_or_update && !privilege.authenticated_update && !privilege.anon_any && !privilege.column_update && privilege.api_insert && privilege.api_select && !privilege.api_write && !privilege.api_create);
check("Restricted owner has no managed Auth-schema access", !privilege.api_auth_usage && !privilege.api_auth_uid);
const ownership = lastJson(await query(`select json_build_object('safe',not rolcanlogin and not rolsuper and not rolbypassrls and not rolinherit,
  'not_table_owner',oid<>(select relowner from pg_class where oid='public.payment_requests'::regclass),
  'functions',(select count(*) from pg_proc where proowner=pg_roles.oid and prosecdef and proconfig @> array['search_path=""'])) from pg_roles where rolname='paylink_request_api'`, database));
check("Function owner is restricted and both definer functions pin search_path", ownership.safe && ownership.not_table_owner && ownership.functions === 2);
for (const [name, options] of [
  ["excess USDC precision",{amount:"0.0000001"}], ["excess MON precision",{token:"MON",amount:"0.0000000000000000001"}],
  ["zero",{amount:"0"}], ["negative",{amount:"-1"}], ["scientific notation",{amount:"1e-6"}], ["NaN",{amount:"NaN"}],
  ["Infinity",{amount:"Infinity"}], ["wrong chain",{chain:143}], ["wrong token",{token:"USDT"}],
  ["zero recipient",{recipient:"0x"+"0".repeat(40)}], ["past expiry",{expiry:"2020-01-01T00:00:00Z"}],
  ["infinite expiry",{expiry:"infinity"}], ["missing token",{token:null}], ["missing submission",{submission:null}],
]) await denied(`RPC rejects ${name}`, `select * from ${rpc(options)}`, "PT400");
const again = await create({ submission:firstSubmission, amount:"999999999.123456" });
check("Idempotent retry returns original ID", again.id === first.id);
await denied("Changed token under same submission is rejected", `select * from ${rpc({submission:firstSubmission,amount:"999999999.123456",token:"MON"})}`, "PT409");
const b = await create({submission:firstSubmission,amount:"999999999.123456"},userB);
check("Submission IDs are scoped by Auth owner", b.id !== first.id);
const decimalId=randomUUID();
const decimal=await create({submission:decimalId,amount:"12.340000"});
check("Equivalent decimal retries preserve value and ID", (await create({submission:decimalId,amount:"12.34"})).id === decimal.id && decimal.amount === "12.34");
const concurrentId=randomUUID();
const concurrent=await Promise.all(Array.from({length:8},()=>create({submission:concurrentId})));
check("Eight independent concurrent sessions create one row", new Set(concurrent.map(r=>r.id)).size===1 &&
  (await query(`select count(*) from public.payment_requests where client_request_id=${quote(concurrentId)}`,database)).stdout==="1");
// A long transaction must not accept an expiry that passed after transaction start.
await denied("Expiry is checked against wall clock after transaction delay",
  `begin; select pg_sleep(1.1); select * from public.paylink_create_payment_request_v2(${quote(randomUUID())},'1',${quote(recipient)},'Ada','Expiry fixture',transaction_timestamp()+interval '0.5 seconds','MON',10143); commit;`, "PT400");
// Separate owner has no rows. Race 32 independent sessions against the 30/hour quota.
const quota=await Promise.all(Array.from({length:32},()=>as("authenticated",userC,`select row_to_json(r) from ${rpc()} r`,true)));
check("Concurrent quota is atomic: exactly 30 commits and 2 rejections", quota.filter(r=>r.code===0).length===30 && quota.filter(r=>r.stderr.includes("PT429")).length===2);
const quotaSaved=lastJson(await query(`select row_to_json(r) from public.payment_requests r where owner_id=${quote(userC)} limit 1`,database));
check("Idempotent retry still succeeds when quota is full", (await create({submission:quotaSaved.client_request_id},userC)).id===quotaSaved.id);
// Compare original metadata against a fresh matching baseline, without dropping any objects.
const reference=`paylink_review_${randomUUID().replaceAll("-", "")}`;
await query(`create database ${reference}`);
await query(await readFile("supabase/tests/schema-fixture.sql","utf8"),reference);
const snapshot=`select json_build_object('columns',(select json_agg(t order by ordinal_position) from
  (select column_name,data_type,is_nullable,column_default,ordinal_position from information_schema.columns where table_schema='public' and table_name='payment_requests' and ordinal_position<=12)t),
  'constraints',(select json_agg(t order by conname) from (select conname,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.payment_requests'::regclass and conname in ('payment_requests_pkey','payment_requests_amount_check','payment_requests_status_check'))t),
  'indexes',(select json_agg(t order by indexname) from (select indexname,indexdef from pg_indexes where schemaname='public' and tablename='payment_requests' and indexname like 'payment_requests_%')t))`;
check("Original 12 columns/defaults/checks/indexes are unchanged", (await query(snapshot,database)).stdout===(await query(snapshot,reference)).stdout);
await query(await readFile("supabase/audit-payment-requests.sql","utf8"),database);
check("Expanded audit SQL executes on PostgreSQL",true);
await query(await readFile("supabase/final-readiness-audit.sql","utf8"),database);
check("Final production-readiness audit SQL executes on PostgreSQL",true);
// Run drift/dependency failures on the untouched reference, keeping the tested migrated DB intact.
for (const [name, change, expected] of [
  ["incompatible existing status check", "alter table public.payment_requests drop constraint payment_requests_status_check; alter table public.payment_requests add constraint payment_requests_status_check check(status='paid');", "rejects supported"],
  ["incompatible existing amount check", "alter table public.payment_requests drop constraint payment_requests_amount_check; alter table public.payment_requests add constraint payment_requests_amount_check check(amount>=1);", "rejects supported"],
  ["new data", `insert into public.payment_requests(recipient_wallet,amount) values(${quote(recipient)},1);`, "table is no longer empty"],
  ["existing policy", "create policy existing_review_policy on public.payment_requests for select using(true);", "policies already exist"],
  ["dependent view", "create view public.review_dependent as select id from public.payment_requests;", "rules/views require review"],
  ["incoming foreign key", "create table public.review_fk(id uuid references public.payment_requests(id));", "incoming foreign keys"],
  ["existing trigger", "create function public.review_trigger() returns trigger language plpgsql as $$begin return new; end;$$; create trigger review_trigger before insert on public.payment_requests for each row execute function public.review_trigger();", "user triggers require review"],
  ["existing request function", "create function public.review_function() returns bigint language sql as $$select count(*) from public.payment_requests$$;", "existing request functions"],
]) {
  // Entire negative scenario rolls back on error. These changes exist ONLY in the disposable reference.
  const drift=await query(`begin; ${change}\n${migration.replace(/^begin;$/m,"")}`,reference,true);
  check(`Preflight refuses ${name} without partial changes`,drift.code!==0 && drift.stderr.includes(expected),drift.stderr);
  check(`Rollback leaves reference at 12 columns after ${name}`,
    (await query("select count(*) from information_schema.columns where table_schema='public' and table_name='payment_requests'",reference)).stdout==="12");
}
await as("authenticated",userA,`create temp table payment_requests(id uuid); set search_path=pg_temp,public;
  select * from public.paylink_get_payment_request_v2(${quote(first.id)});`);
check("Temporary table and altered caller search_path cannot redirect public read",true);
const countBefore=(await query("select count(*) from public.payment_requests",database)).stdout;
await query(await readFile("supabase/proposals/rollback_disable_request_access.sql","utf8"),database);
await denied("Containment rollback disables authenticated creation",`select * from ${rpc()}`);
await denied("Containment rollback disables public UUID read",`select * from public.paylink_get_payment_request_v2(${quote(first.id)})`,"42501","anon",null);
await denied("Containment rollback disables owner table read","select * from public.payment_requests");
check("Containment rollback preserves all data and original schema",(await query("select count(*) from public.payment_requests",database)).stdout===countBefore && (await query(snapshot,database)).stdout===(await query(snapshot,reference)).stdout);
await writeFile("test-results/db-review/results.json", JSON.stringify({ version, database, migrationSha256: hash,
  migrationRole: restricted ? "non-superuser postgres with CREATEROLE/CREATEDB/BYPASSRLS" : "local postgres superuser",
  fixtureLimit: "Matching supplied columns and confirmed amount/status checks; minimal auth.uid/users stand-ins, not hosted Supabase.", results }, null, 2));
console.log(`${results.length} database checks passed.`);
