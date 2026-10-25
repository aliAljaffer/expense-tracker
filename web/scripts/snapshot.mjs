import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const base = process.env.SNAPSHOT_BASE ?? "http://127.0.0.1:3000";
const outDir = resolve(import.meta.dirname, "../test/snapshots");

const routes = [
  ["signin", "/signin"],
  ["health", "/health"],
];

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());

for (const [name, path] of routes) {
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
    await page.waitForTimeout(150);

    const css = await page.evaluate(async () => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      const parts = await Promise.all(links.map((link) => fetch(link.href).then((r) => r.text())));
      return parts.join("\n");
    });

    await page.evaluate((sheet) => {
      document
        .querySelectorAll('link[rel="stylesheet"], link[rel="preload"], script')
        .forEach((element) => element.remove());
      const style = document.createElement("style");
      style.textContent = sheet;
      document.head.prepend(style);
    }, css);

    writeFileSync(resolve(outDir, `${name}-${theme}.html`), await page.content());
    await page.close();
  }
}

await browser.close();
console.log(`wrote ${routes.length * 2} snapshots to ${outDir}`);
