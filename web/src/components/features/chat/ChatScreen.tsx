"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChatUnavailableError,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_CHAT_MESSAGES,
  sendChat,
  type ChatMessage,
} from "@/lib/api/chat";

export function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const canSend = !isPending && !isDisabled && draft.trim().length > 0;
  const canRetry = !isPending && !isDisabled && messages.at(-1)?.role === "user";

  useEffect(() => {
    const node = transcriptRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, isPending, error]);

  async function deliver(history: ChatMessage[]) {
    setIsPending(true);
    setError(null);

    try {
      const reply = await sendChat(history.slice(-MAX_CHAT_MESSAGES));
      setMessages((current) =>
        [...current, { role: "assistant" as const, content: reply }].slice(-MAX_CHAT_MESSAGES)
      );
    } catch (err) {
      if (err instanceof ChatUnavailableError) {
        setIsDisabled(true);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Failed to reach Gersz");
      }
    } finally {
      setIsPending(false);
    }
  }

  async function send() {
    const content = draft.trim();
    if (!content || isPending || isDisabled) return;

    const history = [...messages, { role: "user" as const, content }].slice(-MAX_CHAT_MESSAGES);
    setMessages(history);
    setDraft("");
    await deliver(history);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void send();
  }

  return (
    <div className="chat">
      <div className="chat__intro">
        <h1 className="chat__title">Chat</h1>
        <p className="chat__lede">
          Ask Gersz about the figures in your monthly summaries and get a plain answer.
        </p>
      </div>

      <section className="chat__panel" aria-label="Conversation with Gersz">
        <div
          ref={transcriptRef}
          className="chat__transcript"
          role="log"
          aria-live="polite"
          aria-label="Conversation transcript"
          tabIndex={0}
        >
          {messages.length === 0 ? (
            <div className="chat__empty">
              <p className="chat__empty-title">No messages yet.</p>
              <p className="chat__empty-text">
                Ask which category grew the most last month, how much went to bills in March, or
                how this month compares with the last one.
              </p>
              <p className="chat__empty-note">
                Only your monthly summary figures are sent. Never statement files, account numbers
                or card digits.
              </p>
            </div>
          ) : (
            <ol className="chat__messages">
              {messages.map((message, index) => (
                <li
                  key={index}
                  className={`chat__message chat__message--${message.role}`}
                  data-role={message.role}
                >
                  <span className="chat__speaker">
                    {message.role === "user" ? "You" : "Gersz"}
                  </span>
                  <p className="chat__text">{message.content}</p>
                </li>
              ))}
              {isPending && (
                <li className="chat__message chat__message--pending">
                  <span className="chat__speaker">Gersz</span>
                  <p className="chat__text chat__pending" role="status">
                    Reading your monthly summary...
                  </p>
                </li>
              )}
            </ol>
          )}
        </div>

        {error && (
          <div className="banner banner--error chat__banner" role="alert">
            <svg
              className="banner__icon"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 101.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="banner__content">
              <p className="banner__title">
                {isDisabled ? "Assistant not configured" : "Gersz did not answer"}
              </p>
              <p className="banner__text">{error}</p>
              {canRetry && (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm chat__retry"
                  onClick={() => void deliver(messages)}
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        <form
          className="chat__composer"
          aria-busy={isPending}
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <div className="field chat__field">
            <label className="field__label" htmlFor="chat-draft">
              Message
            </label>
            <textarea
              id="chat-draft"
              className="field__textarea chat__input"
              rows={3}
              maxLength={MAX_CHAT_MESSAGE_LENGTH}
              value={draft}
              disabled={isPending || isDisabled}
              placeholder="Ask about a month, a category or a bill."
              aria-describedby="chat-hint"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <p id="chat-hint" className="field__hint">
              Enter sends. Shift and Enter adds a new line.
            </p>
          </div>
          <div className="chat__actions">
            <button
              type="submit"
              className="btn btn--primary chat__send"
              disabled={!canSend}
              data-pending={isPending || undefined}
            >
              {isPending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
