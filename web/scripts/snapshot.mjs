import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { signIn } from "../e2e/support/sign-in.mjs";

const base = process.env.SNAPSHOT_BASE ?? "http://127.0.0.1:3000";
const apiBase = `http://127.0.0.1:${process.env.API_PORT ?? "8901"}`;
const outDir = resolve(import.meta.dirname, "../test/snapshots");
const reminderEmail = "owner@example.com";

async function uploadAlinma(page) {
  await page.locator("input[type='file']").setInputFiles({
    name: "alinma_ok.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    // The fake API keys the review screen on the filename, not the bytes.
    buffer: Buffer.from("snapshot"),
  });
  await page.getByRole("button", { name: "Upload" }).click();
  await page.getByRole("heading", { name: "Statement details" }).waitFor({
    timeout: 15000,
  });
}

async function saveReminder(page) {
  await page.getByLabel("Reminder email").fill(reminderEmail);
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByText("Reminder email saved.").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(
    (email) => document.querySelector("#reminder-email")?.value === email,
    reminderEmail
  );
}

const routes = [
  ["signin", "/signin"],
  ["health", "/health"],
  ["overview", "/overview", (page) => page.waitForSelector("table")],
  [
    "transactions",
    "/overview/transactions",
    (page) => page.waitForSelector(".transactions-table"),
  ],
  ["imports-review", "/imports", uploadAlinma],
  ["suggestions", "/suggestions", (page) => page.waitForSelector(".suggestions-cards")],
  ["settings", "/settings", saveReminder],
];

mkdirSync(outDir, { recursive: true });

await fetch(`${apiBase}/__bnpl-variant?variant=ok`, { method: "POST" });

const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());

async function capture(context, [name, path, prepare]) {
  const page = await context.newPage();
  await page.goto(path, { waitUntil: "networkidle" });
  if (prepare) await prepare(page);

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
    document.querySelectorAll("input:not([type='file'])").forEach((input) => {
      if (input.value) input.setAttribute("value", input.value);
    });

    // Recharts bakes the width it measured at 1280px into the wrapper. Lift the
    // svg into its responsive container so the static copy scales like the live chart.
    document.querySelectorAll(".recharts-wrapper").forEach((wrapper) => {
      const svg = wrapper.querySelector("svg.recharts-surface");
      const container = wrapper.closest(".recharts-responsive-container");
      if (!svg || !container) return;
      wrapper.remove();
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.style.maxWidth = "100%";
      svg.style.display = "block";
      container.appendChild(svg);
    });

    // Recharts leaves a hidden measurement span at the page edge. Its text is
    // as wide as the platform font makes it, so it widened the static page on
    // Linux while fitting on macOS.
    document.querySelectorAll("#recharts_measurement_span").forEach((span) => span.remove());
  }, css);

  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
    await page.waitForTimeout(150);
    writeFileSync(resolve(outDir, `${name}-${theme}.html`), await page.content());
  }

  await page.close();
}

const anonymous = await browser.newContext({ baseURL: base, viewport: { width: 1280, height: 900 } });
await capture(anonymous, routes[0]);
await anonymous.close();

const signedIn = await browser.newContext({ baseURL: base, viewport: { width: 1280, height: 900 } });
const authPage = await signedIn.newPage();
await signIn(authPage);
await authPage.close();
for (const route of routes.slice(1)) await capture(signedIn, route);
await signedIn.close();

await browser.close();
console.log(`wrote ${routes.length * 2} snapshots to ${outDir}`);
