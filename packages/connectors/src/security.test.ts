import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import { encryptCredential, decryptCredential } from "./crypto.js";
import { shopSchema, verifyWebhook, verifyCallback } from "./shopify.js";
test("encrypted credentials are authenticated and bound to brand/source context", () => {
  const key = randomBytes(32);
  const encrypted = encryptCredential(
    { access_token: "isolated-test-token" },
    key,
    "brand:source",
  );
  assert.deepEqual(decryptCredential(encrypted, key, "brand:source"), {
    access_token: "isolated-test-token",
  });
  assert.throws(() => decryptCredential(encrypted, key, "other:source"));
  assert.throws(() =>
    decryptCredential(encrypted, randomBytes(32), "brand:source"),
  );
  assert.notEqual(
    encryptCredential(
      { access_token: "isolated-test-token" },
      key,
      "brand:source",
    ),
    encrypted,
  );
});
test("provider host validation rejects URL/SSRF tricks", () => {
  for (const host of [
    "localhost",
    "127.0.0.1",
    "shop.myshopify.com.evil.invalid",
    "shop.myshopify.com/path",
    "user@shop.myshopify.com",
    "shop.myshopify.com:443",
  ])
    assert.equal(shopSchema.safeParse(host).success, false);
  assert.equal(
    shopSchema.parse("test-shop.myshopify.com"),
    "test-shop.myshopify.com",
  );
});
test("webhooks require exact raw bytes and callbacks reject ambiguous duplicate keys", () => {
  const secret = "isolated-test-secret";
  const raw = Buffer.from('{"id":1}');
  const signature = createHmac("sha256", secret).update(raw).digest("base64");
  assert.equal(verifyWebhook(raw, signature, secret), true);
  assert.equal(
    verifyWebhook(Buffer.from('{"id":2}'), signature, secret),
    false,
  );
  const params = new URLSearchParams({
    code: "code",
    shop: "test.myshopify.com",
    state: "state",
    timestamp: "1",
  });
  const hmac = createHmac("sha256", secret)
    .update([...params].map(([k, v]) => `${k}=${v}`).join("&"))
    .digest("hex");
  params.set("hmac", hmac);
  assert.equal(verifyCallback(params, secret), true);
  params.append("state", "other");
  assert.equal(verifyCallback(params, secret), false);
});
