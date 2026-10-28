import { NextRequest } from "next/server";
import { refreshIfExpiring } from "@/lib/auth/session";
import { getAuthConfig } from "@/lib/auth/config";
import { refreshToken } from "@/lib/auth/oidc";

export async function POST(request: NextRequest): Promise<Response> {
  const authConfig = getAuthConfig();

  const session = await refreshIfExpiring(authConfig.sessionSecret, async (token) => {
    const data = await refreshToken({
      issuer: authConfig.oidcIssuer,
      clientId: authConfig.oidcClientId,
      clientSecret: authConfig.oidcClientSecret,
      refreshToken: token,
    });

    return {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      refreshToken: data.refresh_token,
    };
  });

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const origin = request.headers.get("origin");
  if (origin !== authConfig.appOrigin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const contentType = request.headers.get("content-type");

  const forwardHeaders = new Headers();
  forwardHeaders.set("authorization", `Bearer ${session.accessToken}`);

  if (contentType) {
    forwardHeaders.set("content-type", contentType);
  }

  const url = new URL("/api/imports", authConfig.apiBaseUrl);

  const upstreamResponse = await fetch(url, {
    method: "POST",
    headers: forwardHeaders,
    body: request.body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete("set-cookie");
  responseHeaders.set("cache-control", "no-store");

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
