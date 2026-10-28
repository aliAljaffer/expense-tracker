"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const links = [
  { href: "/overview", label: "Overview" },
  { href: "/imports", label: "Import" },
  { href: "/suggestions", label: "Suggestions" },
  { href: "/chat", label: "Chat" },
  { href: "/health", label: "Health" },
  { href: "/settings", label: "Settings" },
];

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

        <nav className="nav" aria-label="Primary">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="nav__link"
              aria-current={isCurrentPage(link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="site-header__actions">
          <Popover className="nav-menu">
            <PopoverButton className="icon-button" aria-label="Menu">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </PopoverButton>
            <PopoverPanel className="nav-menu__panel">
              {({ close }) => (
                <>
                  {links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="nav-menu__link"
                      aria-current={isCurrentPage(link.href) ? "page" : undefined}
                      onClick={() => close()}
                    >
                      {link.label}
                    </Link>
                  ))}
                </>
              )}
            </PopoverPanel>
          </Popover>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
