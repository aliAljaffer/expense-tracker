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
          <svg className="wordmark__mark" viewBox="0 0 256 256" aria-hidden="true" focusable="false">
            <rect width="256" height="256" rx="57.6" className="wordmark__tile" />
            <path className="wordmark__glyph" transform="translate(61.40 40.00) translate(-7.12 131.05) scale(0.24835 -0.24835)" d="M274.3 -181Q189.3 -181 134.8 -168Q80.3 -155 54.5 -128.8Q28.7 -102.7 28.7 -64Q28.7 -18 64.8 11.3Q101 40.7 173.3 47.7V67.7Q119 67.3 91 79.3Q63 91.3 63 119.3Q63 147 91 167.8Q119 188.7 183 203V223Q122 226 87.8 261.5Q53.7 297 53.7 354.3Q53.7 404.7 81.5 443.7Q109.3 482.7 163.8 505.2Q218.3 527.7 297 527.7H555.7V428.7L392.7 452V430.3Q454 420 483.5 395.2Q513 370.3 513 327.3Q513 286 486.7 254.5Q460.3 223 411 205.5Q361.7 188 291.7 188Q278.7 188 263.8 189.2Q249 190.3 216.7 194.3Q195.3 179 182.7 167.3Q170 155.7 170 146Q170 137.3 180.2 132.2Q190.3 127 206.2 124.8Q222 122.7 237 122.7H375.7Q395.7 122.7 427.2 119.5Q458.7 116.3 490.2 103.3Q521.7 90.3 543.3 62.2Q565 34 565 -16.7Q565 -73.3 532.5 -110Q500 -146.7 435.5 -163.8Q371 -181 274.3 -181ZM286 -79.3Q348 -79.3 384.8 -72.2Q421.7 -65 437.7 -49.3Q453.7 -33.7 453.7 -9.7Q453.7 12.3 443.5 24.8Q433.3 37.3 417.8 42.3Q402.3 47.3 386.5 48.5Q370.7 49.7 359.7 49.7H237Q189.3 43.3 169.7 23.2Q150 3 150 -22Q150 -45.7 166 -58Q182 -70.3 212.5 -74.8Q243 -79.3 286 -79.3ZM288.3 257.3Q341.3 257.3 368.2 281.8Q395 306.3 395 346Q395 388.7 367.7 416.2Q340.3 443.7 287.3 443.7Q235 443.7 206.7 416.8Q178.3 390 178.3 348Q178.3 321.3 191 300.8Q203.7 280.3 228.2 268.8Q252.7 257.3 288.3 257.3Z" />
          </svg>
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
