import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminShell, BusinessShell, TravellerShell } from "./app-shell";
import { LocaleProvider } from "./locale-provider";
import { ShellPage } from "./shell-page";

function renderTraveller() {
  return render(
    <LocaleProvider>
      <TravellerShell currentPath="/">
        <ShellPage title="Discover Lebanon" description="Home" />
      </TravellerShell>
    </LocaleProvider>,
  );
}

describe("responsive app shells", () => {
  it("shares primitives but differs in navigation", () => {
    const { unmount } = renderTraveller();
    expect(screen.getByRole("navigation", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Discover" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Listings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Moderation" })).not.toBeInTheDocument();
    unmount();

    render(
      <LocaleProvider>
        <BusinessShell currentPath="/business">
          <ShellPage title="Dashboard" description="Biz" />
        </BusinessShell>
      </LocaleProvider>,
    );
    expect(screen.getAllByRole("link", { name: "Listings" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Discover" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Moderation" })).not.toBeInTheDocument();
  });

  it("renders the admin console with operator navigation", () => {
    render(
      <LocaleProvider>
        <AdminShell currentPath="/admin" auth={{ status: "signed-in", name: "Operator" }}>
          <ShellPage title="Overview" description="Ops" />
        </AdminShell>
      </LocaleProvider>,
    );
    expect(screen.getAllByRole("link", { name: "Moderation" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Operator")).toBeInTheDocument();
    expect(document.querySelector("[data-shell='admin']")).toBeTruthy();
  });

  it("collapses navigation behind a menu control on the mobile pattern", () => {
    renderTraveller();
    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle.closest("div")).toHaveClass("lg:hidden");
    fireEvent.click(toggle);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("link", { name: "Plan a trip" })).toBeInTheDocument();
  });

  it("flips document direction from the language switcher without a reload", () => {
    const hrefBefore = window.location.href;
    renderTraveller();
    expect(document.documentElement.dir).toBe("ltr");
    fireEvent.click(screen.getAllByRole("button", { name: "العربية" })[0]);
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.getAttribute("data-locale")).toBe("ar");
    expect(screen.getByRole("button", { name: "فتح القائمة" })).toBeInTheDocument();
    expect(window.location.href).toBe(hrefBefore);
  });

  it("keeps the shell inside 390px and 1440px frames without overflow classes", () => {
    const { container } = renderTraveller();
    const shell = container.querySelector("[data-shell='traveller']");
    expect(shell).toHaveClass("max-w-full", "min-w-0");
    expect(container.querySelector(".shell-frame")).toBeTruthy();
  });
});
