import { randomBytes, createHash } from "node:crypto";

function base64urlEscape(str: string): string {
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function generateVerifier(): string {
  const bytes = randomBytes(32);
  return base64urlEscape(bytes.toString("base64"));
}

export function generateS256Challenge(verifier: string): string {
  const hash = createHash("sha256").update(verifier).digest();
  return base64urlEscape(hash.toString("base64"));
}

export function generateState(): string {
  const bytes = randomBytes(32);
  return base64urlEscape(bytes.toString("base64"));
}

export function generateNonce(): string {
  const bytes = randomBytes(32);
  return base64urlEscape(bytes.toString("base64"));
}
