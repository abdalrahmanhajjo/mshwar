/**
 * MSHWAR-184 — breakpoint verification for the responsive app shell.
 *
 * There is no Figma API access in this repo, so a pixel compare against the
 * 390 / 1440 Figma frames remains a later manual designer step. These tests
 * lock the engineering acceptance criteria: no horizontal scroll, mobile nav
 * collapse below `lg`, language switcher direction flip without a reload, and
 * distinct traveller / guide / admin navigation.
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
        admin_tier: "elevated",
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

// Most tests start from a visitor who already chose "Essential only", so the cookie
// banner doesn't cover the page; the MSHWAR-113 tests below start from a fresh visitor.
async function chooseEssentialCookies(page: Page) {
  await page.context().addCookies([{ name: "mshwar-consent", value: "v1.e0.m0", url: E2E_ORIGIN }]);
}

test.beforeEach(async ({ page }, testInfo) => {
  if (!testInfo.title.includes("[fresh visitor]")) {
    await chooseEssentialCookies(page);
  }
});

test.describe("MSHWAR-26 responsive app shell", () => {
  test("traveller 390px: no overflow, collapsed nav, RTL without reload", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator("[data-shell='traveller']").first()).toBeVisible();
    await assertNoHorizontalScroll(page);

    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    await page.getByRole("button", { name: "Open menu" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Plan a trip" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Listings" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "العربية" }).first().click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("[data-shell='traveller']").first()).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("button", { name: "فتح القائمة" })).toBeVisible();
    await expect(page).toHaveURL(/\/ar\/?/);
    await assertNoHorizontalScroll(page);
  });

  test("traveller 1440px: desktop nav, no hamburger, no overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await assertNoHorizontalScroll(page);
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Menu" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Menu" }).getByRole("link", { name: "Plan a trip" }),
    ).toBeVisible();
  });

  test("guide and admin shells share chrome but differ in navigation", async ({ page }) => {
    await signInForShell(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/guide");
    await expect(page.locator("[data-shell='guide']").first()).toBeVisible();
    await expect(page.getByRole("complementary")).toBeVisible();
    await expect(page.getByRole("link", { name: "Tours" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Discover" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Moderation" })).toHaveCount(0);
    await assertNoHorizontalScroll(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("complementary")).toHaveCount(0);
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog").getByRole("link", { name: "Tours" })).toBeVisible();
    await page.keyboard.press("Escape");
    await assertNoHorizontalScroll(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin");
    await expect(page.locator("[data-shell='admin']").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Moderation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tours" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Discover" })).toHaveCount(0);
    await assertNoHorizontalScroll(page);
  });
});

test("planner hides unmatched steps and says nothing was found when the API returns an empty day", async ({
  page,
}, testInfo) => {
  await signInForShell(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const requested = [
    ["exchange", "change currency"],
    ["meal", "breakfast at a sweets place"],
    ["sight", "see a mountain"],
    ["meal", "eat dinner"],
    ["activity", "play bowling"],
    ["activity", "watch a film at the cinema"],
    ["stay", "stay the night at a hotel"],
  ];
  await page.route("**/api/v1/planner/sessions", async (route) => {
    await route.fulfill({
      json: {
        session_id: "session-no-match",
        status: "infeasible",
        degraded: false,
        degraded_message: null,
        constraints: {},
        assumed_defaults: [],
        clarifications: [],
        plan: null,
        day: requested.map(([role, text], index) => ({
          order: index + 1,
          role,
          text,
          tags: [],
          meal: null,
          status: "empty",
          reason: "no_trusted_match",
          starts_at: null,
          ends_at: null,
          travel_minutes: null,
          wait_minutes: 0,
          experience_id: null,
          slug: null,
          title: null,
          destination_slug: null,
          office: null,
          trust: {},
          flags: [],
          named_place: null,
          price: null,
          actions: {},
        })),
      },
    });
  });
  await page.goto("/plan");
  await page.getByRole("button", { name: "Beirut", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Budget (USD)").fill("300");
  const request = requested.map(([, text]) => text).join(" then ");
  await page.getByLabel("Anything specific? (optional)").fill(request);
  await page.getByRole("button", { name: "Generate itinerary" }).click();
  const main = page.getByRole("main");
  // Steps no trusted place could fill are left out; the planner says it found nothing for the day.
  await expect(main.getByText(/We could not find trusted places for this day yet/)).toBeVisible();
  await expect(main.getByRole("list", { name: "Day 1" })).toHaveCount(0);
  await expect(main.getByText("Not filled")).toHaveCount(0);
  await expect(main.getByText(/Saved to My Trips automatically/)).toHaveCount(0);
  await assertNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("planner-no-match.png"), fullPage: true });
  await page.getByRole("button", { name: "Edit trip details" }).click();
  await expect(page.getByLabel("Budget (USD)")).toHaveValue("300");
  await expect(page.getByLabel("Anything specific? (optional)")).toHaveValue(request);
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
    // Suspense can briefly keep a hidden streamed copy outside the page landmark.
    await expect(page.getByRole("main").getByText("This reset link is invalid or has expired.")).toBeVisible();
    await expect(page.getByRole("main").getByLabel("New password")).toHaveCount(0);
    await assertNoHorizontalScroll(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/reset-password?token=demo-token");
    await expect(page.getByLabel("New password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Update password" })).toBeVisible();
    await assertNoHorizontalScroll(page);
  });
});

