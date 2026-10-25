import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

// Local integration test only. Never accept a remote URL or reuse a customer's
// session; generated principals are deleted, and no business data is seeded.
const status = JSON.parse(
  execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    cwd: new URL("../../../", import.meta.url),
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
const url = new URL(status.API_URL);
assert.ok(
  ["127.0.0.1", "localhost"].includes(url.hostname),
  "Auth tests require local Supabase",
);
const admin = createClient(url.href, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const email = `auth-${crypto.randomUUID()}@example.invalid`;
let userId;
try {
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  assert.equal(linkError, null);
  assert.ok(link.user?.id);
  userId = link.user.id;
  assert.ok(link.properties?.email_otp);
  const jar = new Map();
  const client = createServerClient(url.href, status.ANON_KEY, {
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
  const { error: verifyError } = await client.auth.verifyOtp({
    email,
    token: link.properties.email_otp,
    type: "email",
  });
  assert.equal(verifyError, null, "A real issued OTP verifies");
  const { data: current, error: currentError } = await client.auth.getUser();
  assert.equal(currentError, null);
  assert.equal(current.user?.id, userId, "Identity is verified by Auth");
  assert.ok(jar.size > 0, "SSR cookies are written");
  const { data: brands, error: brandsError } = await client
    .from("brand_workspaces")
    .select("id");
  assert.equal(brandsError, null);
  assert.deepEqual(
    brands,
    [],
    "A new authenticated user sees no seeded workspaces",
  );
  const replay = createClient(url.href, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  assert.ok(
    (
      await replay.auth.verifyOtp({
        email,
        token: link.properties.email_otp,
        type: "email",
      })
    ).error,
    "An OTP cannot be replayed",
  );
  assert.equal((await client.auth.signOut({ scope: "local" })).error, null);
  assert.equal(jar.size, 0, "Sign-out removes session cookies");
  assert.equal((await client.auth.getUser()).data.user, null);
  console.log(
    "PASS: real local OTP, verified identity, SSR cookies, empty account, replay rejection, sign-out.",
  );
} finally {
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    assert.equal(error, null, "Test principal cleanup succeeds");
  }
}
