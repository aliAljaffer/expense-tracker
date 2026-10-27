export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const MAX_CHAT_MESSAGES = 8;
export const MAX_CHAT_MESSAGE_LENGTH = 2000;

export class ChatUnavailableError extends Error {
  constructor() {
    super(
      "Gersz is not configured on this server yet. Add the explainer provider, model and key on the server, then reload."
    );
    this.name = "ChatUnavailableError";
  }
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error) {
      return data.error;
    }
  } catch {
    // Fall through to the caller's message when the body is not JSON.
  }

  return fallback;
}

export async function sendChat(messages: ChatMessage[]): Promise<string> {
  const response = await fetch("/api/bff/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (response.status === 503) {
    throw new ChatUnavailableError();
  }

  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to reach Gersz"));
  }

  const data = (await response.json()) as { reply?: unknown };

  if (typeof data.reply !== "string" || !data.reply) {
    throw new Error("Gersz returned an empty reply");
  }

  return data.reply;
}
