import { cookieSecure } from "./cookie-options";
import { decryptJson, encryptJson } from "./crypto";
import "server-only";

import { cookies } from "next/headers";

export interface SessionPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  subject: string;
}

const COOKIE_NAME_PREFIX = "grooszy_session";
const COOKIE_MAX_SIZE = 3800;
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: cookieSecure(process.env.APP_ORIGIN),
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

export function getCookieChunks(encrypted: string): Array<{ name: string; value: string }> {
  const chunks: Array<{ name: string; value: string }> = [];
  let index = 0;

  for (let i = 0; index < encrypted.length; i++) {
    const chunk = encrypted.slice(index, index + COOKIE_MAX_SIZE);
    chunks.push({
      name: `${COOKIE_NAME_PREFIX}.${i}`,
      value: chunk,
    });
    index += COOKIE_MAX_SIZE;
  }

  return chunks;
}

function reconstructFromChunks(cookieStore: Record<string, string | undefined>): string {
  let encrypted = "";
  let index = 0;

  while (true) {
    const chunkName = `${COOKIE_NAME_PREFIX}.${index}`;
    const chunk = cookieStore[chunkName];

    if (!chunk) break;

    encrypted += chunk;
    index++;
  }

  return encrypted;
}

export async function readSession(secret: string): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const cookieValues: Record<string, string | undefined> = {};

    let index = 0;
    while (true) {
      const chunkName = `${COOKIE_NAME_PREFIX}.${index}`;
      const chunk = cookieStore.get(chunkName);

      if (!chunk) break;

      cookieValues[chunkName] = chunk.value;
      index++;
    }

    if (index === 0) {
      return null;
    }

    const encrypted = reconstructFromChunks(cookieValues);
    return decryptJson<SessionPayload>(encrypted, secret);
  } catch {
    return null;
  }
}

export async function writeSession(
  payload: SessionPayload,
  secret: string
): Promise<void> {
  const encrypted = encryptJson(payload, secret);
  const chunks = getCookieChunks(encrypted);
  const cookieStore = await cookies();

  for (const chunk of chunks) {
    cookieStore.set(chunk.name, chunk.value, cookieOptions());
  }

  let index = chunks.length;
  while (cookieStore.get(`${COOKIE_NAME_PREFIX}.${index}`)) {
    cookieStore.delete(`${COOKIE_NAME_PREFIX}.${index}`);
    index++;
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();

  let index = 0;
  while (true) {
    const chunkName = `${COOKIE_NAME_PREFIX}.${index}`;
    const cookie = cookieStore.get(chunkName);

    if (!cookie) break;

    cookieStore.delete(chunkName);
    index++;
  }
}

export async function refreshIfExpiring(
  secret: string,
  refreshFn: (refreshToken: string) => Promise<{
    accessToken: string;
    expiresAt: number;
    refreshToken?: string;
  }>
): Promise<SessionPayload | null> {
  const session = await readSession(secret);

  if (!session) {
    return null;
  }

  const now = Date.now();
  const timeToExpiry = session.expiresAt - now;
  const sixtySeconds = 60 * 1000;

  if (timeToExpiry <= sixtySeconds) {
    try {
      const refreshed = await refreshFn(session.refreshToken);
      const updatedSession: SessionPayload = {
        ...session,
        accessToken: refreshed.accessToken,
        expiresAt: refreshed.expiresAt,
        refreshToken: refreshed.refreshToken ?? session.refreshToken,
      };

      await writeSession(updatedSession, secret);
      return updatedSession;
    } catch {
      return null;
    }
  }

  return session;
}
