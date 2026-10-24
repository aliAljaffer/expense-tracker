import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { template: "%s | grooszy", default: "grooszy" },
  description: "Private analysis of Alinma and Al Rajhi statements.",
};

const themeScript = `
(function() {
  const key = 'grooszy-theme';
  const stored = localStorage.getItem(key);
  const theme = (stored === 'light' || stored === 'dark') ? stored :
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
