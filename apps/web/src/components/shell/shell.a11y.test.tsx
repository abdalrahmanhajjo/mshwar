/// <reference types="vitest-axe/extend-expect" />
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { AdminShell, GuideShell, TravellerShell } from "./app-shell";
import { LocaleProvider } from "./locale-provider";
import { ShellPage } from "./shell-page";

async function expectAccessible(container: HTMLElement) {
  expect(await axe(container)).toHaveNoViolations();
}

describe("axe-core on app shells", () => {
  it("traveller shell", async () => {
    const { container } = render(
      <LocaleProvider>
        <TravellerShell currentPath="/">
          <ShellPage title="Discover" description="Home" />
        </TravellerShell>
      </LocaleProvider>,
    );
    await expectAccessible(container);
  });

  it("business and admin shells", async () => {
    const business = render(
      <LocaleProvider>
        <GuideShell currentPath="/guide">
          <ShellPage title="Dashboard" description="Biz" />
        </GuideShell>
      </LocaleProvider>,
    );
    await expectAccessible(business.container);
    business.unmount();

    const admin = render(
      <LocaleProvider>
        <AdminShell currentPath="/admin">
          <ShellPage title="Overview" description="Ops" />
        </AdminShell>
      </LocaleProvider>,
    );
    await expectAccessible(admin.container);
  });

  it("arabic traveller snapshot", async () => {
    const { container } = render(
      <LocaleProvider initialLocale="ar">
        <TravellerShell currentPath="/">
          <ShellPage title="اكتشف" description="الصفحة الرئيسية" />
        </TravellerShell>
      </LocaleProvider>,
    );
    await expectAccessible(container);
  });
});
