import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
export function equalSecret(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function nonce(): string {
  return randomBytes(32).toString("base64url");
}
const envelopeSchema = z.object({
  iv: z.string(),
  tag: z.string(),
  value: z.string(),
});
export function encryptCredential(
  value: unknown,
  key: Buffer,
  context: string,
): string {
  if (key.length !== 32) throw new Error("INVALID_ENCRYPTION_KEY");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return JSON.stringify({
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    value: encrypted.toString("base64"),
  });
}
export function decryptCredential(
  value: string,
  key: Buffer,
  context: string,
): unknown {
  const envelope = envelopeSchema.parse(JSON.parse(value));
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(envelope.value, "base64")),
      decipher.final(),
    ]).toString("utf8"),
  );
}
export function credentialKeys() {
  const version = z
    .string()
    .min(1)
    .max(80)
    .parse(process.env.CREDENTIAL_KEY_VERSION);
  const encoded = z
    .record(z.string(), z.string())
    .parse(JSON.parse(process.env.CREDENTIAL_KEYS_JSON ?? "{}"));
  const keys = new Map(
    Object.entries(encoded).map(([id, key]) => [
      id,
      Buffer.from(key, "base64"),
    ]),
  );
  if (!keys.has(version) || [...keys.values()].some((key) => key.length !== 32))
    throw new Error("INVALID_ENCRYPTION_KEYS");
  return { version, keys };
}
export function keyFor(version: string): Buffer {
  const key = credentialKeys().keys.get(version);
  if (!key) throw new Error("ENCRYPTION_KEY_UNAVAILABLE");
  return key;
}
