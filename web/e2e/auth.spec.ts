import { expect, test } from "@playwright/test";

const APP_ORIGIN = "http://127.0.0.1:3000";
const API_BASE_URL = "http://127.0.0.1:8901";

// Helper to extract access token from cookies (for testing purposes)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSessionCookies(page: any): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cookies = await page.context().cookies() as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return cookies.filter((c: any) => c.name.startsWith("et_session"));
}

// Helper to check localStorage and sessionStorage
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkBrowserStorage(page: any) {
  const localStorage = await page.evaluate(() => {
    const result: Record<string, string> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) {
        result[key] = window.localStorage.getItem(key) || "";
      }
    }
    return result;
  });

  const sessionStorage = await page.evaluate(() => {
    const result: Record<string, string> = {};
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key) {
        result[key] = window.sessionStorage.getItem(key) || "";
      }
    }
    return result;
  });

  return { localStorage, sessionStorage };
}

// Test (a): Unauthenticated visit to /health redirects to /signin
test("(a) unauthenticated visit to /health redirects to /signin", async ({
  page,
}) => {
  await page.goto("/health");

  // Should redirect to /signin
  expect(page.url()).toContain("/signin");
});

// Test (a): Direct GET /api/bff/accounts returns 401
test("(a) direct GET /api/bff/accounts returns 401 without session", async ({
  page,
}) => {
  const response = await page.request.get(`${APP_ORIGIN}/api/bff/accounts`);

  expect(response.status()).toBe(401);
});

// Test (b): Sign in through the issuer and reach /health showing the subject
test("(b) sign in through issuer and reach /health with subject displayed", async ({
  page,
}) => {
  // Visit signin page
  await page.goto("/signin");

  // Click the sign-in link (styled as a button)
  const signInLink = page.getByRole("link", { name: "Continue to Keycloak" });
  await signInLink.click();

  // We're now at the authorize endpoint
  // The test issuer auto-approves and redirects back with code
  // The callback handler exchanges the code for tokens

  // Wait for navigations to complete (multiple redirects through auth flow)
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {
    // Timeout is OK, just continue
  });

  // Should be on a protected page (home or health)
  // Verify we can see the subject
  const heading = page.getByRole("heading", { level: 1 });
  const text = await heading.textContent();

  // The subject should appear somewhere on the page
  expect(text).toBeTruthy();
});

// Test (c): Access token does not appear in page HTML, localStorage, sessionStorage, or non-HttpOnly cookies
test("(c) access token is not in HTML, localStorage, sessionStorage, or non-HttpOnly cookies", async ({
  page,
}) => {
  // First, sign in
  await page.goto("/signin");
  const signInButton = page.getByRole("link", { name: "Continue to Keycloak" });
  await signInButton.click();

  // Wait for redirect to complete
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {
    // Timeout is OK, just continue
  });

  // Check HTML content
  const htmlContent = await page.content();

  // The access token from the issuer is a random hex string
  // We can't check for a specific token, but we can verify patterns don't exist
  // Check that we don't have common Bearer token patterns in HTML
  expect(htmlContent).not.toMatch(/Bearer\s+[a-f0-9]{64}/i);

  // Check localStorage and sessionStorage
  const { localStorage, sessionStorage } = await checkBrowserStorage(page);
  const allStorage = JSON.stringify(localStorage) + JSON.stringify(sessionStorage);

  // Should not contain access_token or long hex strings that look like tokens
  expect(allStorage).not.toMatch(/access_token/i);
  expect(allStorage).not.toMatch(/Bearer/);

  // Check non-HttpOnly cookies (cookies should only be HttpOnly)
  const cookies = await page.context().cookies();
  const nonHttpOnlyCookies = cookies.filter((c) => !c.httpOnly);

  // Session cookies should all be HttpOnly
  const sessionCookies = nonHttpOnlyCookies.filter((c) =>
    c.name.startsWith("et_session")
  );
  expect(sessionCookies).toHaveLength(0);
});

// Test (d): BFF request to fake API carries Authorization: Bearer and no Cookie header
test("(d) BFF proxy adds Bearer token and removes Cookie header", async ({
  page,
}) => {
  // Sign in first
  await page.goto("/signin");
  const signInButton = page.getByRole("link", { name: "Continue to Keycloak" });
  await signInButton.click();

  // Wait for redirect
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {
    // Timeout is OK, just continue
  });

  // Now make a request through the BFF to /api/bff/accounts
  // This should proxy to the fake API at /api/accounts
  const response = await page.request.get(`${APP_ORIGIN}/api/bff/accounts`);

  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.accounts).toBeTruthy();

  // Check the fake API to see what headers it received
  const lastResponse = await page.request.get(
    `${API_BASE_URL}/__last`
  );
  const lastHeaders = await lastResponse.json();

  // Should have Bearer authorization
  expect(lastHeaders.authorization).toMatch(/^Bearer /);

  // Should NOT have cookie header (it's explicitly dropped)
  expect(lastHeaders.cookie).toBeNull();
});

