import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseIdToken, exchangeCode } from "@/lib/auth/oidc";
import { writeSession } from "@/lib/auth/session";
import { getAuthConfig } from "@/lib/auth/config";
import { createDecipheriv } from "node:crypto";
import { hkdfSync } from "node:crypto";

const PKCE_ALGORITHM = "aes-256-gcm";
const PKCE_COOKIE_NAME = "et_pkce";

function derivePkceKey(secret: string): Buffer {
  const derived = hkdfSync("sha256", secret, "", "", 32);
  return Buffer.from(derived);
}

function decryptPkceData(encrypted: string, key: Buffer): { verifier: string; nonce: string } {
  const iv = Buffer.from(encrypted.slice(0, 24), "hex");
  const authTag = Buffer.from(encrypted.slice(24, 56), "hex");
  const ciphertext = encrypted.slice(56);

  const decipher = createDecipheriv(PKCE_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, "hex", "utf8");
  plaintext += decipher.final("utf8");

  return JSON.parse(plaintext);
}

export async function GET(request: NextRequest) {
  const config = getAuthConfig();
  const searchParams = request.nextUrl.searchParams;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/signin?error=access_denied", config.appOrigin));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/signin?error=missing_params", config.appOrigin));
  }

  const cookieStore = await cookies();
  const pkceEncrypted = cookieStore.get(PKCE_COOKIE_NAME)?.value;

  if (!pkceEncrypted) {
    return NextResponse.redirect(new URL("/signin?error=invalid_session", config.appOrigin));
  }

  let pkceData: { verifier: string; nonce: string };
  try {
    const key = derivePkceKey(config.sessionSecret);
    pkceData = decryptPkceData(pkceEncrypted, key);
  } catch {
    return NextResponse.redirect(new URL("/signin?error=invalid_pkce", config.appOrigin));
  }

  const callbackUrl = new URL("/api/auth/callback", config.appOrigin);

  let tokenResponse;
  try {
    tokenResponse = await exchangeCode({
      issuer: config.oidcIssuer,
      clientId: config.oidcClientId,
      clientSecret: config.oidcClientSecret,
      redirectUri: callbackUrl.toString(),
      code,
      verifier: pkceData.verifier,
    });
  } catch {
    return NextResponse.redirect(new URL("/signin?error=token_exchange", config.appOrigin));
  }

  if (!tokenResponse.id_token) {
    return NextResponse.redirect(new URL("/signin?error=no_id_token", config.appOrigin));
  }

  let idTokenClaims;
  try {
    idTokenClaims = parseIdToken(tokenResponse.id_token, pkceData.nonce);
  } catch {
    return NextResponse.redirect(new URL("/signin?error=invalid_token", config.appOrigin));
  }

  try {
    await writeSession(
      {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: (idTokenClaims.exp * 1000),
        subject: idTokenClaims.sub,
      },
      config.sessionSecret
    );

    cookieStore.delete(PKCE_COOKIE_NAME);

    return NextResponse.redirect(new URL("/", config.appOrigin));
  } catch {
    return NextResponse.redirect(new URL("/signin?error=session_write", config.appOrigin));
  }
}
