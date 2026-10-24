import "server-only";

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export interface SessionPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  subject: string;
}

const ALGORITHM = "aes-256-gcm";
const COOKIE_NAME_PREFIX = "grooszy_session";
const COOKIE_MAX_SIZE = 3800;
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};

function deriveKey(secret: string): Buffer {
  const derived = hkdfSync("sha256", secret, "", "", 32);
  return Buffer.from(derived);
}

function encryptPayload(payload: SessionPayload, key: Buffer): string {
  const plaintext = JSON.stringify(payload);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();
  const combined = iv.toString("hex") + authTag.toString("hex") + encrypted;

  return combined;
}

function decryptPayload(encrypted: string, key: Buffer): SessionPayload {
  const iv = Buffer.from(encrypted.slice(0, 24), "hex");
  const authTag = Buffer.from(encrypted.slice(24, 56), "hex");
  const ciphertext = encrypted.slice(56);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, "hex", "utf8");
  plaintext += decipher.final("utf8");

  return JSON.parse(plaintext);
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
    const key = deriveKey(secret);
    const payload = decryptPayload(encrypted, key);

    return payload;
  } catch {
    return null;
  }
}

export async function writeSession(
  payload: SessionPayload,
  secret: string
): Promise<void> {
  const key = deriveKey(secret);
  const encrypted = encryptPayload(payload, key);
  const chunks = getCookieChunks(encrypted);
  const cookieStore = await cookies();

  for (const chunk of chunks) {
    cookieStore.set(chunk.name, chunk.value, COOKIE_OPTIONS);
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
      };

      await writeSession(updatedSession, secret);
      return updatedSession;
    } catch {
      return null;
    }
  }

  return session;
}
