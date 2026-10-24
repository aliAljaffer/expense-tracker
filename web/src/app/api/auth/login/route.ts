import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { generateVerifier, generateS256Challenge, generateState, generateNonce } from "@/lib/auth/pkce";
import { buildAuthorizationUrl, fetchDiscovery } from "@/lib/auth/oidc";
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

function encryptPkceData(data: { verifier: string; nonce: string; state: string }, key: Buffer): string {
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
  const encrypted = encryptPkceData({ verifier, nonce, state }, key);

  const cookieStore = await cookies();
  const isSecure = process.env.NODE_ENV === "production" || !process.env.INSECURE_COOKIES;
  cookieStore.set(PKCE_COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: PKCE_COOKIE_MAX_AGE,
  });

  const callbackUrl = new URL("/api/auth/callback", config.appOrigin);

  let authUrl;
  try {
    const discovery = await fetchDiscovery(config.oidcIssuer);
    authUrl = buildAuthorizationUrl({
      issuer: config.oidcIssuer,
      authorizationEndpoint: discovery.authorization_endpoint,
      clientId: config.oidcClientId,
      redirectUri: callbackUrl.toString(),
      codeChallenge: challenge,
      state,
      nonce,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch OIDC configuration" }, { status: 500 });
  }

  return NextResponse.redirect(authUrl);
}
