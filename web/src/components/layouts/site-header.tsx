import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Link href="/" className="wordmark">
          <span className="wordmark__mark" aria-hidden="true" />
          grooszy
        </Link>
        <nav className="flex gap-6">
          <Link href="/health" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-focus-ring)] rounded px-2 py-1">
            Health
          </Link>
          <Link href="/imports" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-focus-ring)] rounded px-2 py-1">
            Import
          </Link>
          <Link href="/overview" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-focus-ring)] rounded px-2 py-1">
            Overview
          </Link>
          <Link href="/suggestions" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-focus-ring)] rounded px-2 py-1">
            Suggestions
          </Link>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
