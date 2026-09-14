import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { ConsentControls, CookieChoices } from "./consent-controls";
import { analyticsAllowed } from "@/lib/security";

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
it("saves independent personalisation and marketing choices", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ personalisation: false, marketing: false }) });
  vi.stubGlobal("fetch", fetch);
  render(<LocaleProvider><ConsentControls /></LocaleProvider>);
  const personal = screen.getByRole("checkbox", { name: /saved preferences/i });
  await waitFor(() => expect(personal).toBeEnabled());
  expect(personal).not.toBeChecked(); expect(screen.getByRole("checkbox", { name: /marketing/i })).not.toBeChecked();
  fireEvent.click(personal); fireEvent.click(screen.getByRole("button", { name: "Save choices" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Choices saved"));
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ personalisation: true, marketing: false });
  fireEvent.click(personal); fireEvent.click(screen.getByRole("button", { name: "Save choices" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
  expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ personalisation: false, marketing: false });
});
it("keeps cookies essential and makes withdrawal available", async () => {
  render(<LocaleProvider><CookieChoices /></LocaleProvider>);
  expect(analyticsAllowed()).toBe(false);
  fireEvent.click(await screen.findByRole("button", { name: "Allow optional analytics" }));
  expect(analyticsAllowed()).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Change cookie choices" }));
  fireEvent.click(screen.getByRole("button", { name: "Essential only" }));
  expect(analyticsAllowed()).toBe(false);
});
