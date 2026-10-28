import { NextRequest, NextResponse } from "next/server";
import { decryptJson } from "@/lib/auth/crypto";

const COOKIE_NAME_PREFIX = "grooszy_session";

interface SessionPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  subject: string;
}

function reconstructFromCookies(cookieString: string | undefined): string {
  if (!cookieString) return "";

  const cookies: Record<string, string> = {};
  const pairs = cookieString.split(/;\s*/);

  for (const pair of pairs) {
    const [name, value] = pair.split("=", 2);
    if (name) {
      cookies[decodeURIComponent(name.trim())] = decodeURIComponent(value || "");
    }
  }

  let encrypted = "";
  let index = 0;

  while (true) {
    const chunkName = `${COOKIE_NAME_PREFIX}.${index}`;
    const chunk = cookies[chunkName];

    if (!chunk) break;

    encrypted += chunk;
    index++;
  }

  return encrypted;
}

function getSession(request: NextRequest): SessionPayload | null {
  try {
    const secret = process.env.SESSION_SECRET ?? "";
    if (!secret) {
      return null;
    }

    const cookieHeader = request.headers.get("cookie");
    const encrypted = reconstructFromCookies(cookieHeader ?? undefined);

    if (!encrypted) {
      return null;
    }

    const session = decryptJson<SessionPayload>(encrypted, secret);

    // An expired access token is not fatal: the BFF refreshes it using the
    // stored refresh token. Reject only sessions that cannot be refreshed.
    if (!session.refreshToken) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const publicPaths = [
    "/signin",
    "/brand",
    "/api/auth/login",
    "/api/auth/callback",
    "/api/auth/logout",
  ];

  const isPublicPath = publicPaths.some((path) => pathname === path || pathname.startsWith(path));

  if (isPublicPath || pathname.startsWith("/_next") || pathname.startsWith("/static")) {
    return NextResponse.next();
  }

  const session = getSession(request);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.redirect(new URL("/signin", request.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
