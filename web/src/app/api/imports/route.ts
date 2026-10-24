import { NextRequest } from "next/server";
import { refreshIfExpiring } from "@/lib/auth/session";
import { getAuthConfig } from "@/lib/auth/config";

export async function POST(request: NextRequest): Promise<Response> {
  const authConfig = getAuthConfig();

  const session = await refreshIfExpiring(authConfig.sessionSecret, async (refreshToken) => {
    const response = await fetch(`${authConfig.oidcIssuer}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: authConfig.oidcClientId,
        client_secret: authConfig.oidcClientSecret || "",
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    const data = await response.json() as {
      access_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
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