test.describe("MSHWAR-30 verification routes", () => {
  test("verify-email is usable at 390px and 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/verify-email");
    await expect(page.getByRole("heading", { name: "Verify email" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Resend verification email" })).toBeVisible();
    await assertNoHorizontalScroll(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/verify-email");
    await expect(page.getByLabel("Email")).toBeVisible();
    await assertNoHorizontalScroll(page);
  });

  test("verify-email shows the same success copy after resend", async ({ page }) => {
    await page.route("**/api/v1/auth/resend-verification", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/verify-email");
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByRole("button", { name: "Resend verification email" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "If this address still needs verification, a new link has been sent.",
    );
    await expect(page).toHaveURL(/\/verify-email$/);
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

test.describe("MSHWAR-31 settings routes", () => {
  test("unauthenticated /settings returns the user to sign-in", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/signin\?next=/);
  });

  test("settings is usable at 390px and 1440px when signed in", async ({ page }) => {
    await signInForShell(page);
    await mockSettingsApis(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(page.getByLabel("Display name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save profile" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your data" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download my data" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Anonymise my account" })).toBeDisabled();
    await assertNoHorizontalScroll(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Preferences", exact: true })).toBeVisible();
    await assertNoHorizontalScroll(page);
  });
});

async function mockSettingsApis(page: Page) {
  await page.route("**/api/v1/profile/vocabularies", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        dietary: [
          { kind: "dietary", slug: "vegetarian", label: "Vegetarian" },
          { kind: "dietary", slug: "halal", label: "Halal" },
        ],
        accessibility: [{ kind: "accessibility", slug: "step-free", label: "Step-free access" }],
        interest: [
          { kind: "interest", slug: "food", label: "Food" },
          { kind: "interest", slug: "heritage", label: "Heritage" },
        ],
        activity_intensity: [
          { kind: "activity_intensity", slug: "relaxed", label: "Relaxed" },
          { kind: "activity_intensity", slug: "moderate", label: "Moderate" },
        ],
      }),
    });
  });
  await page.route("**/api/v1/locations/areas", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "catalog",
        picker: "map",
        replace_with: "none",
        areas: [{ id: "area-1", slug: "beirut", name: "Beirut", country_code: "LB" }],
      }),
    });
  });
  await page.route("**/api/v1/profile", async (route) => {
    const locale = route.request().method() === "PUT" ? JSON.parse(route.request().postData() ?? "{}").locale : "en";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "00000000-0000-0000-0000-000000000001",
        email: "e2e@example.com",
        display_name: "Operator",
        locale: locale ?? "en",
        preferences: {
          source: "explicit",
          home_area_id: null,
          default_group_size: null,
          activity_intensity: null,
          dietary: [],
          accessibility: [],
          interests: [],
          start_location: null,
        },
        home_area: null,
      }),
    });
  });
  await page.route("**/api/v1/privacy/export", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-disposition": 'attachment; filename="mshwar-data-export.json"' },
      body: JSON.stringify({
        profile: { email: "e2e@example.com" },
        trips: [],
        favorites: [],
        reviews: [],
        bookings: [],
      }),
    });
  });
  await page.route("**/api/v1/privacy/reset-personalisation", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, preferences: {}, identity_kept: true, bookings_kept: true }),
    });
  });
  await page.route("**/api/v1/privacy/delete-account", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, status: "deleted", bookings_kept: 0 }),
    });
  });
}

