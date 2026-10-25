import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import {
  getDatabase,
  closeDatabase,
  encryptCredential,
  ProviderError,
} from "@fathom/connectors";
import { runCatalogue, recordRunError } from "../apps/worker/src/catalogue.ts";
import { brandExport } from "../apps/web/lib/exports/stream.ts";
import { runAnalytics } from "../apps/worker/src/analytics.ts";
import { runResearch } from "../apps/worker/src/research.ts";
import { reconcileStoppedJobs } from "../apps/worker/src/recovery.ts";
import { PgBoss } from "pg-boss";
import { startQueues } from "../apps/worker/src/queue.ts";
const databaseName = `fathom_worker_verify_${randomUUID().replaceAll("-", "")}`;
const container = "supabase_db_fathom";
function docker(args, input) {
  const result = spawnSync("docker", ["exec", "-i", container, ...args], {
    input,
    encoding: "utf8",
    maxBuffer: 20_000_000,
  });
  if (result.status !== 0)
    throw new Error(`Local test database operation failed: ${result.stderr}`);
  return result.stdout;
}
const previousFetch = globalThis.fetch;
const key = randomBytes(32);
const actor = randomUUID();
let queues = null;
let created = false;
try {
  docker([
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `create database ${databaseName}`,
  ]);
  created = true;
  docker([
    "psql",
    "-U",
    "postgres",
    "-d",
    databaseName,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop schema public",
  ]);
  const schema = docker([
    "pg_dump",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "--schema-only",
    "--no-owner",
    "--no-privileges",
    "--schema=auth",
    "--schema=public",
    "--schema=private",
    "--schema=audit",
  ]);
  docker(
    ["psql", "-U", "postgres", "-d", databaseName, "-v", "ON_ERROR_STOP=1"],
    schema,
  );
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:55432/${databaseName}`;
  process.env.CREDENTIAL_KEY_VERSION = "test";
  process.env.CREDENTIAL_KEYS_JSON = JSON.stringify({
    test: key.toString("base64"),
  });
  let db = getDatabase();
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
    [actor, `${actor}@example.invalid`],
  );
  const session = await db.connect();
  let brand, source, run;
  try {
    await session.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: actor, role: "authenticated" }),
    ]);
    brand = (
      await session.query(
        "select public.create_owner_workspace('Test organization','Test brand','UTC','', $1,true) id",
        [randomUUID()],
      )
    ).rows[0].id;
    source = (
      await session.query(
        "select public.register_brand_source($1,'shopify','Isolated test shop','worker-test.myshopify.com') id",
        [brand],
      )
    ).rows[0].id;
    await session.query(
      "update public.brand_sources set state='authorized',verified_account='worker-test.myshopify.com',version=2 where id=$1",
      [source],
    );
    await session.query(
      "insert into private.connector_credentials(source_id,brand_id,encrypted_value,key_version,expires_at) values($1,$2,$3,$4,now()+interval '1 hour')",
      [
        source,
        brand,
        encryptCredential(
          {
            access_token: "test-only-access",
            refresh_token: "test-only-refresh",
            expires_in: 3600,
            scope: "read_products",
          },
          key,
          `${brand}:${source}`,
        ),
        "test",
      ],
    );
    run = (
      await session.query("select public.request_source_sync($1,$2,$3) id", [
        brand,
        source,
        randomUUID(),
      ])
    ).rows[0].id;
  } finally {
    session.release();
  }
  let failSecondPage = true;
  let revokeDuringRequest = false;
  const visited = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(
      String(input),
      "https://worker-test.myshopify.com/admin/api/2026-07/graphql.json",
    );
    const body = JSON.parse(init.body);
    const phase = body.query.includes("CatalogueProducts")
      ? "products"
      : body.query.includes("CatalogueVariants")
        ? "variants"
        : "collections";
    visited.push(`${phase}:${body.variables.after}`);
    if (revokeDuringRequest) {
      await db.query(
        "update public.brand_memberships set active=false where user_id=$1",
        [actor],
      );
      revokeDuringRequest = false;
    }
    if (
      phase === "products" &&
      body.variables.after === "page-2" &&
      failSecondPage
    ) {
      failSecondPage = false;
      throw new ProviderError("PROVIDER_UNAVAILABLE");
    }
    const nodes =
      phase === "products"
        ? [
            {
              id: `gid://shopify/Product/${body.variables.after ? "2" : "1"}`,
              title: "Isolated fixture",
              status: "ACTIVE",
              updatedAt: "2026-01-01T00:00:00Z",
              descriptionHtml: "<p>Test-only evidence</p>",
            },
          ]
        : phase === "variants"
          ? [
              {
                id: "gid://shopify/ProductVariant/1",
                title: "Test variant",
                product: { id: "gid://shopify/Product/1" },
                price: "12.30",
                inventoryQuantity: 0,
              },
            ]
          : [
              {
                id: "gid://shopify/Collection/1",
                title: "Test collection",
                handle: "test",
                updatedAt: "2026-01-01T00:00:00Z",
                descriptionHtml: "",
              },
            ];
    const hasNextPage = phase === "products" && !body.variables.after;
    return new Response(
      JSON.stringify({
        data: {
          shop: { currencyCode: "USD" },
          [phase === "variants" ? "productVariants" : phase]: {
            nodes,
            pageInfo: { hasNextPage, endCursor: hasNextPage ? "page-2" : null },
          },
        },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  };
  await assert.rejects(
    () => runCatalogue(run, new AbortController().signal),
    /PROVIDER_UNAVAILABLE/,
  );
  assert.equal(
    (
      await db.query("select cursor from public.collection_runs where id=$1", [
        run,
      ])
    ).rows[0].cursor,
    "page-2",
  );
  await runCatalogue(run, new AbortController().signal);
  assert.equal(
    visited.filter((v) => v === "products:null").length,
    1,
    "Retry resumes checkpoint instead of replaying the first page",
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::integer total from public.catalogue_records where source_id=$1",
        [source],
      )
    ).rows[0].total,
    4,
  );
  assert.equal(
    (
      await db.query("select state from public.collection_runs where id=$1", [
        run,
      ])
    ).rows[0].state,
    "complete",
  );
  const oldRun = run;
  const enqueue = async () => {
    const c = await db.connect();
    try {
      await c.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ sub: actor, role: "authenticated" }),
      ]);
      return (
        await c.query("select public.request_source_sync($1,$2,$3) id", [
          brand,
          source,
          randomUUID(),
        ])
      ).rows[0].id;
    } finally {
      c.release();
    }
  };
  await db.query(
    "insert into public.catalogue_records(brand_id,source_id,external_id,kind,title,payload,seen_run_id) values($1,$2,'gid://shopify/Product/old','product','Deleted fixture','{}',$3)",
    [brand, source, oldRun],
  );
  run = await enqueue();
  queues = await startQueues();
  assert.ok(queues);
  for (let attempt = 0; attempt < 40; attempt++) {
    const state = (
      await db.query("select state from public.collection_runs where id=$1", [
        run,
      ])
    ).rows[0].state;
    if (state === "complete") break;
    await delay(250);
  }
  assert.equal(
    (
      await db.query("select state from public.collection_runs where id=$1", [
        run,
      ])
    ).rows[0].state,
    "complete",
    "Real pg-boss dispatch completes persisted outbox intent",
  );
  assert.ok(
    (
      await db.query(
        "select removed_at from public.catalogue_records where external_id='gid://shopify/Product/old'",
      )
    ).rows[0].removed_at,
    "Complete reconciliation tombstones missing products",
  );
  await queues.stop();
  queues = null;
  const nextDb = getDatabase();
  db = nextDb;
  run = await enqueue();
  revokeDuringRequest = true;
  await assert.rejects(
    () => runCatalogue(run, new AbortController().signal),
    /ACCESS_REVOKED/,
  );
  await recordRunError(run, new ProviderError("ACCESS_REVOKED"), false);
  assert.equal(
    (
      await nextDb.query(
        "select state from public.collection_runs where id=$1",
        [run],
      )
    ).rows[0].state,
    "cancelled",
  );
  assert.equal(
    (
      await nextDb.query(
        "select pages from public.collection_runs where id=$1",
        [run],
      )
    ).rows[0].pages,
    0,
    "Revocation during provider request blocks checkpoint commit",
  );
  await db.query(
    "update public.brand_memberships set active=true where user_id=$1",
    [actor],
  );
  const researchSession = await db.connect();
  let observationRun;
  let analyticsRun;
  try {
    await researchSession.query(
      "select set_config('request.jwt.claims',$1,false)",
      [JSON.stringify({ sub: actor, role: "authenticated" })],
    );
    const cohort = (
      await researchSession.query(
        "select public.create_observation_cohort($1,'Isolated questions',array['Which product?'],array['Another brand'],'India','English','test-model',2,true) id",
        [brand],
      )
    ).rows[0].id;
    await researchSession.query(
      "select public.set_observation_allowance($1,2)",
      [brand],
    );
    observationRun = (
      await researchSession.query(
        "select public.request_research($1,'observation',$2,$3) id",
        [brand, cohort, randomUUID()],
      )
    ).rows[0].id;
    const analyticsSource = (
      await researchSession.query(
        "select public.register_brand_source($1,'gsc','Isolated search property','sc-domain:example.invalid') id",
        [brand],
      )
    ).rows[0].id;
    await researchSession.query(
      "update public.brand_sources set state='authorized',verified_account='sc-domain:example.invalid',provider_timezone='America/Los_Angeles',version=2 where id=$1",
      [analyticsSource],
    );
    await researchSession.query(
      "insert into private.connector_credentials(source_id,brand_id,encrypted_value,key_version,expires_at) values($1,$2,$3,'test',now()+interval '1 hour')",
      [
        analyticsSource,
        brand,
        encryptCredential(
          {
            access_token: "test-only",
            refresh_token: "test-only",
            expires_in: 3600,
            scope: "https://www.googleapis.com/auth/webmasters.readonly",
            token_type: "Bearer",
          },
          key,
          `${brand}:${analyticsSource}`,
        ),
      ],
    );
    analyticsRun = (
      await researchSession.query(
        "select public.request_source_sync($1,$2,$3) id",
        [brand, analyticsSource, randomUUID()],
      )
    ).rows[0].id;
  } finally {
    researchSession.release();
  }
  await db.query(
    "insert into private.observation_attempts(run_id,ordinal) values($1,0)",
    [observationRun],
  );
  process.env.OPENAI_API_KEY = "test-only-never-sent";
  process.env.OBSERVATION_MODEL = "test-model";
  let observedRequests = 0;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.openai.com/v1/responses");
    const body = JSON.parse(init.body);
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 1000);
    observedRequests++;
    return new Response(
      JSON.stringify({
        id: "isolated-response",
        model: "test-model",
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              { type: "output_text", text: "Test brand is mentioned." },
            ],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      }),
    );
  };
  await runResearch(observationRun, new AbortController().signal);
  await assert.rejects(
    () => runResearch(observationRun, new AbortController().signal),
    /ACCESS_REVOKED/,
  );
  assert.equal(
    observedRequests,
    1,
    "Interrupted billable request is never replayed",
  );
  assert.deepEqual(
    (
      await db.query(
        "select state from public.observation_samples where run_id=$1 order by ordinal",
        [observationRun],
      )
    ).rows.map((row) => row.state),
    ["unknown", "complete"],
  );
  assert.equal(
    (
      await db.query("select state from public.research_runs where id=$1", [
        observationRun,
      ])
    ).rows[0].state,
    "partial",
  );
  globalThis.fetch = async (input, init) => {
    assert.equal(
      String(input),
      "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.invalid/searchAnalytics/query",
    );
    const body = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        rows: [
          {
            keys: [body.startDate],
            clicks: 0,
            impressions: 0,
            ctr: 0,
            position: 0,
          },
        ],
      }),
    );
  };
  await runAnalytics(analyticsRun, new AbortController().signal);
  const days = (
    await db.query(
      "select state,metrics from public.analytics_days where run_id=$1 order by observed_date",
      [analyticsRun],
    )
  ).rows;
  assert.equal(days.length, 28);
  assert.equal(days[0].metrics.clicks, 0);
  assert.equal(
    days.filter((day) => day.state === "unavailable" && day.metrics === null)
      .length,
    27,
    "Absent analytics dates remain null in real database",
  );
  // A stopped queue job must not leave application state active forever.
  const stoppedRun = randomUUID();
  await db.query(
    "insert into public.research_runs(id,brand_id,actor_id,request_id,kind,target_url,state) values($1,$2,$3,$4,'audit','https://example.invalid','collecting')",
    [stoppedRun, brand, actor, randomUUID()],
  );
  await db.query(
    "insert into private.research_outbox(run_id,dispatched_at) values($1,now()-interval '2 minutes')",
    [stoppedRun],
  );
  const recoveryBoss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
  });
  await recoveryBoss.start();
  try {
    await reconcileStoppedJobs(recoveryBoss);
  } finally {
    await recoveryBoss.stop();
  }
  assert.equal(
    (
      await db.query("select state from public.research_runs where id=$1", [
        stoppedRun,
      ])
    ).rows[0].state,
    "failed",
  );
  const exportBody = await new Response(
    await brandExport(db, actor, brand, new AbortController().signal),
  ).text();
  const exportLines = exportBody.trimEnd().split("\n");
  const exported = exportLines.map((line) => JSON.parse(line));
  const completedExport = exported.at(-1);
  assert.equal(completedExport.type, "complete");
  assert.equal(
    completedExport.sha256,
    createHash("sha256")
      .update(exportLines.slice(0, -1).join("\n") + "\n")
      .digest("hex"),
  );
  assert.ok(exported.some((row) => row.table === "public.observation_samples"));
  assert.ok(exported.some((row) => row.table === "audit.events"));
  assert.ok(
    exported.every(
      (row) => row.type !== "record" || !row.table.startsWith("private."),
    ),
    "Export excludes all credential and attempt tables",
  );
  for (const row of exported.filter((row) => row.type === "record"))
    assert.equal(
      row.record.brand_id ?? row.record.accepted_brand_id ?? row.record.id,
      brand,
      "Every exported record belongs to requested brand",
    );
  const interrupted = await brandExport(
    db,
    actor,
    brand,
    new AbortController().signal,
  );
  const reader = interrupted.getReader();
  await reader.read();
  await db.query(
    "update public.brand_memberships set active=false where user_id=$1",
    [actor],
  );
  let exportRejected = false;
  try {
    while (!(await reader.read()).done) {
      /* Consume until current authority rejection. */
    }
  } catch {
    exportRejected = true;
  } finally {
    reader.releaseLock();
  }
  assert.equal(
    exportRejected,
    true,
    "Midstream revocation interrupts export before completion",
  );
  console.log(
    "PASS: isolated database, encrypted credentials, pagination checkpoint recovery, real pg-boss/outbox execution, deletion reconciliation, mid-request revocation, unknown observation outcomes, analytics missingness, stopped-job recovery, scoped owner export/checksum and midstream revocation.",
  );
} finally {
  globalThis.fetch = previousFetch;
  if (queues) await queues.stop();
  await closeDatabase();
  if (created)
    docker([
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `drop database ${databaseName} with (force)`,
    ]);
}
