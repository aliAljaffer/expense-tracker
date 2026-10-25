import { expect, test, type Page } from "@playwright/test";
import { resolve } from "path";

const API_BASE_URL = `http://127.0.0.1:${process.env.API_PORT || "8901"}`;

async function uploadStatement(page: Page, filename: string) {
  await page.goto("/imports");
  await page.locator("input[type='file']").setInputFiles(resolve("web/e2e/.tmp", filename));
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("heading", { name: "Statement details" })).toBeVisible({
    timeout: 15000,
  });
}

test.describe("Phase 5W: Import Review", () => {
  test.beforeEach(async ({ page, request }) => {
    await request.delete(`${API_BASE_URL}/__imports`);

    await page.goto("/signin");
    const signInButton = page.getByRole("link", { name: "Continue to Keycloak" });
    await signInButton.click();

    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {
      // Timeout is OK
    });
  });

  test("Upload Alinma XLSX and verify header figures and rows", async ({ page }) => {
    await uploadStatement(page, "alinma_ok.xlsx");

    await expect(page.getByText("1,000.00 SAR", { exact: true })).toBeVisible();
    await expect(page.getByText("1,186.00 SAR", { exact: true })).toBeVisible();

    await expect(page.locator("table")).toBeVisible();
    expect(await page.locator("tbody tr").count()).toBeGreaterThan(0);

    await expect(page.getByText(/تم الشراء/).first()).toBeVisible();
  });

  test("Held rows are unselected and selectable", async ({ page }) => {
    await uploadStatement(page, "alrajhi_duplicate.pdf");

    const checkboxes = page.locator("[role='checkbox']");
    expect(await checkboxes.count()).toBeGreaterThan(0);

    const heldSelectable = page.locator(
      "[role='checkbox'][aria-checked='false']:not([aria-disabled='true'])"
    );
    expect(await heldSelectable.count()).toBeGreaterThan(0);

    const heldRow = page.locator("[role='checkbox'][aria-label*='UNUSUAL MERCHANT']");
    await expect(heldRow).toHaveAttribute("aria-checked", "false");
    await heldRow.click();
    await expect(heldRow).toHaveAttribute("aria-checked", "true");
  });

  test("Al Rajhi PDF upload succeeds with header and rows", async ({ page }) => {
    await uploadStatement(page, "alrajhi_ok.pdf");

    await expect(page.getByText("445.67 SAR", { exact: true })).toBeVisible();

    await expect(page.locator("table")).toBeVisible();
    expect(await page.locator("tbody tr").count()).toBeGreaterThan(0);
  });

  test("Failed reconciliation statement shows no commit control", async ({ page }) => {
    await uploadStatement(page, "alinma_rejected.xlsx");

    await expect(page.getByText("Import rejected")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Commit/ })).toHaveCount(0);
  });

  test("Re-upload same file shows already imported message", async ({ page }) => {
    await uploadStatement(page, "alinma_ok.xlsx");

    await page.getByRole("button", { name: /^Commit/ }).click();
    await expect(page.getByRole("heading", { name: "Import successful" })).toBeVisible();
    await page.getByRole("button", { name: "Import another statement" }).click();

    await page.locator("input[type='file']").setInputFiles(resolve("web/e2e/.tmp/alinma_ok.xlsx"));
    await page.getByRole("button", { name: "Upload" }).click();

    await expect(page.getByText("Already imported")).toBeVisible();
  });

  test("Cancel review leaves nothing inserted", async ({ page }) => {
    await uploadStatement(page, "alinma_duplicate.xlsx");

    await expect(page.locator("table")).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByRole("heading", { name: "Upload" })).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);
  });

  test("Exact duplicate row is disabled with reason shown", async ({ page }) => {
    await uploadStatement(page, "alrajhi_duplicate.pdf");

    const disabledCheckboxes = page.locator("[role='checkbox'][aria-disabled='true']");
    expect(await disabledCheckboxes.count()).toBeGreaterThan(0);

    await expect(page.getByText("Already imported").first()).toBeVisible();
    await expect(page.getByText("Exact fingerprint match").first()).toBeVisible();
  });

  test("Commit succeeds and clears the review", async ({ page }) => {
    await uploadStatement(page, "alinma_ok.xlsx");

    await page.getByRole("button", { name: /^Commit/ }).click();

    await expect(page.getByRole("heading", { name: "Import successful" })).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);
  });
});
