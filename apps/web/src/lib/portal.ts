import { securityFetch } from "@/lib/security";
export const ORG_STORAGE_KEY = "mshwar-active-org";
export const ORG_HEADER = "x-organization-id";

export const LEBANON = {
  lngMin: 35.103,
  lngMax: 36.623,
  latMin: 33.047,
  latMax: 34.692,
  beirut: { lng: 35.5018, lat: 33.8938 },
};

export type PortalRole = "owner" | "manager" | "inventory" | "bookings" | "finance" | "admin";
export type PortalCapability = "listings" | "bookings" | "finance" | "settings" | "team";

export type Contact = {
  name?: string;
  email?: string;
  phone?: string;
};

export type ChecklistItem = {
  key: string;
  done: boolean;
};

export type Onboarding = {
  verification: string;
  can_publish: boolean;
  items: ChecklistItem[];
};

export type PortalOrganization = {
  id: string;
  name: string;
  slug: string;
  status: string;
  verification: string;
  role: PortalRole;
  public_contact: Contact;
  internal_contact?: Contact | null;
  fulfilment_instructions?: string | null;
  onboarding: Onboarding;
};

export type PublishIssue = {
  code: string;
  message: string;
};

export type PublishReport = {
  ready: boolean;
  issues: PublishIssue[];
  verification: string;
};

export type PortalExperience = {
  id: string;
  organization_id: string;
  venue_id: string;
  slug: string;
  title: string;
  description: string;
  status: "draft" | "published" | "paused" | "archived";
  booking_mode: string;
  duration_minutes: number;
  min_party: number;
  max_party: number;
  setting: string;
  intensity: number | null;
  weather_rules: Record<string, unknown>;
  category?: string | null;
  suitability: string[];
  weather: string[];
  weather_sensitivity?: string;
  images: { id: string; object_key: string; alt_text: string }[];
  venue?: { id: string; name: string; address: string; lng: number; lat: number };
  price?: { currency: string; price_type: string; unit: string; amount_minor: number | null } | null;
  policy?: { version: number; terms_text: string } | null;
  publish_report: PublishReport;
};

export type PortalBooking = {
  id: string;
  status: string;
  party_size: number;
  traveller_note: string;
  experience_id: string;
  experience_title: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  reserved: number;
  remaining: number;
  total_minor: number;
  currency: string;
};

export type PortalMetrics = {
  from: string;
  to: string;
  comparison_from: string;
  comparison_to: string;
  current: Record<string, number>;
  previous: Record<string, number>;
};

export type StaffPayload = {
  members: { user_id: string; email: string; display_name: string; role: string; active: boolean }[];
  invitations: {
    id: string;
    email: string;
    role: string;
    expires_at: string;
    accepted_at: string | null;
    revoked_at: string | null;
  }[];
};

const ROLE_CAPABILITIES: Record<PortalCapability, PortalRole[]> = {
  listings: ["owner", "manager", "inventory"],
  bookings: ["owner", "manager", "bookings"],
  finance: ["owner", "manager", "finance"],
  settings: ["owner", "manager"],
  team: ["owner", "manager"],
};

export function can(role: PortalRole | undefined, capability: PortalCapability): boolean {
  if (!role) {
    return false;
  }
  if (role === "admin") {
    return true;
  }
  return ROLE_CAPABILITIES[capability].includes(role);
}

export function pointInLebanon(lng: number, lat: number): boolean {
  return lng >= LEBANON.lngMin && lng <= LEBANON.lngMax && lat >= LEBANON.latMin && lat <= LEBANON.latMax;
}

export function readActiveOrgId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ORG_STORAGE_KEY);
}

export function writeActiveOrgId(orgId: string): void {
  window.localStorage.setItem(ORG_STORAGE_KEY, orgId);
}

async function portalFetch<T>(path: string, init: RequestInit = {}, orgId?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const org = orgId ?? readActiveOrgId();
  if (org) {
    headers.set(ORG_HEADER, org);
  }
  const response = await securityFetch(path, { ...init, credentials: "include", headers });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const contentType = response.headers?.get("content-type") ?? "";
  if (contentType.includes("text/csv")) {
    return (await response.text()) as T;
  }
  return (await response.json()) as T;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    if (typeof body.detail === "string") {
      return body.detail;
    }
  } catch {
    /* ignore */
  }
  return "request-failed";
}

