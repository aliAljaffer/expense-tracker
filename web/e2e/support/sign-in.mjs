export async function signIn(page) {
  await page.goto("/signin");
  const appOrigin = new URL(page.url()).origin;

  await page.getByRole("link", { name: "Continue to Keycloak" }).click();

  const user = process.env.E2E_KEYCLOAK_USER;
  const pass = process.env.E2E_KEYCLOAK_PASSWORD;

  if (user && pass) {
    await page.waitForSelector("#username", { timeout: 30000 });
    await page.fill("#username", user);
    await page.fill("#password", pass);
    await page.click("#kc-login");
  }

  await page.waitForFunction(
    (origin) => location.origin === origin && !location.pathname.startsWith("/signin"),
    appOrigin,
    { timeout: 90000 }
  );
}
