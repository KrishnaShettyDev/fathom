import { existsSync, readFileSync, readdirSync } from "node:fs";

const envFile = "apps/web/.env.local";
if (existsSync(envFile)) process.loadEnvFile(envFile);
const base = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!base || !key) {
  console.error(
    "Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in the web environment.",
  );
  process.exit(1);
}
let origin;
try {
  origin = new URL(base);
} catch {
  throw new Error("Supabase URL is invalid.");
}
if (
  !["https:", "http:"].includes(origin.protocol) ||
  origin.username ||
  origin.password ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash
) {
  throw new Error(
    "Supabase URL must be an HTTP(S) origin without credentials, path or query.",
  );
}
if (
  origin.protocol !== "https:" &&
  !["localhost", "127.0.0.1"].includes(origin.hostname)
) {
  throw new Error("Hosted Supabase requires HTTPS.");
}
if (key.startsWith("sb_secret_"))
  throw new Error("Use a publishable key, never a secret key.");
if (key.startsWith("eyJ")) {
  let claims;
  try {
    claims = JSON.parse(
      Buffer.from(key.split(".")[1] ?? "", "base64url").toString(),
    );
  } catch {
    throw new Error("Invalid legacy anon key.");
  }
  if (claims?.role !== "anon")
    throw new Error("Only anon/publishable keys are allowed.");
} else if (!key.startsWith("sb_publishable_"))
  throw new Error("Unrecognized publishable key format.");
let failed = false;
async function get(path) {
  try {
    const response = await fetch(new URL(path, origin), {
      headers: { apikey: key },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json();
    return { status: response.status, body };
  } catch {
    return { status: 0, body: null };
  }
}
console.log(
  `Checking ${origin.hostname}; no users, emails or business records will be created.`,
);
const auth = await get("/auth/v1/settings");
if (auth.status !== 200) {
  failed = true;
  console.error(
    `Auth settings unavailable (HTTP ${auth.status || "unreachable"}).`,
  );
} else
  console.log(
    `Auth reachable; email enabled: ${auth.body?.external?.email === true}; signup disabled: ${auth.body?.disable_signup === true}. Email delivery is not verified.`,
  );
const jwks = await get("/auth/v1/.well-known/jwks.json");
if (jwks.status !== 200 || !Array.isArray(jwks.body?.keys)) {
  failed = true;
  console.error("Public signing-key endpoint unavailable.");
} else console.log(`Public signing keys: ${jwks.body.keys.length}.`);
if (failed) {
  console.error(
    "NOT READY: resolve Auth connectivity before checking the schema.",
  );
  process.exit(1);
}
const tables = new Set();
for (const file of readdirSync("supabase/migrations").filter((name) =>
  name.endsWith(".sql"),
)) {
  for (const match of readFileSync(
    `supabase/migrations/${file}`,
    "utf8",
  ).matchAll(/create\s+table\s+public\.([a-z_]+)/gi))
    tables.add(match[1]);
}
let available = 0;
const missing = [];
for (const table of [...tables].sort()) {
  const result = await get(`/rest/v1/${table}?select=*&limit=0`);
  if (
    result.status === 200 &&
    Array.isArray(result.body) &&
    result.body.length === 0
  )
    available++;
  else if (result.status === 403 && result.body?.code === "42501") available++;
  else {
    failed = true;
    missing.push({
      table,
      status: result.status,
      code:
        typeof result.body?.code === "string" &&
        /^[A-Z0-9_]{1,32}$/.test(result.body.code)
          ? result.body.code
          : "unavailable",
    });
  }
}
console.log(
  `Schema preflight: ${available}/${tables.size} required tables recognized by the API. Anonymous permission denial is expected for protected tables.`,
);
for (const result of missing)
  console.error(
    `${result.table}: HTTP ${result.status || "unreachable"}, ${result.code}`,
  );
if (failed) {
  console.error(
    "NOT READY: verify the project/key and inspect hosted migration history before applying repository migrations. No schema changes were made.",
  );
  process.exitCode = 1;
} else
  console.log(
    "Public connectivity/schema preflight passed. This does not verify migration versions, authenticated RLS, SMTP or direct database access.",
  );