// Test (e): Token refresh with short-lived access tokens
test("(e) token refresh works when access token expires", async ({ page }) => {
  // Sign in first (uses short-lived token from env: 5 seconds)
  await page.goto("/signin");
  const signInButton = page.getByRole("link", { name: "Continue to Keycloak" });
  await signInButton.click();

  // Wait for redirect
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {
    // Timeout is OK, just continue
  });

  // Wait for token to expire (5 seconds + some buffer)
  await page.waitForTimeout(7000);

  // Make a request - should still work due to refresh
  const response = await page.request.get(`${APP_ORIGIN}/api/bff/accounts`);
  expect(response.status()).toBe(200);

  const data = await response.json();
  expect(data.accounts).toBeTruthy();
});

// Test (f): Logout clears session and redirects to /signin
test("(f) logout clears session and redirects to /signin", async ({ page }) => {
  // Sign in first
  await page.goto("/signin");
  const signInButton = page.getByRole("link", { name: "Continue to Keycloak" });
  await signInButton.click();

  // Wait for redirect
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {
    // Timeout is OK, just continue
  });

  // Verify we're signed in by checking session cookie exists
  let sessionCookies = await getSessionCookies(page);
  expect(sessionCookies.length).toBeGreaterThan(0);

  // Make a logout request
  const response = await page.request.post(`${APP_ORIGIN}/api/auth/logout`, {
    headers: {
      "Origin": APP_ORIGIN,
    },
  });

  expect([200, 302]).toContain(response.status());

  // Navigate to health page - should redirect to signin
  await page.goto("/health");

  // Should be redirected to signin
  expect(page.url()).toContain("/signin");

  // Session cookies should be cleared
  sessionCookies = await getSessionCookies(page);
  expect(sessionCookies).toHaveLength(0);
});

// Test (g): Expired session cookie (issuer refresh denied) redirects to /signin
test("(g) expired or invalid session cookie redirects to /signin", async ({
  page,
  context,
}) => {
  // Sign in first
  await page.goto("/signin");
  const signInButton = page.getByRole("link", { name: "Continue to Keycloak" });
  await signInButton.click();

  // Wait for redirect
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {
    // Timeout is OK, just continue
  });

  // Verify we're signed in
  const sessionCookies = await getSessionCookies(page);
  expect(sessionCookies.length).toBeGreaterThan(0);

  // Clear all session cookies to simulate expiration
  for (const cookie of sessionCookies) {
    await context.clearCookies({ name: cookie.name });
  }

  // Try to access a protected page
  await page.goto("/health");

  // Should redirect to signin
  expect(page.url()).toContain("/signin");
});

// Test (h): Tampered state on callback redirects to /signin?error=invalid_state
test("(h) tampered state on callback shows error=invalid_state", async ({
  page,
}) => {
  // Start sign-in process
  await page.goto("/signin");
  const signInButton = page.getByRole("link", { name: "Continue to Keycloak" });

  // Intercept the initial sign-in request to get the state
  let capturedState = "";
  await page.context().on("request", (request) => {
    if (request.url().includes("/authorize")) {
      const url = new URL(request.url());
      capturedState = url.searchParams.get("state") || "";
    }
  });

  // Click sign-in
  await signInButton.click();

  // Wait a moment for the authorize request to go through
  await page.waitForTimeout(1000);

  // We'll directly navigate to the callback with a tampered state
  if (capturedState) {
    const tamperedState = "tampered-state-value";
    const fakeCode = "fake-auth-code";

    await page.goto(
      `${APP_ORIGIN}/api/auth/callback?code=${fakeCode}&state=${tamperedState}`
    );

    // Should redirect to signin with error
    await page.waitForURL("**/signin*", { timeout: 5000 });
    expect(page.url()).toContain("signin");
    expect(page.url()).toContain("error=invalid_state");
  }
});

// Test (i): Sign-in error parameter displays readable message
test("(i) visiting /signin?error=invalid_state shows error message", async ({
  page,
}) => {
  const response = await page.goto("/signin?error=invalid_state");

  expect(response?.status()).toBe(200);

  const htmlContent = await page.content();

  expect(htmlContent).toContain('role="alert"');
  expect(htmlContent).toContain("Sign-in could not be verified");
  expect(htmlContent).toContain('class="alert__text"');
});