test.describe("MSHWAR-34 privacy controls", () => {
  test("settings privacy actions stay usable at 390px", async ({ page }) => {
    await signInForShell(page);
    await mockSettingsApis(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings");
    await expect(page.getByText("JSON of your profile, trips, favorites, reviews and bookings.")).toBeVisible();
    await page.getByRole("button", { name: "Reset personalisation" }).click();
    await expect(page.getByText("Personalisation signals were cleared.")).toBeVisible();
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await expect(page.getByRole("button", { name: "Anonymise my account" })).toBeEnabled();
    await assertNoHorizontalScroll(page);
  });
});

test.describe("MSHWAR-32 language URLs", () => {
  test("Arabic prefix is shareable and renders RTL without a cookie first", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/ar");
    await expect(page).toHaveURL(/\/ar\/?/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "اترك مساحة لمشوار صغير." })).toBeVisible();
    await page.goto("/fr/destinations");
    await expect(page.getByRole("heading", { name: "Où allez-vous flâner ?" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("guest cookie keeps Arabic on an unprefixed visit", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const cookie = (await page.context().cookies()).find((item) => item.name === "mshwar-locale");
    expect(cookie?.value).toBe("ar");
    await page.goto("/destinations");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "إلى أين ستتجول؟" })).toBeVisible();
  });

  test("settings language select prefixes the shareable URL", async ({ page }) => {
    await signInForShell(page);
    await mockSettingsApis(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await page.getByRole("combobox", { name: "Language" }).click();
    await page.getByRole("option", { name: "Français" }).click();
    await expect(page).toHaveURL(/\/fr\/settings/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("heading", { name: "Profil" })).toBeVisible();
  });
});

test.describe("MSHWAR-36 / MSHWAR-39 marketing browse", () => {
  test("home and destinations match the marketing hierarchy at 390 and 1440", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Make room for a little mshwar." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Find my next place" })).toBeVisible();
    await assertNoHorizontalScroll(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/destinations");
    await expect(page.getByRole("heading", { name: "Where will you wander?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Byblos" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Batroun" })).toBeVisible();
    await assertNoHorizontalScroll(page);
  });

  test("experience filters stay in the URL and listing detail offers the day plan", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/experiences?category=coast&sort=price&available=1");
    await expect(page).toHaveURL(/category=coast/);
    await expect(page).toHaveURL(/available=1/);
    await expect(page.getByRole("heading", { name: "A whole country. Your next discovery." })).toBeVisible();
    await expect(page.getByLabel("Price")).toBeVisible();
    await expect(page.getByLabel("Distance from Beirut")).toBeVisible();
    await page.goto("/experiences/slow-day-byblos");
    await expect(page.getByRole("heading", { name: "A slow day in Byblos" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add to a full-day plan" }).first()).toBeVisible();
    // Mshwar plans days; nothing on a place page reserves it.
    await expect(page.getByRole("link", { name: "Continue to checkout" })).toHaveCount(0);
    await expect(page.getByText("Estimated from", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Policies" })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Policies" }).getByText("Cancellation", { exact: true }),
    ).toBeVisible();
    await assertNoHorizontalScroll(page);
  });

  test("filters collapse on a phone and stay open on desktop", async ({ page }) => {
    // MSHWAR: the advanced filter rail is a toggle on phones so the listing
    // stays above the fold, but it must never be hidden on desktop.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/experiences?category=coast&sort=price&available=1");
    await expect(page.getByLabel("Price")).toBeHidden();
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(page.getByLabel("Price")).toBeVisible();
    await expect(page.getByLabel("Distance from Beirut")).toBeVisible();
    await assertNoHorizontalScroll(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/experiences?category=coast&sort=price&available=1");
    await expect(page.getByLabel("Price")).toBeVisible();
    await expect(page.getByLabel("Distance from Beirut")).toBeVisible();
  });

  test("discover hub and inspiration stay usable at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/discover");
    await expect(page.getByRole("heading", { name: "Find your kind of somewhere." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Attractions" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Restaurants" })).toBeVisible();
    await assertNoHorizontalScroll(page);
    await page.goto("/ideas");
    await expect(page.getByRole("heading", { name: "A little inspiration, ready to go." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore this day" }).first()).toBeVisible();
    await assertNoHorizontalScroll(page);
  });
});

async function mockHubApis(
  page: Page,
  data?: {
    trips?: object[];
    favorites?: object[];
    bookings?: object[];
    notifications?: object[];
  },
) {
  const empty = { items: [], page: 1, page_size: 6, total: 0 };
  await page.route("**/api/v1/trips**", async (route) => {
    const items = data?.trips ?? [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...empty, items, total: items.length }),
    });
  });
  await page.route("**/api/v1/favorites**", async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    const items = data?.favorites ?? [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...empty, items, total: items.length }),
    });
  });
  await page.route("**/api/v1/bookings**", async (route) => {
    if (route.request().url().includes("/cancel")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "book-1",
          listing_slug: "slow-day-byblos",
          business_id: 3,
          status: "cancelled",
          policy_summary: "Preview booking. Cancel requires a reason. Bookings are never deleted.",
          reason: "Change of dates",
          created_at: "2026-09-01T00:00:00Z",
        }),
      });
      return;
    }
    const items = data?.bookings ?? [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...empty, items, total: items.length }),
    });
  });
  await page.route("**/api/v1/notifications**", async (route) => {
    const items = data?.notifications ?? [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...empty, items, total: items.length }),
    });
  });
}

