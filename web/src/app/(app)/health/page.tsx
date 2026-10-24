import type { Metadata } from "next";
import { ReadinessChecks } from "@/components/features/readiness-checks";
import { readSession } from "@/lib/auth/session";
import { getAuthConfig } from "@/lib/auth/config";
import { SignOutButton } from "@/components/ui/sign-out-button";
import { probeHealth, probeReadiness } from "@/lib/health/probe";

export const metadata: Metadata = { title: "Health" };
export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const config = getAuthConfig();
  const session = await readSession(config.sessionSecret);
  const subject = session?.subject || "unknown";

  const healthResult = await probeHealth();
  const readinessResult = await probeReadiness();

  const passCount = [true, healthResult.status === "ready", readinessResult.status === "ready"].filter(Boolean).length;
  const totalChecks = 3;

  const statusText =
    passCount === totalChecks
      ? "All checks pass."
      : `${totalChecks - passCount} of ${totalChecks} checks need attention.`;

  return (
    <>
      <div className="page__intro">
        <p className="eyebrow">Status</p>
        <h1 className="display">Import readiness.</h1>
        <p className="lede">
          {statusText}
        </p>
      </div>

      <div className="panel">
        <p className="panel__text">Signed in as: {subject}</p>
        <div className="panel__actions">
          <SignOutButton />
        </div>
      </div>

      <ReadinessChecks />
    </>
  );
}
