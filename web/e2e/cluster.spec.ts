import { expect, test } from "@playwright/test";
import { resolve } from "path";
import { signIn } from "./support/sign-in.mjs";

const clusterUser = process.env.E2E_KEYCLOAK_USER;

test.describe("real cluster", () => {
  test.skip(!clusterUser, "set E2E_KEYCLOAK_USER and E2E_KEYCLOAK_PASSWORD to run");

  test("sign in, upload a fixture, review the preview, cancel", async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);
    await page.goto("/imports");

    await page.locator("input[type='file']").setInputFiles(resolve("web/e2e/.tmp/alinma_ok.xlsx"));
    await page.getByRole("button", { name: "Upload" }).click();

    await expect(page.getByRole("heading", { name: "Statement details" })).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText("1,186.00 SAR", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: "Upload" })).toBeVisible({ timeout: 30000 });
  });
});