test.describe("MSHWAR-33 account hub", () => {
  test("unauthenticated hub routes return the user to sign-in", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/trips");
    await expect(page).toHaveURL(/\/signin\?next=/);
    await page.goto("/ar/favorites");
    await expect(page).toHaveURL(/\/ar\/signin\?next=/);
  });

  test("empty hub pages explain the section and stay usable at 390px", async ({ page }) => {
    await signInForShell(page);
    await mockHubApis(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/trips");
    await expect(page.getByRole("heading", { name: "Your trips" })).toBeVisible();
    await expect(page.getByText("No trips yet.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Plan a trip" }).last()).toBeVisible();
    await assertNoHorizontalScroll(page);

    await page.goto("/saved");
    await expect(page).toHaveURL(/\/favorites$/);
    await expect(page.getByRole("heading", { name: "Favorites" })).toBeVisible();
    await expect(page.getByText("Nothing saved yet.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore experiences" })).toBeVisible();
    await assertNoHorizontalScroll(page);

    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "Notifications" }).first()).toBeVisible();
    await expect(page.getByText("No notifications.")).toBeVisible();
    await assertNoHorizontalScroll(page);
  });
});

test.describe("MSHWAR-105 Arabic RTL MVP matrix", () => {
  for (const width of [390, 1440] as const) {
    for (const path of ["/", "/destinations", "/experiences", "/plan", "/ideas", "/contact"] as const) {
      test(`${path} stays RTL without overflow at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await page.goto(path === "/" ? "/ar" : `/ar${path}`);
        await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
        // Destinations (and other catalogue pages) can stream a second shell while
        // `loadDestinations()` waits on a down API. Assert the visible chrome.
        const shell = page.locator("[data-shell='traveller']").first();
        await expect(shell).toBeVisible();
        await expect(shell).toHaveAttribute("dir", "rtl");
        await assertNoHorizontalScroll(page);
      });
    }
  }
});

test.describe("MSHWAR-113 trust pages and cookie choices", () => {
  test("cookie banner appears once, refusing is one click [fresh visitor]", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const banner = page.getByRole("region", { name: "Cookies on Mshwar" });
    await expect(banner).toBeVisible();
    await assertNoHorizontalScroll(page);
    await banner.getByRole("button", { name: "Essential only" }).click();
    await expect(banner).toBeHidden();
    const cookies = await page.context().cookies();
    expect(cookies.find((cookie) => cookie.name === "mshwar-consent")?.value).toBe("v1.e0.m0");
    await page.reload();
    await expect(page.getByRole("region", { name: "Cookies on Mshwar" })).toBeHidden();
    await page.getByRole("button", { name: "Cookie settings" }).first().click();
    await expect(page.getByRole("switch", { name: "Error reporting" })).not.toBeChecked();
  });

  for (const path of ["/terms", "/privacy", "/cancellation-policy", "/community-guidelines"]) {
    test(`${path} is readable at 390px and 1440px`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Notice renders nested elements that both carry the text, so this resolves to two.
      await expect(page.getByText("Draft pending legal review", { exact: false }).first()).toBeVisible();
      await assertNoHorizontalScroll(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/ar${path}`);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await assertNoHorizontalScroll(page);
    });
  }

  test("sign-up asks for the terms and leaves optional consent unticked", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/signup");
    await expect(page.getByRole("checkbox", { name: /I agree to the/ })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: /personalise plans/ })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: /travel ideas and offers/ })).not.toBeChecked();
    await assertNoHorizontalScroll(page);
  });
});

