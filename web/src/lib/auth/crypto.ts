import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function deriveKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "", "", 32));
}

// encryptJson returns iv + auth tag + ciphertext, all hex.
export function encryptJson(value: unknown, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv);
  let encrypted = cipher.update(JSON.stringify(value), "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + cipher.getAuthTag().toString("hex") + encrypted;
}

export function decryptJson<T>(encrypted: string, secret: string): T {
  const iv = Buffer.from(encrypted.slice(0, 24), "hex");
  const authTag = Buffer.from(encrypted.slice(24, 56), "hex");
  const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), iv);
  decipher.setAuthTag(authTag);
  let plaintext = decipher.update(encrypted.slice(56), "hex", "utf8");
  plaintext += decipher.final("utf8");
  return JSON.parse(plaintext) as T;
}