export function listOrganizations(): Promise<PortalOrganization[]> {
  return portalFetch("/api/v1/portal/organizations");
}

export function createOrganization(name: string): Promise<PortalOrganization> {
  return portalFetch("/api/v1/portal/organizations", { method: "POST", body: JSON.stringify({ name }) });
}

export function getOrganization(orgId: string): Promise<PortalOrganization> {
  return portalFetch(`/api/v1/portal/organizations/${orgId}`, {}, orgId);
}

export function updateContacts(
  orgId: string,
  payload: {
    name?: string;
    public_contact?: Contact;
    internal_contact?: Contact;
    fulfilment_instructions?: string;
  },
): Promise<PortalOrganization> {
  return portalFetch(
    `/api/v1/portal/organizations/${orgId}/contacts`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    orgId,
  );
}

export function submitVerification(
  orgId: string,
  payload: { legal_name: string; registration_number: string },
): Promise<unknown> {
  return portalFetch(
    `/api/v1/portal/organizations/${orgId}/verification`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    orgId,
  );
}

export function uploadPortalFile(
  orgId: string,
  payload: {
    filename: string;
    content_type: string;
    content_base64: string;
    purpose: "verification" | "listing";
    experience_id?: string;
    alt_text?: string;
  },
): Promise<unknown> {
  return portalFetch(
    `/api/v1/portal/organizations/${orgId}/files`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    orgId,
  );
}

export function listExperiences(orgId: string): Promise<PortalExperience[]> {
  return portalFetch(`/api/v1/portal/organizations/${orgId}/experiences`, {}, orgId);
}

export function getExperience(orgId: string, experienceId: string): Promise<PortalExperience> {
  return portalFetch(`/api/v1/portal/organizations/${orgId}/experiences/${experienceId}`, {}, orgId);
}

export function saveExperience(orgId: string, payload: Record<string, unknown>): Promise<PortalExperience> {
  return portalFetch(
    `/api/v1/portal/organizations/${orgId}/experiences`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    orgId,
  );
}

export function setExperienceStatus(orgId: string, experienceId: string, status: string): Promise<PortalExperience> {
  return portalFetch(
    `/api/v1/portal/organizations/${orgId}/experiences/${experienceId}/status`,
    {
      method: "POST",
      body: JSON.stringify({ status }),
    },
    orgId,
  );
}

export function publishExperience(orgId: string, experienceId: string): Promise<PortalExperience> {
  return portalFetch(
    `/api/v1/portal/organizations/${orgId}/experiences/${experienceId}/publish`,
    {
      method: "POST",
    },
    orgId,
  );
}

export function upsertVenue(
  orgId: string,
  payload: { name: string; address: string; lng: number; lat: number; id?: string },
): Promise<{ id: string; lng: number; lat: number }> {
  return portalFetch(
    `/api/v1/portal/organizations/${orgId}/venues`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    orgId,
  );
}

export function listBookings(orgId: string, query = ""): Promise<PortalBooking[]> {
  return portalFetch(`/api/v1/portal/organizations/${orgId}/bookings${query}`, {}, orgId);
}

export function respondBooking(
  orgId: string,
  bookingId: string,
  payload: { status: string; reason: string; message?: string },
): Promise<PortalBooking> {
  return portalFetch(
    `/api/v1/portal/organizations/${orgId}/bookings/${bookingId}/respond`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    orgId,
  );
}

