import "server-only";

import { refreshIfExpiring } from "@/lib/auth/session";
import { getAuthConfig } from "@/lib/auth/config";
import { fetchDiscovery } from "@/lib/auth/oidc";

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

  let discovery;
  try {
    discovery = await fetchDiscovery(authConfig.oidcIssuer);
  } catch {
    return new Response(JSON.stringify({ error: "Failed to fetch OIDC configuration" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const session = await refreshIfExpiring(authConfig.sessionSecret, async (refreshToken) => {
    const response = await fetch(discovery.token_endpoint, {
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
