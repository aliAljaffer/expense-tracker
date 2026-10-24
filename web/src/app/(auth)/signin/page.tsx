import type { Metadata } from "next";
import Link from "next/link";

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
