import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Link href="/" className="wordmark">
          <span className="wordmark__mark" aria-hidden="true" />
          Expense Tracker
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
