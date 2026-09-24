import { ApiError, apiRequest } from "@/lib/api/client";

/** Drivers and money changers: one trust framework (V1). Mirrors services/api partners.py. */
export type PartnerKind = "driver" | "changer";
export type PartnerStatus = "draft" | "submitted" | "approved" | "rejected" | "suspended";
export type TrustLevel = "verified" | "lapsed" | "pending" | "none";
export type PartnerDocumentKind =
  | "id"
  | "selfie"
  | "profile_photo"
  | "public_licence"
  | "judicial_record"
  | "vehicle_registration"
  | "insurance"
  | "inspection"
  | "plate_rental"
  | "bdl_registration"
  | "commercial_register"
  | "storefront_photo";

/** Faces and shop fronts must be photos; the rest may be PDFs too. */
export const PHOTO_DOCUMENTS: ReadonlySet<PartnerDocumentKind> = new Set([
  "selfie",
  "profile_photo",
  "storefront_photo",
]);

export type TrustCheck = {
  kind: PartnerDocumentKind;
  checked_on: string | null;
  valid_until: string | null;
  vehicle_plate: string | null;
};

/** "What we checked": derived in the database, never a stored tick. */
export type PartnerTrust = {
  level: TrustLevel;
  checks: TrustCheck[];
  in_person: { kind: "video_call" | "visit" | "recheck"; on: string } | null;
  approved_on: string | null;
};

export type Vehicle = {
  id: string;
  plate: string;
  make: string;
  model: string;
  colour: string;
  year: number | null;
  seats: number;
  live: boolean;
  plate_rented?: boolean;
  active?: boolean;
  required_documents?: PartnerDocumentKind[];
};

export type PartnerDocument = {
  id: string;
  kind: PartnerDocumentKind;
  vehicle_id: string | null;
  office_id?: string | null;
  reference: string;
  issuer: string;
  issued_on: string | null;
  expires_on: string | null;
  verification: "pending" | "verified" | "rejected";
  reason: string;
  valid: boolean;
  lapses_on: string | null;
};

export type Requirement = {
  kind: PartnerDocumentKind;
  scope: "partner" | "vehicle" | "office";
  needs_expiry: boolean;
  valid_days: number | null;
  fresh_days: number | null;
};

export type SecurityStatus = {
  phone: string | null;
  phone_verified: boolean;
  totp_enabled: boolean;
  totp_pending: boolean;
};

export type PublicPartner = {
  id: string;
  kind: PartnerKind;
  slug: string;
  display_name: string;
  headline: string;
  bio: string;
  languages: string[];
  regions: string[];
  live: boolean;
  trust: PartnerTrust;
  photo_url: string | null;
  vehicles: Vehicle[];
};

export type MyPartner = PublicPartner & {
  status: PartnerStatus;
  submitted_at: string | null;
  decided_at: string | null;
  decision_reason: string;
  trust_level: TrustLevel;
  requirements: Requirement[];
  missing: { kind: PartnerDocumentKind; vehicle_id?: string; plate?: string; office_id?: string; branch?: string }[];
  agreement: { current: string; accepted: string | null };
  security: SecurityStatus;
  documents: PartnerDocument[];
};

export type PartnerProfileInput = {
  display_name: string;
  headline?: string;
  bio?: string;
  languages?: string[];
  regions?: string[];
};

export type VehicleInput = {
  id?: string;
  plate: string;
  plate_rented?: boolean;
  make: string;
  model: string;
  colour: string;
  year?: number | null;
  seats: number;
  active?: boolean;
};

export type DocumentUploadInput = {
  kind: PartnerDocumentKind;
  filename: string;
  content_type: string;
  content_base64: string;
  vehicle_id?: string | null;
  office_id?: string | null;
  reference?: string;
  issuer?: string;
  issued_on?: string | null;
  expires_on?: string | null;
};

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

/** The API refuses sensitive changes on a live account until a fresh authenticator code is given. */
export function isStepUpError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 422 && error.message.startsWith("step-up required");
}

// ---- Security ------------------------------------------------------------------------------

export function fetchSecurity() {
  return apiRequest<SecurityStatus>("/api/v1/partners/security");
}

export function startPhoneCheck(phone: string) {
  return apiRequest<{ sent_to: string; expires_in_seconds: number }>(
    "/api/v1/partners/security/phone",
    json("POST", { phone }),
  );
}

export function confirmPhone(code: string) {
  return apiRequest<SecurityStatus & { ok: boolean }>(
    "/api/v1/partners/security/phone/confirm",
    json("POST", { code }),
  );
}

export function beginAuthenticator() {
  return apiRequest<{ secret: string; otpauth_uri: string }>("/api/v1/partners/security/totp", json("POST"));
}

export function confirmAuthenticator(code: string) {
  return apiRequest<SecurityStatus>("/api/v1/partners/security/totp/confirm", json("POST", { code }));
}

export function stepUp(code: string) {
  return apiRequest<{ valid_until: string }>("/api/v1/partners/security/step-up", json("POST", { code }));
}

// ---- Application -----------------------------------------------------------------------------

export function fetchMyPartner(kind: PartnerKind) {
  return apiRequest<MyPartner | null>(`/api/v1/partners/me/${kind}`);
}

export function savePartnerProfile(kind: PartnerKind, input: PartnerProfileInput) {
  return apiRequest<MyPartner>(`/api/v1/partners/me/${kind}`, json("PUT", input));
}

export function saveVehicle(input: VehicleInput) {
  return apiRequest<MyPartner>("/api/v1/partners/me/driver/vehicles", json("PUT", input));
}

export function uploadPartnerDocument(kind: PartnerKind, input: DocumentUploadInput) {
  return apiRequest<MyPartner>(`/api/v1/partners/me/${kind}/documents`, json("POST", input));
}

export function acceptPartnerAgreement(kind: PartnerKind, version: string) {
  return apiRequest<MyPartner>(`/api/v1/partners/me/${kind}/agreement`, json("PUT", { version }));
}

export function submitPartnerApplication(kind: PartnerKind) {
  return apiRequest<MyPartner>(`/api/v1/partners/me/${kind}/submit`, json("POST"));
}

export function fetchPublicPartner(slug: string) {
  return apiRequest<PublicPartner>(`/api/v1/partners/public/${encodeURIComponent(slug)}`);
}

/** Normalise what a driver types into the red-plate form the API stores ("P 123456"). */
export function normalisePlate(value: string): string {
  const compact = value.replace(/[\s-]+/g, "").toUpperCase();
  return /^P\d{1,7}$/.test(compact) ? `P ${compact.slice(1)}` : value.trim().toUpperCase();
}

/** Documents a partner still owes, in the order the requirements list them. */
export function outstanding(partner: MyPartner): MyPartner["missing"] {
  return partner.missing;
}
