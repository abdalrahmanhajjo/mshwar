import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListingEditor } from "./listing-editor";
import { PortalProvider } from "./portal-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";

describe("listing editor", () => {
  it("flags coordinates outside Lebanon", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).endsWith("/portal/organizations")) {
          return {
            ok: true,
            json: async () => [
              {
                id: "org-1",
                name: "Cedar",
                slug: "cedar",
                status: "active",
                verification: "pending",
                role: "owner",
                public_contact: {},
                onboarding: { verification: "pending", can_publish: false, items: [] },
              },
            ],
          };
        }
        return { ok: true, json: async () => ({}) };
      }),
    );
    render(
      <LocaleProvider>
        <PortalProvider>
          <ListingEditor />
        </PortalProvider>
      </LocaleProvider>,
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Inside Lebanon"));
    fireEvent.click(screen.getByRole("button", { name: "weather-sensitive" }));
    expect(screen.getByText("Weather sensitivity")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("lng"), { target: { value: "2.3" } });
    fireEvent.change(screen.getByLabelText("lat"), { target: { value: "48.8" } });
    expect(screen.getByRole("status")).toHaveTextContent("outside Lebanon");
    vi.unstubAllGlobals();
  });
});
