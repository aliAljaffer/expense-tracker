import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseIdToken, exchangeCode, fetchDiscovery } from "@/lib/auth/oidc";
import { writeSession } from "@/lib/auth/session";
import { getAuthConfig } from "@/lib/auth/config";
import { decryptJson } from "@/lib/auth/crypto";
import { timingSafeEqual } from "node:crypto";

const PKCE_COOKIE_NAME = "grooszy_pkce";

export async function GET(request: NextRequest) {
  const config = getAuthConfig();
  const searchParams = request.nextUrl.searchParams;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = await cookies();

  const hadPkceCookie = Boolean(cookieStore.get(PKCE_COOKIE_NAME)?.value);
  const fail = (reason: string) => {
    console.warn("auth callback rejected", { reason, hadPkceCookie });
    return NextResponse.redirect(new URL(`/signin?error=${reason}`, config.appOrigin));
  };

  if (error) {
    cookieStore.delete(PKCE_COOKIE_NAME);
    return fail("access_denied");
  }

  if (!code || !state) {
    cookieStore.delete(PKCE_COOKIE_NAME);
    return fail("missing_params");
  }

  const pkceEncrypted = cookieStore.get(PKCE_COOKIE_NAME)?.value;

  if (!pkceEncrypted) {
    cookieStore.delete(PKCE_COOKIE_NAME);
    return fail("invalid_state");
  }

  let pkceData: { verifier: string; nonce: string; state: string };
  try {
    pkceData = decryptJson(pkceEncrypted, config.sessionSecret);
  } catch {
    cookieStore.delete(PKCE_COOKIE_NAME);
    return fail("invalid_pkce");
  }

  if (!state || !pkceData.state) {
    cookieStore.delete(PKCE_COOKIE_NAME);
    return fail("invalid_state");
  }

  try {
    const stateBuffer = Buffer.from(state, "utf8");
    const storedStateBuffer = Buffer.from(pkceData.state, "utf8");
    if (stateBuffer.length !== storedStateBuffer.length || !timingSafeEqual(stateBuffer, storedStateBuffer)) {
      cookieStore.delete(PKCE_COOKIE_NAME);
      return fail("invalid_state");
    }
  } catch {
    cookieStore.delete(PKCE_COOKIE_NAME);
    return fail("invalid_state");
  }

  const callbackUrl = new URL("/api/auth/callback", config.appOrigin);

  let tokenResponse;
  try {
    const discovery = await fetchDiscovery(config.oidcIssuer);
    tokenResponse = await exchangeCode({
      tokenEndpoint: discovery.token_endpoint,
      clientId: config.oidcClientId,
      clientSecret: config.oidcClientSecret,
      redirectUri: callbackUrl.toString(),
      code,
      verifier: pkceData.verifier,
    });
  } catch {
    cookieStore.delete(PKCE_COOKIE_NAME);
    return fail("token_exchange");
  }

  if (!tokenResponse.id_token) {
    cookieStore.delete(PKCE_COOKIE_NAME);
    return fail("no_id_token");
  }

  let idTokenClaims;
  try {
    idTokenClaims = parseIdToken(
      tokenResponse.id_token,
      pkceData.nonce,
      config.oidcIssuer,
      config.oidcClientId
    );
  } catch {
    cookieStore.delete(PKCE_COOKIE_NAME);
    return fail("invalid_token");
  }

  try {
    await writeSession(
      {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: Date.now() + tokenResponse.expires_in * 1000,
        subject: idTokenClaims.sub,
      },
      config.sessionSecret
    );

    cookieStore.delete(PKCE_COOKIE_NAME);

    return NextResponse.redirect(new URL("/", config.appOrigin));
  } catch {
    cookieStore.delete(PKCE_COOKIE_NAME);
    return fail("session_write");
  }
}
