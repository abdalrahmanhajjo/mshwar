/**
 * Security plan SEC-35: pages run under a nonce-based Content Security Policy. The page's own
 * scripts load and hydrate with no violation, while script an attacker manages to inject
 * (an inline <script>, an inline event handler) does not run.
 */
import { expect, test } from "@playwright/test";

const E2E_ORIGIN = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([{ name: "mshwar-consent", value: "v1.e0.m0", url: E2E_ORIGIN }]);
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = seen;
    document.addEventListener("securitypolicyviolation", (event) => seen.push(event.violatedDirective));
  });
});

test("a page loads under a nonce policy with no violation", async ({ page }) => {
  const response = await page.goto("/");
  const policy = response?.headers()["content-security-policy"] ?? "";
  expect(policy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(policy.split("; ").find((part) => part.startsWith("script-src"))).not.toContain("unsafe-inline");
  expect(response?.headers()["reporting-endpoints"]).toBe('csp="/api/v1/security/csp-report"');

  // Hydrated: the client-side menu opens.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("button", { name: "Close menu" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);

  const second = await page.request.get("/");
  const nonceOf = (value: string) => /'nonce-([^']+)'/.exec(value)?.[1];
  expect(nonceOf(second.headers()["content-security-policy"])).not.toBe(nonceOf(policy));
});

test("script injected into the page does not run", async ({ page }) => {
  await page.route("**/api/v1/security/csp-report", (route) => route.fulfill({ status: 204 }));
  // Stored XSS as it would reach a browser: markup in the server's HTML, under the server's policy.
  await page.route("**/", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    const html = (await response.text()).replace(
      "</body>",
      '<script>window.__inline = true</script><img src="data:," onerror="window.__handler = true"></body>',
    );
    await route.fulfill({ response, body: html });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open menu" }).or(page.locator("nav").first())).toBeVisible();
  await page.waitForTimeout(300);
  const ran = await page.evaluate(() => {
    const flags = window as unknown as { __inline?: boolean; __handler?: boolean };
    return { inline: Boolean(flags.__inline), handler: Boolean(flags.__handler) };
  });
  expect(ran).toEqual({ inline: false, handler: false });
  const violations = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
  expect(violations.filter((directive) => directive.startsWith("script-src")).length).toBeGreaterThanOrEqual(2);
});
