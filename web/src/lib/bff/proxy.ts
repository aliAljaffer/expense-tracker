import "server-only";

import { refreshIfExpiring } from "@/lib/auth/session";
import { getAuthConfig } from "@/lib/auth/config";
import { refreshToken } from "@/lib/auth/oidc";

export interface ProxyRequest {
  headers: Headers;
  method: string;
  body?: ReadableStream<Uint8Array> | null;
  search?: string;
}

export async function proxyToApi(
  request: ProxyRequest,
  path: string
): Promise<Response> {
  const authConfig = getAuthConfig();

  const session = await refreshIfExpiring(authConfig.sessionSecret, async (refreshTokenValue) => {
    const data = await refreshToken({
      issuer: authConfig.oidcIssuer,
      clientId: authConfig.oidcClientId,
      clientSecret: authConfig.oidcClientSecret,
      refreshToken: refreshTokenValue,
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

  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin !== authConfig.appOrigin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
  }

  const forwardHeaders = new Headers();
  const allowedHeaders = ["content-type", "content-length", "accept"];

  for (const header of allowedHeaders) {
    const value = request.headers.get(header);
    if (value) {
      forwardHeaders.set(header, value);
    }
  }

  forwardHeaders.set("authorization", `Bearer ${session.accessToken}`);

  const url = new URL(path, authConfig.apiBaseUrl);

  if (request.search) {
    url.search = request.search;
  }

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers: forwardHeaders,
    body: request.body,
  };

  if (request.body) {
    init.duplex = "half";
  }

  const upstreamResponse = await fetch(url, init);

  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete("set-cookie");
  responseHeaders.set("cache-control", "no-store");

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
