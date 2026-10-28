"use server";

import { redirect } from "next/navigation";
import { refreshIfExpiring } from "@/lib/auth/session";
import { getAuthConfig } from "@/lib/auth/config";
import { refreshToken } from "@/lib/auth/oidc";

async function refreshSession() {
  const authConfig = getAuthConfig();
  return refreshIfExpiring(authConfig.sessionSecret, async (token) => {
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
}

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
  const session = await refreshSession();

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
  const session = await refreshSession();

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

    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return { error: message };
  }
}
