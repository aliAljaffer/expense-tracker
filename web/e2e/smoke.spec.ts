import { expect, test } from "@playwright/test";

test("sign-in shell renders with a sign-in control", async ({ page }) => {
  await page.goto("/signin");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Read your statements");
  await expect(page.getByRole("link", { name: "Continue to Keycloak" })).toBeVisible();
});

test("health page lists the three readiness checks", async ({ page }) => {
  // Sign in first
  await page.goto("/signin");
  const signInLink = page.getByRole("link", { name: "Continue to Keycloak" });
  await signInLink.click();

  // Wait for auth flow to complete
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {
    // Timeout is OK, continue
  });

  // Navigate to health page
  await page.goto("/health");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Import readiness.");
  await expect(page.getByRole("listitem")).toHaveCount(3);
});

test("theme toggle switches the document theme", async ({ page }) => {
  // Sign in first
  await page.goto("/signin");
  const signInLink = page.getByRole("link", { name: "Continue to Keycloak" });
  await signInLink.click();

  // Wait for auth flow to complete
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {
    // Timeout is OK, continue
  });

  // Navigate to health page
  await page.goto("/health");

  await page.getByRole("button", { name: "Dark theme" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
