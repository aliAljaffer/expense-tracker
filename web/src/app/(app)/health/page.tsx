import type { Metadata } from "next";
import { ReadinessChecks } from "@/components/features/readiness-checks";
import { readSession } from "@/lib/auth/session";
import { getAuthConfig } from "@/lib/auth/config";
import { SignOutButton } from "@/components/ui/sign-out-button";

export const metadata: Metadata = { title: "Health" };
export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const config = getAuthConfig();
  const session = await readSession(config.sessionSecret);
  const subject = session?.subject || "unknown";

  return (
    <>
      <div className="page__intro">
        <p className="eyebrow">Status</p>
        <h1 className="display">Import readiness.</h1>
        <p className="lede">
          Three checks must pass before a statement can be committed. Two are still open.
        </p>
      </div>

      <div className="panel">
        <p className="panel__text">Signed in as: {subject}</p>
        <div className="panel__actions">
          <SignOutButton />
        </div>
      </div>

      <ReadinessChecks />

      <p className="note">
        Statements go only to your own grooszy server, which deletes the file after review. No
        account number is written to a log or sent to a third party.
      </p>
    </>
  );
}
