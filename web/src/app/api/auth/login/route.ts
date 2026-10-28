import { cookieSecure } from "@/lib/auth/cookie-options";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { generateVerifier, generateS256Challenge, generateState, generateNonce } from "@/lib/auth/pkce";
import { buildAuthorizationUrl, fetchDiscovery } from "@/lib/auth/oidc";
import { getAuthConfig } from "@/lib/auth/config";
import { encryptJson } from "@/lib/auth/crypto";

const PKCE_COOKIE_NAME = "grooszy_pkce";
const PKCE_COOKIE_MAX_AGE = 10 * 60;

export async function GET() {
  const config = getAuthConfig();

  const verifier = generateVerifier();
  const challenge = generateS256Challenge(verifier);
  const state = generateState();
  const nonce = generateNonce();

  const encrypted = encryptJson({ verifier, nonce, state }, config.sessionSecret);

  const cookieStore = await cookies();
  cookieStore.set(PKCE_COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: cookieSecure(config.appOrigin),
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
