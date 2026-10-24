"use server";

import { redirect } from "next/navigation";
import { refreshIfExpiring } from "@/lib/auth/session";
import { getAuthConfig } from "@/lib/auth/config";
import { fetchDiscovery } from "@/lib/auth/oidc";

function validatePositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function validateRowIds(value: unknown): number[] {
  if (!Array.isArray(value)) throw new Error("selectedRowIds must be an array");
  if (value.length > 10000) throw new Error("Too many rows selected");
  if (!value.every((id) => typeof id === "number" && Number.isInteger(id) && id >= 0)) {
    throw new Error("Invalid row ID");
  }
  return value;
}

export async function commitImport(
  importId: unknown,
  selectedRowIds: unknown
): Promise<{ inserted: number } | { error: string }> {
  const authConfig = getAuthConfig();

  let discovery;
  try {
    discovery = await fetchDiscovery(authConfig.oidcIssuer);
  } catch {
    return { error: "Failed to fetch OIDC configuration" };
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
    redirect("/signin");
  }

  try {
    const validatedId = validatePositiveInt(importId) ? (importId as number) : null;
    if (!validatedId) throw new Error("Invalid import ID");

    const validatedRows = validateRowIds(selectedRowIds);

    const response = await fetch(`${authConfig.apiBaseUrl}/api/imports/${validatedId}/commit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ rows: validatedRows }),
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("cache-control", "no-store");

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      return { error: error.error || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { inserted: data.inserted ?? 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return { error: message };
  }
}

export async function cancelImport(importId: unknown): Promise<{ success: boolean } | { error: string }> {
  const authConfig = getAuthConfig();

  let discovery;
  try {
    discovery = await fetchDiscovery(authConfig.oidcIssuer);
  } catch {
    return { error: "Failed to fetch OIDC configuration" };
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
    redirect("/signin");
  }

  try {
    const validatedId = validatePositiveInt(importId) ? (importId as number) : null;
    if (!validatedId) throw new Error("Invalid import ID");

    const response = await fetch(`${authConfig.apiBaseUrl}/api/imports/${validatedId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("cache-control", "no-store");

    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return { error: message };
  }
}
