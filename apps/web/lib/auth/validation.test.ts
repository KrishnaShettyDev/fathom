import assert from "node:assert/strict";
import { test } from "node:test";
import { emailSchema, otpSchema, workspaceSchema } from "./validation.js";
const valid = {
  organizationName: "Organization",
  brandName: "Brand",
  website: "https://example.invalid",
  timezone: "Asia/Kolkata",
  requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ownerAttested: "on",
};
test("workspace boundary rejects invalid ownership, identity, URLs and timezones", () => {
  assert.ok(workspaceSchema.safeParse(valid).success);
  for (const patch of [
    { brandName: "  " },
    { organizationName: "a".repeat(121) },
    { timezone: "Invalid/Zone" },
    { website: "javascript:alert(1)" },
    { website: "ftp://example.invalid" },
    { ownerAttested: "off" },
    { requestId: "not-a-uuid" },
  ]) {
    assert.equal(
      workspaceSchema.safeParse({ ...valid, ...patch }).success,
      false,
    );
  }
});
test("email and OTP are validated independently of provider response", () => {
  assert.equal(emailSchema.parse("Person@Example.com"), "person@example.com");
  assert.ok(otpSchema.safeParse("123456").success);
  for (const code of ["12345", "abcdef", "1234567", " 123456"])
    assert.equal(otpSchema.safeParse(code).success, false);
  assert.equal(emailSchema.safeParse("not-an-email").success, false);
});