async function mockLocalServices(page: Page) {
  const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  const trust = {
    level: "verified",
    checks: [{ kind: "public_licence", checked_on: "2026-09-01", valid_until: "2027-09-01", vehicle_plate: null }],
    in_person: { kind: "video_call", on: "2026-09-02" },
    approved_on: "2026-09-02",
  };
  const driver = {
    id: "d1",
    kind: "driver",
    slug: "georges",
    display_name: "Georges Haddad",
    headline: "Airport runs and the north coast",
    bio: "",
    languages: ["ar", "en", "fr"],
    regions: [],
    live: true,
    trust,
    photo_url: null,
    vehicles: [
      {
        id: "v1",
        plate: "P 123456",
        make: "Toyota",
        model: "Corolla",
        colour: "Grey",
        year: 2019,
        seats: 4,
        live: true,
      },
    ],
    rating: { average: 4.9, count: 21, completed_rides: 40 },
    day_rate_minor: 9000,
    airport_pickups: true,
  };
  await page.route("**/api/v1/rides/drivers**", (route) => route.fulfill(json([driver])));
  await page.route("**/api/v1/transport/destinations/**", (route) =>
    route.fulfill(
      json({
        destination: { slug: "byblos", name: "Byblos" },
        from_airport: [],
        from_beirut: [
          {
            id: "t1",
            scope: "between",
            mode: "service_taxi",
            line_name: "Dora – Jbeil service with a much longer operator name to test wrapping",
            from: { slug: "beirut", name: "Beirut" },
            to: { slug: "byblos", name: "Byblos" },
            pickup: { name: "Dora roundabout, under the bridge by the bus stop", lat: null, lng: null },
            dropoff: { name: "Jbeil old souk", lat: null, lng: null },
            fare: { basis: "person", low_minor: 200, high_minor: 300, currency: "USD" },
            duration: { min: 40, max: 60 },
            frequency_minutes: 15,
            first_departure: "06:00",
            last_departure: "20:00",
            runs_sunday: false,
            tips: { en: "Say Jbeil, not Byblos." },
            step_free: null,
            night_service: false,
            luggage_ok: true,
            safety_note: "",
            checked_on: "2026-09-10",
            review_by: "2026-12-09",
            live: true,
          },
        ],
        between: [],
        around: [],
      }),
    ),
  );
  await page.route("**/api/v1/exchange/destinations/**", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/venues/destinations/**", (route) =>
    route.fulfill(json({ restaurants: [], stays: [], targets: { restaurants: 5, stays: 3 } })),
  );
}

test.describe("V1–V6 local services", () => {
  test("a destination page shows checked transport and verified drivers without overflow", async ({ page }) => {
    await mockLocalServices(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/destinations/byblos");
    await expect(page.getByRole("heading", { name: "Getting there and around" })).toBeVisible();
    await expect(page.getByText("$2–$3 per person").first()).toBeVisible();
    await expect(page.getByText("Georges Haddad")).toBeVisible();
    await assertNoHorizontalScroll(page);
    await page.goto("/ar/destinations/byblos");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("Georges Haddad")).toBeVisible();
    await assertNoHorizontalScroll(page);
  });

  for (const width of [390, 1440] as const) {
    test(`the driver directory is usable at ${width}px`, async ({ page }) => {
      await mockLocalServices(page);
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto("/drivers");
      await expect(page.getByRole("heading", { name: "Verified drivers in Lebanon" })).toBeVisible();
      await expect(page.getByRole("link", { name: /See Georges Haddad/ })).toBeVisible();
      await assertNoHorizontalScroll(page);
    });
  }

  test("ride requests need an account; a shared ride link does not", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/rides/new?destination=byblos");
    await expect(page).toHaveURL(/\/signin\?next=/);
    await page.route("**/api/v1/rides/shared/**", (route) =>
      route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not found" }) }),
    );
    await page.goto("/rides/shared/expired-token");
    await expect(page).toHaveURL(/\/rides\/shared\/expired-token$/);
    await expect(page.getByText("This link has expired or was replaced.")).toBeVisible();
    await assertNoHorizontalScroll(page);
  });

  test("the driver and changer portals start from a plain introduction at 390px", async ({ page }) => {
    await signInForShell(page);
    const nothing = { status: 200, contentType: "application/json", body: "null" };
    await page.route("**/api/v1/partners/me/driver", (route) => route.fulfill(nothing));
    await page.route("**/api/v1/exchange/me", (route) => route.fulfill(nothing));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/drive");
    await expect(page.getByRole("heading", { name: "Drive travellers around Lebanon" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start my application" })).toBeVisible();
    await assertNoHorizontalScroll(page);
    await page.goto("/exchange");
    await expect(page.getByRole("heading", { name: "List your exchange" })).toBeVisible();
    await assertNoHorizontalScroll(page);
  });
});
