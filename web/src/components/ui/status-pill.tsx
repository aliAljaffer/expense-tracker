import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatusPill({ tone, children }: { tone: "pass" | "wait"; children: ReactNode }) {
  return <span className={cn("pill", `pill--${tone}`)}>{children}</span>;
}
