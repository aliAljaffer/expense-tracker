import type { Metadata } from "next";
import { ReadinessChecks } from "@/components/features/readiness-checks";

export const metadata: Metadata = { title: "Health" };

export default function HealthPage() {
  return (
    <>
      <div className="page__intro">
        <p className="eyebrow">Status</p>
        <h1 className="display">Import readiness.</h1>
        <p className="lede">
          Three checks must pass before a statement can be committed. Two are still open.
        </p>
      </div>

      <ReadinessChecks />

      <p className="note">
        Statements stay on this machine. No account number is written to a log or sent to a third
        party.
      </p>
    </>
  );
}
