/**
 * MSHWAR-184 — breakpoint verification for the responsive app shell.
 *
 * There is no Figma API access in this repo, so a pixel compare against the
 * 390 / 1440 Figma frames remains a later manual designer step. These tests
 * lock the engineering acceptance criteria: no horizontal scroll, mobile nav
 * collapse below `lg`, language switcher direction flip without a reload, and
 * distinct traveller / business / admin navigation.
 */
import { expect, test, type Page } from "@playwright/test";

const E2E_ORIGIN = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";

async function signInForShell(page: Page) {
  await page.context().addCookies([{ name: "mshwar_session", value: "e2e-placeholder", url: E2E_ORIGIN }]);
  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "00000000-0000-0000-0000-000000000001",
        email: "e2e@example.com",
        display_name: "Operator",
        locale: "en",
      }),
    });
  });
}

async function assertNoHorizontalScroll(page: Page) {
  const metrics = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(metrics.scroll, "documentElement must not overflow the viewport").toBeLessThanOrEqual(metrics.client + 1);
  expect(metrics.body, "body must not overflow the viewport").toBeLessThanOrEqual(metrics.client + 1);
}

test.describe("MSHWAR-26 responsive app shell", () => {
  test("traveller 390px: no overflow, collapsed nav, RTL without reload", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator("[data-shell='traveller']")).toBeVisible();
    await assertNoHorizontalScroll(page);

    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    await page.getByRole("button", { name: "Open menu" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Plan" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Listings" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    const hrefBefore = page.url();
    await page.getByRole("button", { name: "العربية" }).first().click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("[data-shell='traveller']")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("button", { name: "فتح القائمة" })).toBeVisible();
    expect(page.url()).toBe(hrefBefore);
    await assertNoHorizontalScroll(page);
  });

  test("traveller 1440px: desktop nav, no hamburger, no overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await assertNoHorizontalScroll(page);
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Menu" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Plan" })).toBeVisible();
  });

  test("business and admin shells share chrome but differ in navigation", async ({ page }) => {
    await signInForShell(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/business");
    await expect(page.locator("[data-shell='business']")).toBeVisible();
    await expect(page.locator("aside")).toBeVisible();
    await expect(page.getByRole("link", { name: "Listings" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Discover" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Moderation" })).toHaveCount(0);
    await assertNoHorizontalScroll(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.locator("aside")).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog").getByRole("link", { name: "Listings" })).toBeVisible();
    await page.keyboard.press("Escape");
    await assertNoHorizontalScroll(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin");
    await expect(page.locator("[data-shell='admin']")).toBeVisible();
    await expect(page.getByRole("link", { name: "Moderation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Listings" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Discover" })).toHaveCount(0);
    await assertNoHorizontalScroll(page);
  });
});

test.describe("MSHWAR-29 recovery routes", () => {
  test("forgot-password shows the same success copy after submit", async ({ page }) => {
    await page.route("**/api/v1/auth/forgot-password", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "If an account exists for this address, a reset link has been sent.",
    );
    await expect(page).toHaveURL(/\/forgot-password$/);
  });

  test("forgot-password is usable at 390px and 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: "Forgot password?" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
    await assertNoHorizontalScroll(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/forgot-password");
    await expect(page.getByRole("link", { name: "Back to sign in" })).toBeVisible();
    await assertNoHorizontalScroll(page);
  });

  test("reset-password shows invalid state without a token and a form with one", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/reset-password");
    await expect(page.getByText("This reset link is invalid or has expired.")).toBeVisible();
    await assertNoHorizontalScroll(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/reset-password?token=demo-token");
    await expect(page.getByLabel("New password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Update password" })).toBeVisible();
    await assertNoHorizontalScroll(page);
  });
});

test.describe("MSHWAR-28 auth routes", () => {
  test("unauthenticated /plan returns the user to sign-in with next", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/plan");
    await expect(page).toHaveURL(/\/signin\?next=/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await assertNoHorizontalScroll(page);
  });

  test("sign-up is usable at 390px and 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Sign up" })).toBeVisible();
    await expect(page.getByLabel("Display name")).toBeVisible();
    await assertNoHorizontalScroll(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/signup");
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
    await assertNoHorizontalScroll(page);
  });
});
