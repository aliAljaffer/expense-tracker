import { NextRequest, NextResponse } from "next/server";
import { proxyToApi } from "@/lib/bff/proxy";

const ALLOWED_ROUTES: Record<string, readonly string[]> = {
  accounts: ["GET"],
  "overview/monthly": ["GET"],
  transactions: ["GET"],
  "suggestions/card-coverage": ["GET"],
  "suggestions/recurring": ["GET"],
  "suggestions/bnpl": ["GET"],
  settings: ["GET", "PUT"],
  "settings/reminder/test": ["POST"],
};

async function handler(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  const pathSegments = params.path || [];
  const key = pathSegments.join("/");

  const path = "/api/" + key;

  if (key === "imports") {
    return NextResponse.json({ error: "Use /api/imports directly" }, { status: 400 });
  }

  const methods = ALLOWED_ROUTES[key];

  if (!methods) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!methods.includes(request.method)) {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  const response = await proxyToApi(
    {
      method: request.method,
      headers: request.headers,
      body: request.body,
    },
    path
  );

  return response;
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
