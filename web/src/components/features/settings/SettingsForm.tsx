"use client";

import { useEffect, useState } from "react";
import {
  getSettings,
  saveReminderEmail,
  saveSalaryPayers,
  sendTestReminder,
} from "@/lib/api/settings";

type Pending = "save" | "test" | null;

interface Feedback {
  kind: "success" | "error";
  message: string;
}

export function SettingsForm() {
  const [email, setEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [payers, setPayers] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [payersPending, setPayersPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [payersFeedback, setPayersFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getSettings();
        if (cancelled) return;
        setEmail(data.reminder_email);
        setSavedEmail(data.reminder_email);
        setPayers(data.salary_payers);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    setFeedback(null);

    if (!value) {
      setFeedback({ kind: "error", message: "Enter a reminder email address." });
      return;
    }

    setPending("save");

    try {
      const data = await saveReminderEmail(value);
      setEmail(data.reminder_email);
      setSavedEmail(data.reminder_email);
      setFeedback({ kind: "success", message: "Reminder email saved." });
    } catch (err) {
      setFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to save reminder email",
      });
    } finally {
      setPending(null);
    }
  }

  async function handlePayersSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPayersFeedback(null);
    setPayersPending(true);

    try {
      const data = await saveSalaryPayers(payers.trim());
      setPayers(data.salary_payers);
      setPayersFeedback({ kind: "success", message: "Salary payers saved." });
    } catch (err) {
      setPayersFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to save salary payers",
      });
    } finally {
      setPayersPending(false);
    }
  }

  async function handleTest() {
    setFeedback(null);
    setPending("test");

    try {
      await sendTestReminder();
      setFeedback({ kind: "success", message: `Test email sent to ${savedEmail}.` });
    } catch (err) {
      setFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to send test email",
      });
    } finally {
      setPending(null);
    }
  }

  if (isLoading) {
    return (
      <p className="note" role="status">
        Loading settings...
      </p>
    );
  }

  if (loadError) {
    return (
      <div className="banner banner--error" role="alert">
        <FeedbackIcon kind="error" />
        <div className="banner__content">
          <p className="banner__title">Could not load settings</p>
          <p className="banner__text">{loadError}</p>
        </div>
      </div>
    );
  }

  const isPending = pending !== null;

  return (
    <>
      <form
        className="card settings-form stack stack--normal"
        onSubmit={handleSubmit}
        noValidate
        aria-busy={isPending}
      >
      <div className="field">
        <label htmlFor="reminder-email" className="field__label">
          Reminder email
        </label>
        <input
          id="reminder-email"
          type="email"
          autoComplete="email"
          className="field__input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isPending}
          aria-invalid={feedback?.kind === "error" ? true : undefined}
          aria-describedby={
            feedback?.kind === "error"
              ? "reminder-email-hint settings-feedback"
              : "reminder-email-hint"
          }
        />
        <p id="reminder-email-hint" className="field__hint">
          Used only for the monthly reminder.
        </p>
      </div>

      <div className="cluster cluster--snug settings-form__actions">
        <button type="submit" className="btn btn--primary" disabled={isPending}>
          {pending === "save" ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={handleTest}
          disabled={!savedEmail || isPending}
        >
          {pending === "test" ? "Sending..." : "Send test email"}
        </button>
      </div>

      {feedback && (
        <div
          id="settings-feedback"
          className={`banner banner--${feedback.kind}`}
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          <FeedbackIcon kind={feedback.kind} />
          <div className="banner__content">
            <p className="banner__text">{feedback.message}</p>
          </div>
        </div>
      )}
      </form>

      <form
        className="card settings-form stack stack--normal"
        onSubmit={handlePayersSubmit}
        noValidate
        aria-busy={payersPending}
      >
        <div className="field">
          <label htmlFor="salary-payers" className="field__label">
            Salary payers
          </label>
          <input
            id="salary-payers"
            type="text"
            className="field__input"
            value={payers}
            onChange={(event) => setPayers(event.target.value)}
            disabled={payersPending}
            aria-invalid={payersFeedback?.kind === "error" ? true : undefined}
            aria-describedby={
              payersFeedback?.kind === "error"
                ? "salary-payers-hint salary-payers-feedback"
                : "salary-payers-hint"
            }
          />
          <p id="salary-payers-hint" className="field__hint">
            Employer names, separated by commas. A credit transfer from a name
            here counts as salary.
          </p>
        </div>

        <div className="cluster cluster--snug settings-form__actions">
          <button type="submit" className="btn btn--primary" disabled={payersPending}>
            {payersPending ? "Saving..." : "Save payers"}
          </button>
        </div>

        {payersFeedback && (
          <div
            id="salary-payers-feedback"
            className={`banner banner--${payersFeedback.kind}`}
            role={payersFeedback.kind === "error" ? "alert" : "status"}
          >
            <FeedbackIcon kind={payersFeedback.kind} />
            <div className="banner__content">
              <p className="banner__text">{payersFeedback.message}</p>
            </div>
          </div>
        )}
      </form>
    </>
  );
}

function FeedbackIcon({ kind }: { kind: "success" | "error" }) {
  return (
    <svg className="banner__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      {kind === "success" ? (
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      ) : (
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      )}
    </svg>
  );
}
