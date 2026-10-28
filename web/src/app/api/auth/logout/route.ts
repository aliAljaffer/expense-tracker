import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";
import { getAuthConfig } from "@/lib/auth/config";
import { fetchDiscovery } from "@/lib/auth/oidc";

export async function POST(request: NextRequest) {
  const config = getAuthConfig();
  const origin = request.headers.get("origin");

  const requestOrigin = new URL(config.appOrigin).origin;
  // Referrer-Policy: no-referrer makes Chrome send Origin: null on same-origin form posts.
  const sameOriginFormPost = request.headers.get("sec-fetch-site") === "same-origin";
  if (origin && origin !== requestOrigin && !sameOriginFormPost) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  await clearSession();

  let endSessionUrl: URL | null = null;
  try {
    const discovery = await fetchDiscovery(config.oidcIssuer);
    if (discovery.end_session_endpoint) {
      const postLogoutRedirectUri = new URL("/", config.appOrigin).toString();
      endSessionUrl = new URL(discovery.end_session_endpoint);
      endSessionUrl.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri);
    }
  } catch {
    endSessionUrl = null;
  }

  if (endSessionUrl) {
    return NextResponse.redirect(endSessionUrl, 303);
  }

  return NextResponse.redirect(new URL("/", config.appOrigin), 303);
}
