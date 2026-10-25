import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const status = JSON.parse(
  execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(status.API_URL).hostname),
);
assert.equal(typeof status.ANON_KEY, "string");
// Refuse to overwrite the user's project configuration. No service-role key is saved.
writeFileSync(
  "apps/web/.env.local",
  `SUPABASE_URL=${status.API_URL}\nSUPABASE_PUBLISHABLE_KEY=${status.ANON_KEY}\n`,
  { flag: "wx", mode: 0o600 },
);
console.log(
  "Configured the web app for the isolated local Supabase instance. No business data was seeded.",
);
