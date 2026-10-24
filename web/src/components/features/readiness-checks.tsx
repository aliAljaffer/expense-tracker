import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";
import { probeHealth, probeReadiness } from "@/lib/health/probe";

type Check = {
  name: string;
  detail: string;
  state: "pass" | "wait";
  status: string;
};

function CheckIcon({ state }: { state: Check["state"] }) {
  if (state === "pass") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12.5 2.5 2.5L16 9.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4.5" />
      <path d="M12 16h.01" />
    </svg>
  );
}

export async function ReadinessChecks() {
  const healthResult = await probeHealth();
  const readinessResult = await probeReadiness();

  const checks: Check[] = [
    {
      name: "Web app",
      detail: "This page is rendered by the Next.js server.",
      state: "pass",
      status: "Serving",
    },
    {
      name: "Import API",
      detail: "The readiness probe arrives with the read endpoints.",
      state: healthResult.status === "ready" ? "pass" : "wait",
      status:
        healthResult.status === "ready"
          ? "Ready"
          : healthResult.reason || "Unavailable",
    },
    {
      name: "Statement store",
      detail: "Migrations are ready. The cluster is created at deploy time.",
      state:
        readinessResult.status === "ready"
          ? "pass"
          : readinessResult.status === "unknown"
            ? "wait"
            : "wait",
      status:
        readinessResult.status === "ready"
          ? "Ready"
          : readinessResult.reason || "Unavailable",
    },
  ];

  return (
    <section className="section" aria-labelledby="checks-heading">
      <h2 id="checks-heading" className="section__title">
        Checks
      </h2>
      <ul className="checks">
        {checks.map((check) => (
          <li key={check.name} className="check">
            <span
              className={cn("check__icon", check.state === "pass" && "check__icon--pass")}
              aria-hidden="true"
            >
              <CheckIcon state={check.state} />
            </span>
            <div className="check__body">
              <p className="check__name">{check.name}</p>
              <p className="check__detail">{check.detail}</p>
            </div>
            <StatusPill tone={check.state}>{check.status}</StatusPill>
          </li>
        ))}
      </ul>
    </section>
  );
}