export function getMetrics(orgId: string, from?: string, to?: string): Promise<PortalMetrics> {
  const params = new URLSearchParams();
  if (from) {
    params.set("from", from);
  }
  if (to) {
    params.set("to", to);
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return portalFetch(`/api/v1/portal/organizations/${orgId}/metrics${suffix}`, {}, orgId);
}

export function listStaff(orgId: string): Promise<StaffPayload> {
  return portalFetch(`/api/v1/portal/organizations/${orgId}/staff`, {}, orgId);
}

export function inviteStaff(orgId: string, email: string, role: string): Promise<unknown> {
  return portalFetch(
    `/api/v1/portal/organizations/${orgId}/staff/invitations`,
    {
      method: "POST",
      body: JSON.stringify({ email, role }),
    },
    orgId,
  );
}

export function revokeInvite(orgId: string, inviteId: string): Promise<{ ok: boolean }> {
  return portalFetch(
    `/api/v1/portal/organizations/${orgId}/staff/invitations/${inviteId}/revoke`,
    {
      method: "POST",
    },
    orgId,
  );
}

export function acceptInvite(token: string): Promise<PortalOrganization> {
  return portalFetch("/api/v1/portal/invitations/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function replaceHours(orgId: string, payload: unknown): Promise<unknown> {
  return portalFetch(
    `/api/v1/portal/organizations/${orgId}/opening-hours`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    orgId,
  );
}

export function generateSlots(orgId: string, payload: unknown): Promise<unknown> {
  return portalFetch(
    `/api/v1/portal/organizations/${orgId}/slots/generate`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    orgId,
  );
}

export function createOpeningException(orgId: string, payload: unknown): Promise<unknown> {
  return portalFetch(
    `/api/v1/portal/organizations/${orgId}/opening-exceptions`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    orgId,
  );
}

export function createBlackout(orgId: string, payload: unknown): Promise<unknown> {
  return portalFetch(
    `/api/v1/portal/organizations/${orgId}/blackouts`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    orgId,
  );
}

export function getAvailability(
  orgId: string,
  experienceId: string,
): Promise<{
  hours: unknown[];
  exceptions: unknown[];
  blackouts: { id: string; start: string; end: string; reason: string }[];
  slots: { id: string; starts_at: string; capacity: number; remaining: number; blacked_out: boolean }[];
}> {
  return portalFetch(`/api/v1/portal/organizations/${orgId}/experiences/${experienceId}/availability`, {}, orgId);
}

export function listAdminOrganizations(): Promise<
  {
    id: string;
    name: string;
    slug: string;
    verification: string;
    paused_experiences: number;
    published_experiences: number;
  }[]
> {
  return portalFetch("/api/v1/admin/organizations");
}

export function adminVerify(
  orgId: string,
  reason: string,
  action: "verify" | "reject" | "revoke" = "verify",
): Promise<unknown> {
  return portalFetch(`/api/v1/admin/organizations/${orgId}/${action}`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function bookingsToCsv(rows: PortalBooking[]): string {
  const header = [
    "id",
    "status",
    "party_size",
    "experience_title",
    "starts_at",
    "remaining",
    "capacity",
    "traveller_note",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      header.map((key) => `"${String(row[key as keyof PortalBooking] ?? "").replaceAll('"', '""')}"`).join(","),
    );
  }
  return lines.join("\n");
}

export function filterBookings(
  rows: PortalBooking[],
  filters: { status?: string; experienceId?: string; query?: string },
): PortalBooking[] {
  return rows.filter((row) => {
    if (filters.status && row.status !== filters.status) {
      return false;
    }
    if (filters.experienceId && row.experience_id !== filters.experienceId) {
      return false;
    }
    if (
      filters.query &&
      !`${row.experience_title} ${row.traveller_note}`.toLowerCase().includes(filters.query.toLowerCase())
    ) {
      return false;
    }
    return true;
  });
}

export function metricDelta(current: number, previous: number): number {
  return current - previous;
}

export function metricsToCsv(metrics: PortalMetrics): string {
  const header = ["metric", "current", "previous", "from", "to", "comparison_from", "comparison_to"];
  const keys = ["views", "saves", "itinerary_inclusions", "requests", "confirmations", "revenue_minor"] as const;
  const lines = [header.join(",")];
  for (const key of keys) {
    lines.push(
      [
        key,
        metrics.current[key] ?? 0,
        metrics.previous[key] ?? 0,
        metrics.from,
        metrics.to,
        metrics.comparison_from,
        metrics.comparison_to,
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? (result.split(",")[1] ?? "") : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
