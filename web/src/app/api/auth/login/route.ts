import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { generateVerifier, generateS256Challenge, generateState, generateNonce } from "@/lib/auth/pkce";
import { buildAuthorizationUrl } from "@/lib/auth/oidc";
import { getAuthConfig } from "@/lib/auth/config";
import { createCipheriv, randomBytes } from "node:crypto";
import { hkdfSync } from "node:crypto";

const PKCE_ALGORITHM = "aes-256-gcm";
const PKCE_COOKIE_NAME = "et_pkce";
const PKCE_COOKIE_MAX_AGE = 10 * 60;

function derivePkceKey(secret: string): Buffer {
  const derived = hkdfSync("sha256", secret, "", "", 32);
  return Buffer.from(derived);
}

function encryptPkceData(data: { verifier: string; nonce: string }, key: Buffer): string {
  const plaintext = JSON.stringify(data);
  const iv = randomBytes(12);
  const cipher = createCipheriv(PKCE_ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();
  const combined = iv.toString("hex") + authTag.toString("hex") + encrypted;

  return combined;
}

export async function GET() {
  const config = getAuthConfig();

  const verifier = generateVerifier();
  const challenge = generateS256Challenge(verifier);
  const state = generateState();
  const nonce = generateNonce();

  const key = derivePkceKey(config.sessionSecret);
  const encrypted = encryptPkceData({ verifier, nonce }, key);

  const cookieStore = await cookies();
  cookieStore.set(PKCE_COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: PKCE_COOKIE_MAX_AGE,
  });

  const callbackUrl = new URL("/api/auth/callback", config.appOrigin);
  const authUrl = buildAuthorizationUrl({
    issuer: config.oidcIssuer,
    clientId: config.oidcClientId,
    redirectUri: callbackUrl.toString(),
    codeChallenge: challenge,
    state,
    nonce,
  });

  return NextResponse.redirect(authUrl);
}
