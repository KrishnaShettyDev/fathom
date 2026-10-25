import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
const container = "supabase_db_fathom";
const database = `fathom_migration_verify_${randomUUID().replaceAll("-", "")}`;
function docker(args, input) {
  const result = spawnSync("docker", ["exec", "-i", container, ...args], {
    input,
    encoding: "utf8",
    maxBuffer: 30_000_000,
  });
  if (result.status !== 0)
    throw new Error(`Isolated migration rehearsal failed: ${result.stderr}`);
  return result.stdout;
}
function sql(db, input) {
  return docker(
    ["psql", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1"],
    input,
  );
}
let created = false;
try {
  sql("postgres", `create database ${database};`);
  created = true;
  // Supabase owns the auth schema; import its definitions, never user rows.
  const auth = docker([
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
  sql(database, auth);
  sql(
    database,
    "create schema extensions; grant usage on schema public,extensions,auth to authenticated,anon;",
  );
  const migrations = readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of migrations)
    sql(database, readFileSync(`supabase/migrations/${file}`, "utf8"));
  // Verify real enforcement on the freshly migrated schema with rollback fixtures.
  const tests = readdirSync("supabase/tests")
    .filter((name) => name.endsWith(".sql"))
    .sort();
  let assertions = 0;
  for (const file of tests) {
    const result = sql(
      database,
      readFileSync(`supabase/tests/${file}`, "utf8"),
    );
    if (/not ok\s+\d/.test(result))
      throw new Error(`pgTAP assertion failed in ${file}: ${result}`);
    assertions += (result.match(/\bok \d+ -/g) ?? []).length;
  }
  // A schema-only dump restores into another fresh database before any deployment.
  const restore = `${database}_restore`;
  let restoreCreated = false;
  try {
    sql("postgres", `create database ${restore};`);
    restoreCreated = true;
    sql(restore, "drop schema public;");
    const dump = docker([
      "pg_dump",
      "-U",
      "postgres",
      "-d",
      database,
      "--schema-only",
      "--no-owner",
      "--no-privileges",
      "--schema=auth",
      "--schema=public",
      "--schema=private",
      "--schema=audit",
    ]);
    sql(restore, dump);
  } finally {
    if (restoreCreated)
      sql("postgres", `drop database ${restore} with (force);`);
  }
  console.log(
    `PASS: ${migrations.length} forward migrations on fresh application schema, ${assertions} pgTAP assertions, schema restoration rehearsal. Production data recovery is not verified.`,
  );
} finally {
  if (created) sql("postgres", `drop database ${database} with (force);`);
}
