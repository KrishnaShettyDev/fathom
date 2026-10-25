import { execFileSync } from "node:child_process";
import { writeFileSync, renameSync } from "node:fs";
import { format } from "prettier";
const types = execFileSync(
  "npx",
  ["supabase", "gen", "types", "typescript", "--local", "--schema", "public"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);
const target = "apps/web/lib/supabase/database.types.ts";
writeFileSync(`${target}.tmp`, await format(types, { parser: "typescript" }));
renameSync(`${target}.tmp`, target);
console.log("Generated application types from the local migrated schema.");
