export async function signIn(page) {
  await page.goto("/signin");
  await page.getByRole("link", { name: "Continue to Keycloak" }).click();
  await page.waitForURL((url) => !url.toString().includes("/signin"), {
    timeout: 15000,
  });
}
