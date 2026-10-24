import { NextRequest, NextResponse } from "next/server";
import { proxyToApi } from "@/lib/bff/proxy";

async function handler(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  const pathSegments = params.path || [];

  const path = "/api/" + pathSegments.join("/");

  if (pathSegments.join("/") === "imports" || pathSegments.join("/") === "api/imports") {
    return NextResponse.json({ error: "Use /api/imports directly" }, { status: 400 });
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
