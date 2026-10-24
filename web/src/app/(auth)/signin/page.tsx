import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

function getErrorMessage(code: string): string | null {
  switch (code) {
    case "invalid_state":
      return "Sign-in could not be verified. Try again.";
    case "access_denied":
      return "Sign-in failed. Try again.";
    default:
      return "Sign-in failed. Try again.";
  }
}

export default async function SignInPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const searchParams = await props.searchParams;
  const errorCode = searchParams?.error;
  const errorMessage = errorCode ? getErrorMessage(errorCode) : null;

  return (
    <>
      <div className="page__intro">
        <p className="eyebrow">Private</p>
        <h1 className="display">Read your statements properly.</h1>
        <p className="lede">
          Alinma and Al Rajhi exports, checked against their own headers. A statement that does not
          reconcile is refused, not imported.
        </p>
      </div>

      {errorMessage && (
        <div
          className="alert alert--error"
          role="alert"
        >
          <svg
            className="alert__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="alert__text">{errorMessage}</span>
        </div>
      )}

      <section className="panel" aria-labelledby="signin-heading">
        <h2 id="signin-heading" className="panel__title">
          Owner sign-in
        </h2>
        <p className="panel__text">
          Sign-in goes through the homelab Keycloak realm.
        </p>
        <div className="panel__actions">
          <Link href="/api/auth/login" className="button button--primary">
            Continue to Keycloak
          </Link>
        </div>
        <p className="note">
          The API already rejects a request with no token, an expired token, a wrong audience, or any
          subject but yours.
        </p>
      </section>
    </>
  );
}
