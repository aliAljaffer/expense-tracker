"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function SiteHeader() {
  const pathname = usePathname();

  const isCurrentPage = (href: string) => pathname === href;

  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Link href="/" className="wordmark">
          <span className="wordmark__mark" aria-hidden="true" />
          grooszy
        </Link>
        <nav className="nav">
          <Link href="/health" className="nav__link" aria-current={isCurrentPage("/health") ? "page" : undefined}>
            Health
          </Link>
          <Link href="/imports" className="nav__link" aria-current={isCurrentPage("/imports") ? "page" : undefined}>
            Import
          </Link>
          <Link href="/overview" className="nav__link" aria-current={isCurrentPage("/overview") ? "page" : undefined}>
            Overview
          </Link>
          <Link href="/suggestions" className="nav__link" aria-current={isCurrentPage("/suggestions") ? "page" : undefined}>
            Suggestions
          </Link>
          <Link href="/settings" className="nav__link" aria-current={isCurrentPage("/settings") ? "page" : undefined}>
            Settings
          </Link>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
