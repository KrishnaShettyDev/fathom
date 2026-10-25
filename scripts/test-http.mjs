import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readdirSync, readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const id = randomUUID().replaceAll("-", "");
const database = `fathom_http_verify_${id}`;
const restName = `fathom-http-${id}`;
const databaseContainer = "supabase_db_fathom";
function command(file, args, input) {
  try {
    return execFileSync(file, args, {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 30_000_000,
    });
  } catch {
    throw new Error(
      `Local HTTP test infrastructure command failed (${file}). Credentials and command output withheld.`,
    );
  }
}
function sql(db, text) {
  return command(
    "docker",
    [
      "exec",
      "-i",
      databaseContainer,
      "psql",
      "-U",
      "postgres",
      "-d",
      db,
      "-v",
      "ON_ERROR_STOP=1",
    ],
    text,
  );
}
async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return address.port;
}
async function waitFor(url, process) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (process && process.exitCode !== null)
      throw new Error("Isolated web server exited before readiness.");
    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(1000),
      });
      if (response.status < 500) return;
    } catch {
      /* Service startup is bounded below. */
    }
    await delay(200);
  }
  throw new Error("Isolated HTTP service readiness timed out.");
}
const status = JSON.parse(command("npx", ["supabase", "status", "-o", "json"]));
const authOrigin = new URL(status.API_URL);
assert.ok(
  ["127.0.0.1", "localhost"].includes(authOrigin.hostname),
  "Only local Supabase is allowed",
);
const dbOrigin = new URL(status.DB_URL);
assert.ok(["127.0.0.1", "localhost"].includes(dbOrigin.hostname));
const admin = createClient(authOrigin.href, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const principals = [];
let webLogs = "";
let authUnavailable = false;
let restUnavailable = false;
let databaseCreated = false,
  restCreated = false,
  web = null,
  router = null;
try {
  sql("postgres", `create database ${database};`);
  databaseCreated = true;
  const authSchema = command("docker", [
    "exec",
    databaseContainer,
    "pg_dump",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "--schema-only",
    "--no-owner",
    "--no-privileges",
    "--schema=auth",
  ]);
  sql(database, authSchema);
  sql(
    database,
    "create schema extensions; grant usage on schema public,extensions,auth to authenticated,anon;",
  );
  for (const migration of readdirSync("supabase/migrations")
    .filter((file) => file.endsWith(".sql"))
    .sort())
    sql(database, readFileSync(`supabase/migrations/${migration}`, "utf8"));
  // Reuse the local service's exact JWT verification configuration without printing it.
  const existing = JSON.parse(
    command("docker", ["inspect", "supabase_rest_fathom"]),
  )[0];
  const jwt = existing.Config.Env.find((value) =>
    value.startsWith("PGRST_JWT_SECRET="),
  );
  assert.ok(jwt, "Local PostgREST JWT verifier required");
  const network = Object.keys(existing.NetworkSettings.Networks)[0];
  assert.ok(network);
  // Sensitive configuration passes via child environment, not shell arguments.
  const internalDb = new URL(dbOrigin);
  internalDb.hostname = databaseContainer;
  internalDb.port = "5432";
  internalDb.pathname = `/${database}`;
  const dockerEnv = {
    ...process.env,
    PGRST_JWT_SECRET: jwt.slice("PGRST_JWT_SECRET=".length),
    PGRST_DB_URI: internalDb.href,
  };
  try {
    execFileSync(
      "docker",
      [
        "run",
        "-d",
        "--name",
        restName,
        "--network",
        network,
        "-p",
        "127.0.0.1::3000",
        "-e",
        "PGRST_JWT_SECRET",
        "-e",
        "PGRST_DB_URI",
        "-e",
        "PGRST_DB_ANON_ROLE=anon",
        "-e",
        "PGRST_DB_SCHEMAS=public",
        existing.Config.Image,
      ],
      { env: dockerEnv, stdio: ["ignore", "pipe", "pipe"] },
    );
    restCreated = true;
  } catch {
    restCreated =
      spawnSync("docker", ["container", "inspect", restName], {
        stdio: "ignore",
      }).status === 0;
    throw new Error("Disposable PostgREST could not start.");
  }
  const restInfo = JSON.parse(command("docker", ["inspect", restName]))[0];
  const restPort = restInfo.NetworkSettings.Ports["3000/tcp"][0].HostPort;
  const restOrigin = `http://127.0.0.1:${restPort}`;
  await waitFor(restOrigin);
  router = createServer(async (req, res) => {
    try {
      const path = req.url ?? "/";
      const auth = path.startsWith("/auth/v1/");
      const rest = path.startsWith("/rest/v1/");
      if ((auth && authUnavailable) || (rest && restUnavailable)) {
        res.writeHead(503, { "Content-Type": "application/json" }).end(
          JSON.stringify({
            message: "Isolated test service unavailable",
            code: "unexpected_failure",
          }),
        );
        return;
      }
      if (!auth && !rest) {
        res.writeHead(404).end();
        return;
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (
          value !== undefined &&
          !["host", "content-length", "connection"].includes(name)
        )
          headers.set(name, Array.isArray(value) ? value.join(",") : value);
      }
      const chunks = [];
      let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 100_000) {
          res.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      const response = await fetch(
        auth
          ? new URL(path, authOrigin)
          : `${restOrigin}${path.slice("/rest/v1".length)}`,
        {
          method: req.method,
          headers,
          ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
          redirect: "manual",
          signal: AbortSignal.timeout(30_000),
        },
      );
      const responseHeaders = {};
      for (const [name, value] of response.headers) {
        if (
          ![
            "content-encoding",
            "content-length",
            "transfer-encoding",
            "connection",
          ].includes(name)
        )
          responseHeaders[name] = value;
      }
      res.writeHead(response.status, responseHeaders);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(502).end("Local test upstream unavailable");
    }
  });
  const routerOrigin = `http://127.0.0.1:${await listen(router)}`;
  async function principal(label) {
    const email = `http-${label}-${id}@example.invalid`;
    const link = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    assert.equal(link.error, null);
    assert.ok(link.data.user?.id);
    principals.push(link.data.user.id);
    const jar = new Map();
    const client = createServerClient(routerOrigin, status.ANON_KEY, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (values) => {
          for (const { name, value } of values) {
            if (value) jar.set(name, value);
            else jar.delete(name);
          }
        },
      },
    });
    const verified = await client.auth.verifyOtp({
      email,
      token: link.data.properties.email_otp,
      type: "email",
    });
    assert.equal(verified.error, null);
    // Values are generated identifiers and fixed-domain test emails, never user input.
    sql(
      database,
      `insert into auth.users(id,email,email_confirmed_at) values('${link.data.user.id}','${email}',now());`,
    );
    return { client, jar, email, id: link.data.user.id };
  }
  const owner = await principal("owner");
  const other = await principal("other");
  const agency = await principal("agency");
  async function rpc(person, name, args) {
    const result = await person.client.rpc(name, args);
    assert.equal(result.error, null, `${name} should succeed`);
    return result.data;
  }
  const brand = await rpc(owner, "create_owner_workspace", {
    organization_name: "HTTP test owner",
    brand_name: `Private brand ${id}`,
    timezone_name: "UTC",
    website_url: "",
    onboarding_request_id: randomUUID(),
    owner_attested: true,
  });
  const otherBrand = await rpc(other, "create_owner_workspace", {
    organization_name: "Other owner",
    brand_name: "Unrelated HTTP brand",
    timezone_name: "UTC",
    website_url: "",
    onboarding_request_id: randomUUID(),
    owner_attested: true,
  });
  const today = new Date().toISOString().slice(0, 10);
  const report = await rpc(owner, "create_client_report", {
    target_brand: brand,
    creation_request_id: randomUUID(),
    report_title: `Private report ${id}`,
    start_date: today,
    end_date: today,
    report_annotation: "Isolated HTTP fixture",
  });
  const invitation = await rpc(owner, "create_brand_invitation", {
    target_brand: brand,
    email_address: agency.email,
    requested_access: "analyst",
    invitation_request_id: randomUUID(),
  });
  const agencyId = await rpc(agency, "create_agency", {
    agency_name: "HTTP test agency",
    creation_request_id: randomUUID(),
  });
  await rpc(agency, "accept_brand_invitation", {
    invitation,
    agency: agencyId,
  });
  const grants = await owner.client
    .from("brand_access_grants")
    .select("id")
    .eq("brand_id", brand);
  assert.equal(grants.error, null);
  assert.equal(grants.data.length, 1);
  const portHolder = createServer();
  const webPort = await listen(portHolder);
  await new Promise((resolve) => portHolder.close(resolve));
  const appDb = new URL(dbOrigin);
  appDb.pathname = `/${database}`;
  web = spawn(
    process.execPath,
    [
      "../../node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(webPort),
    ],
    {
      cwd: "apps/web",
      env: {
        ...process.env,
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        SUPABASE_URL: routerOrigin,
        SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
        DATABASE_URL: appDb.href,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const captureLog = (chunk) => {
    webLogs = (webLogs + chunk.toString()).slice(-200_000);
  };
  web.stdout.on("data", captureLog);
  web.stderr.on("data", captureLog);
  const origin = `http://127.0.0.1:${webPort}`;
  await waitFor(`${origin}/login`, web);
  function cookies(person, selectedBrand = brand) {
    return [...person.jar]
      .map(([name, value]) => `${name}=${value}`)
      .concat(`fathom-brand=${selectedBrand}`)
      .join("; ");
  }
  function request(path, person, selectedBrand = brand) {
    return fetch(`${origin}${path}`, {
      headers: person ? { Cookie: cookies(person, selectedBrand) } : {},
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
  }
  const anonymous = await request(`/api/reports/${report}/download`);
  assert.equal(anonymous.status, 401);
  assert.ok(!(await anonymous.text()).includes(`Private report ${id}`));
  assert.equal(
    (await request(`/api/brands/${brand}/export`)).status,
    401,
    "Anonymous owner export requires authentication",
  );
  const own = await request(`/api/reports/${report}/download`, owner);
  assert.equal(own.status, 200);
  assert.ok(own.headers.get("cache-control").includes("no-store"));
  assert.ok(own.headers.get("content-disposition").includes("attachment"));
  assert.equal((await own.json()).snapshot.brand.id, brand);
  const ownPage = await request(`/reports/${report}`, owner);
  assert.equal(ownPage.status, 200);
  assert.ok((await ownPage.text()).includes(`Private report ${id}`));
  for (const path of [
    `/api/reports/${report}/download`,
    `/api/brands/${brand}/export`,
    `/reports/${report}`,
  ]) {
    const denied = await request(path, other, otherBrand);
    assert.equal(denied.status, 404, `Cross-brand ${path} denied`);
    assert.ok(!(await denied.text()).includes(`Private report ${id}`));
  }
  const tamperedSelection = await request(`/reports/${report}`, other, brand);
  const tamperedBody = await tamperedSelection.text();
  assert.ok(
    !tamperedBody.includes(`Private report ${id}`) &&
      !tamperedBody.includes(`Private brand ${id}`),
    "Workspace cookie cannot grant access to another tenant",
  );
  const support = await rpc(owner, "grant_support_session", {
    target_brand: brand,
    email_address: other.email,
    purpose_text: "Isolated HTTP support test",
    requested_access: "analyst",
    duration_hours: 1,
  });
  assert.equal(
    (await request(`/api/reports/${report}/download`, other)).status,
    200,
    "Unexpired support grant permits reading",
  );
  assert.equal(
    (await request(`/api/brands/${brand}/export`, other)).status,
    404,
    "Support is not owner export authority",
  );
  sql(
    database,
    `update public.support_sessions set created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' where id='${support}';`,
  );
  assert.equal(
    (await request(`/api/reports/${report}/download`, other)).status,
    404,
    "Support expiry applies to an existing login session",
  );
  const forged = await other.client.rpc("update_brand_settings", {
    target_brand: brand,
    brand_name: "Unauthorized overwrite",
    website_url: "",
    timezone_name: "UTC",
  });
  assert.equal(forged.error?.code, "42501");
  assert.equal(
    (await request(`/api/reports/${report}/download`, agency)).status,
    200,
  );
  assert.equal(
    (await request(`/api/brands/${brand}/export`, agency)).status,
    404,
  );
  const exported = await request(`/api/brands/${brand}/export`, owner);
  assert.equal(exported.status, 200);
  const records = (await exported.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(records.at(-1).type, "complete");
  assert.ok(
    records.every(
      (row) =>
        row.type !== "record" ||
        (row.record.brand_id ??
          row.record.accepted_brand_id ??
          row.record.id) === brand,
    ),
  );
  await rpc(owner, "revoke_agency_access", {
    target_brand: brand,
    access_grant: grants.data[0].id,
  });
  assert.equal(
    (await request(`/api/reports/${report}/download`, agency)).status,
    404,
    "Existing cookie loses access immediately after revocation",
  );
  const revokedList = await agency.client.from("client_reports").select("id");
  assert.equal(revokedList.error, null);
  assert.deepEqual(revokedList.data, []);
  for (const service of ["auth", "rest"]) {
    authUnavailable = service === "auth";
    restUnavailable = service === "rest";
    for (const path of [
      `/api/reports/${report}/download`,
      `/api/brands/${brand}/export`,
    ]) {
      const unavailable = await request(path, owner);
      assert.equal(
        unavailable.status,
        503,
        `${service} outage stays distinguishable from missing access`,
      );
      assert.ok(unavailable.headers.get("cache-control").includes("no-store"));
      const requestId = unavailable.headers.get("x-request-id");
      assert.match(requestId, /^[a-f0-9-]{36}$/);
      let event;
      for (let attempt = 0; attempt < 20 && !event; attempt++) {
        for (const line of webLogs.split("\n")) {
          let candidate;
          try {
            candidate = JSON.parse(line);
          } catch {
            continue;
          }
          if (
            candidate?.event === "download.unavailable" &&
            candidate.request_id === requestId
          ) {
            event = candidate;
            break;
          }
        }
        if (!event) await delay(25);
      }
      assert.ok(
        event,
        "Error response trace ID has a corresponding structured log",
      );
      assert.equal(event.stage, service === "auth" ? "auth" : "database");
      assert.deepEqual(Object.keys(event).sort(), [
        "event",
        "request_id",
        "route",
        "stage",
      ]);
      assert.ok(!(await unavailable.text()).includes(`Private report ${id}`));
    }
  }
  assert.ok(
    !webLogs.includes(status.SERVICE_ROLE_KEY) &&
      !webLogs.includes(status.ANON_KEY),
    "Local credentials never appear in web logs",
  );
  authUnavailable = false;
  restUnavailable = false;
  console.log(
    "PASS: real OTP cookies, production Next pages/downloads, separate tenant denial, actual HTTP RPC enforcement, owner export scoping, selection-cookie tampering, support expiry, same-session agency revocation and safe auth/database outage responses.",
  );
} finally {
  const cleanupErrors = [];
  async function cleanup(label, operation) {
    try {
      await operation();
    } catch {
      cleanupErrors.push(label);
    }
  }
  await cleanup("web process", async () => {
    if (web && web.exitCode === null && web.signalCode === null) {
      const exited = new Promise((resolve) => web.once("exit", resolve));
      web.kill("SIGTERM");
      await Promise.race([exited, delay(5000)]);
      if (web.exitCode === null && web.signalCode === null) {
        web.kill("SIGKILL");
        await exited;
      }
    }
  });
  await cleanup("test HTTP router", async () => {
    if (router) {
      router.closeAllConnections();
      await new Promise((resolve, reject) =>
        router.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
  await cleanup("test REST container", () => {
    if (restCreated) command("docker", ["rm", "-f", restName]);
  });
  await cleanup("test database", () => {
    if (databaseCreated)
      sql("postgres", `drop database ${database} with (force);`);
  });
  for (const user of principals)
    await cleanup("test auth principal", async () => {
      const result = await admin.auth.admin.deleteUser(user);
      assert.equal(result.error, null);
    });
  if (cleanupErrors.length)
    throw new Error(
      `HTTP test cleanup failed: ${cleanupErrors.join(", ")}. Inspect test-owned resources before rerunning.`,
    );
}
