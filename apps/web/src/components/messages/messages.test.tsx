/// <reference types="vitest-axe/extend-expect" />
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationThread, MessagesInbox } from "./messages-view";
import { LocaleProvider } from "@/components/shell/locale-provider";
import type { Conversation } from "@/lib/guide-messages";
import { whatsappUrl } from "@/lib/tour-booking";

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, headers: new Headers(), statusText: "" };
}

const THREAD: Conversation = {
  id: "c1",
  role: "traveller",
  guide: { slug: "rami", display_name: "Rami Haddad" },
  traveller: { display_name: "Maya" },
  last_message_at: "2099-06-01T08:00:00Z",
  blocked: false,
  contact_open: false,
  unread: 1,
  last: "Sunday at 10 works.",
  messages: [
    {
      id: "m1",
      mine: true,
      body: "Call me on [shared after booking]",
      masked: true,
      created_at: "2099-06-01T07:00:00Z",
      read: true,
    },
    {
      id: "m2",
      mine: false,
      body: "Sunday at 10 works.",
      masked: false,
      created_at: "2099-06-01T08:00:00Z",
      read: false,
    },
  ],
};

function route(handlers: Record<string, unknown>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const method = init?.method ?? "GET";
      const key = Object.keys(handlers).find((pattern) => {
        const [verb, path] = pattern.includes(" ") ? pattern.split(" ") : ["", pattern];
        return (!verb || verb === method) && url.includes(path);
      });
      return key ? jsonResponse(handlers[key]) : jsonResponse({ detail: "not found" }, 404);
    }),
  );
  return calls;
}

describe("messages between travellers and guides", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists conversations with the unread count", async () => {
    route({ "/api/v1/guides/conversations": [{ ...THREAD, messages: null }] });
    const { container } = render(wrap(<MessagesInbox />));
    expect(await screen.findByText("Rami Haddad")).toBeTruthy();
    expect(screen.getByText("1 new")).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("says why details were hidden and sends a reply", async () => {
    const calls = route({
      "GET /api/v1/guides/conversations/c1": THREAD,
      "POST /messages": {
        ...THREAD,
        messages: [
          ...(THREAD.messages ?? []),
          { id: "m3", mine: true, body: "Great", masked: false, created_at: "2099-06-01T09:00:00Z", read: false },
        ],
      },
    });
    const { container } = render(wrap(<ConversationThread id="c1" />));
    expect(await screen.findByText(/Contact details were hidden/)).toBeTruthy();
    expect(screen.getByText(/hidden until you have a confirmed booking/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Write a message…"), { target: { value: "Great" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Great")).toBeTruthy();
    const post = calls.find((call) => call.init?.method === "POST");
    expect(JSON.parse(String(post?.init?.body))).toEqual({ body: "Great" });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("closes a conversation with a report", async () => {
    const calls = route({
      "GET /api/v1/guides/conversations/c1": THREAD,
      "POST /close": { ...THREAD, blocked: true },
    });
    render(wrap(<ConversationThread id="c1" />));
    fireEvent.click(await screen.findByRole("button", { name: "Report" }));
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "Rude" } });
    fireEvent.click(screen.getByRole("button", { name: "Report and block" }));
    expect(await screen.findByText("This conversation is closed.")).toBeTruthy();
    await waitFor(() =>
      expect(JSON.parse(String(calls.find((call) => call.url.includes("/close"))?.init?.body))).toEqual({
        report: true,
        reason: "Rude",
      }),
    );
  });

  it("turns a Lebanese number into a WhatsApp link", () => {
    expect(whatsappUrl("+961 70 123 456")).toBe("https://wa.me/96170123456");
    expect(whatsappUrl("70 123 456")).toBe("https://wa.me/96170123456");
    expect(whatsappUrl("123")).toBeNull();
  });
});
