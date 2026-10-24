import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
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

      <section className="panel" aria-labelledby="signin-heading">
        <h2 id="signin-heading" className="panel__title">
          Owner sign-in
        </h2>
        <p className="panel__text">
          Sign-in goes through the homelab Keycloak realm. The client is not created yet, so this
          control stays disabled.
        </p>
        <div className="panel__actions">
          <button type="button" className="button button--primary" disabled>
            Continue to Keycloak
          </button>
        </div>
        <p className="note">
          The API already rejects a request with no token, an expired token, a wrong audience, or any
          subject but yours.
        </p>
      </section>
    </>
  );
}
