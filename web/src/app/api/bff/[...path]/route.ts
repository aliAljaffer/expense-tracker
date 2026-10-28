import { NextRequest, NextResponse } from "next/server";
import { proxyToApi } from "@/lib/bff/proxy";

const ALLOWED_ROUTES: Record<string, readonly string[]> = {
  accounts: ["GET"],
  categories: ["GET"],
  "overview/monthly": ["GET"],
  transactions: ["GET"],
  "suggestions/card-coverage": ["GET"],
  "suggestions/recurring": ["GET"],
  "suggestions/bnpl": ["GET"],
  "suggestions/salary-trend": ["GET"],
  "suggestions/transfer-matches": ["GET"],
  "suggestions/card-coverage/decision": ["POST", "DELETE"],
  "suggestions/recurring/decision": ["POST", "DELETE"],
  "suggestions/bnpl/decision": ["POST", "DELETE"],
  "suggestions/salary-trend/decision": ["POST", "DELETE"],
  "suggestions/transfer-matches/decision": ["POST", "DELETE"],
  chat: ["POST"],
  settings: ["GET", "PUT"],
  "settings/reminder/test": ["POST"],
};

// Row-level edits keep the id in the path, so they cannot be listed above.
const ID_ROUTES: readonly (readonly [RegExp, readonly string[]])[] = [
  [/^transactions\/\d+$/, ["PATCH"]],
  [/^merchants\/\d+$/, ["PUT"]],
];

function allowedMethods(key: string): readonly string[] | undefined {
  for (const [pattern, methods] of ID_ROUTES) {
    if (pattern.test(key)) return methods;
  }
  return ALLOWED_ROUTES[key];
}

async function handler(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  const pathSegments = params.path || [];
  const key = pathSegments.join("/");

  const path = "/api/" + key;

  if (key === "imports") {
    return NextResponse.json({ error: "Use /api/imports directly" }, { status: 400 });
  }

  const methods = allowedMethods(key);

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
      search: request.nextUrl.search,
    },
    path
  );

  return response;
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
