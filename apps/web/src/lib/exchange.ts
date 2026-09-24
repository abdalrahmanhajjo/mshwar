import { apiRequest } from "@/lib/api/client";
import type { MyPartner, PartnerTrust } from "@/lib/partners";

/** Licensed money changers (V4). Mirrors services/api exchange.py. */
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export type OpeningHours = Partial<Record<Weekday, [string, string][]>>;

export type PostedRate = { base: "USD" | "EUR"; quote: "LBP"; buy: number; sell: number; posted_at: string };

export type Branch = {
  id: string;
  branch_name: string;
  address: string;
  lat: number;
  lng: number;
  destination: { slug: string; name: string };
  hours: OpeningHours;
  phone: string;
  checked_on: string | null;
  /** Only rates under 12 hours old, never held or rejected ones. */
  rates: PostedRate[];
  changer: {
    slug: string;
    display_name: string;
    languages: string[];
    bdl_number: string | null;
    category: "A" | "B" | null;
    legal_name: string | null;
    register_checked_on: string | null;
    trust: PartnerTrust;
  };
};

export type MyBranch = Branch & {
  active: boolean;
  verified: boolean;
  live: boolean;
  recent_rates: {
    id: string;
    base: "USD" | "EUR";
    buy: number;
    sell: number;
    posted_at: string;
    status: "live" | "held" | "rejected";
    held_reason: string;
  }[];
};

export type ChangerPortal = MyPartner & {
  licence: {
    bdl_number: string;
    category: "A" | "B";
    legal_name: string;
    register_status: "unchecked" | "matched" | "missing" | "category_changed";
    matched_on: string | null;
    rates_suspended_until: string | null;
  } | null;
  offices: MyBranch[];
};

export type BranchInput = {
  id?: string;
  branch_name: string;
  address: string;
  lat: number;
  lng: number;
  destination: string;
  hours: OpeningHours;
  phone?: string;
  active?: boolean;
};

export type ExchangeReportCategory = "rate_different" | "counterfeit" | "refused_receipt" | "conduct" | "other";

export type RegisterStatus = {
  latest: { id: string; published_on: string; source_url: string; loaded_at: string; entries: number } | null;
  overdue: boolean;
  held_rates: {
    id: string;
    base: string;
    buy: number;
    sell: number;
    posted_at: string;
    held_reason: string;
    office: string;
    changer: string;
  }[];
  licences: {
    partner_id: string;
    display_name: string;
    status: string;
    bdl_number: string;
    category: "A" | "B";
    register_status: string;
    matched_on: string | null;
    rates_suspended_until: string | null;
    offices:
      { id: string; branch_name: string; address: string; verified: boolean; verified_at: string | null }[] | null;
  }[];
};

export type RegisterDiff = {
  snapshot_id: string;
  entries: number;
  matched: number;
  missing: { partner_id: string; display_name: string; bdl_number: string }[];
  category_changed: { partner_id: string; display_name: string; bdl_number: string; listed_category: string }[];
};

export type RegisterEntry = { bdl_number: string; category: "A" | "B"; name?: string; address?: string };

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export function fetchDestinationChangers(slug: string) {
  return apiRequest<Branch[]>(`/api/v1/exchange/destinations/${encodeURIComponent(slug)}`);
}

export function reportExchange(officeId: string, category: ExchangeReportCategory, details: string) {
  return apiRequest<{ id: string; category: string; escalated: boolean }>(
    "/api/v1/exchange/reports",
    json("POST", { office_id: officeId, category, details }),
  );
}

export function fetchChangerPortal() {
  return apiRequest<ChangerPortal | null>("/api/v1/exchange/me");
}

export function saveLicence(input: { bdl_number: string; category: "A" | "B"; legal_name: string }) {
  return apiRequest<ChangerPortal>("/api/v1/exchange/me/licence", json("PUT", input));
}

export function saveBranch(input: BranchInput) {
  return apiRequest<ChangerPortal>("/api/v1/exchange/me/offices", json("PUT", input));
}

export function postRates(officeId: string, rates: { base: "USD" | "EUR"; buy: number; sell: number }[]) {
  return apiRequest<ChangerPortal>("/api/v1/exchange/me/rates", json("POST", { office_id: officeId, rates }));
}

// ---- Staff ------------------------------------------------------------------------------------

export function fetchRegisterStatus() {
  return apiRequest<RegisterStatus>("/api/v1/admin/exchange");
}

export function loadRegister(published_on: string, source_url: string, entries: RegisterEntry[]) {
  return apiRequest<RegisterDiff>(
    "/api/v1/admin/exchange/register",
    json("POST", { published_on, source_url, entries }),
  );
}

export function verifyBranch(officeId: string, kind: "visit" | "video_call", notes: string) {
  return apiRequest<MyBranch>(`/api/v1/admin/exchange/offices/${officeId}/verify`, json("POST", { kind, notes }));
}

export function decideRate(rateId: string, decision: "live" | "rejected") {
  return apiRequest<{ id: string; status: string }>(
    `/api/v1/admin/exchange/rates/${rateId}`,
    json("POST", { decision }),
  );
}

export function upholdExchangeReport(caseId: string) {
  return apiRequest<{ upheld: boolean; rates_paused: boolean }>(
    `/api/v1/admin/exchange/reports/${caseId}/uphold`,
    json("POST"),
  );
}

/**
 * Parse the BDL list as staff paste it: one institution per line, "number,category,name,address"
 * (commas or tabs). The first line may be a header. Rows without a number or an A/B category are
 * returned as errors rather than silently dropped.
 */
export function parseRegister(text: string): { entries: RegisterEntry[]; errors: number[] } {
  const entries: RegisterEntry[] = [];
  const errors: number[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) {
      return;
    }
    const cells = line.split(line.includes("\t") ? "\t" : ",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
    const [number = "", category = "", name = "", ...rest] = cells;
    if (index === 0 && !/\d/.test(number)) {
      return;
    }
    const cat = category.toUpperCase();
    if (!number || (cat !== "A" && cat !== "B")) {
      errors.push(index + 1);
      return;
    }
    entries.push({ bdl_number: number, category: cat, name, address: rest.join(", ") });
  });
  return { entries, errors };
}

/** Straight-line distance in metres, for sorting branches nearest first. */
export function distanceMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** A rate is fresh for 12 hours; the API never sends older ones, but a page can sit open. */
export function rateIsFresh(postedAt: string, now = Date.now()): boolean {
  return now - new Date(postedAt).getTime() < 12 * 60 * 60 * 1000;
}
