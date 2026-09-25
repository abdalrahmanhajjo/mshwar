import { apiRequest } from "@/lib/api/client";
import type { Experience } from "@/lib/catalog";

/** Checked restaurants and places to stay (V5, V6). Mirrors services/api venues.py. */
export type VerifiedLevel = "licensed_claimed" | "checked_by_mshwar";
export type StayType = "hotel" | "guesthouse" | "hostel" | "apartment";
export type ListingKind = "experience" | "attraction" | "restaurant" | "hotel";

export type ListingDetails = {
  cuisines?: string[];
  price_level?: number | null;
  reservation_phone?: string;
  reservation_whatsapp?: string;
  reservation_url?: string;
  stay_type?: StayType | null;
  stars?: number | null;
  rooms?: number | null;
  check_in?: string | null;
  check_out?: string | null;
  price_from_minor?: number | null;
  currency?: string;
  booking_url?: string;
  accepts_requests?: boolean;
  amenities?: string[];
  accessibility?: string[];
};

export type VenueVerification = {
  level: VerifiedLevel | null;
  checked_on: string | null;
  review_by: string | null;
  licence: { number: string; authority: string; expires_on: string | null } | null;
  claimed: boolean;
};

/** The raw catalogue card (snake_case, as the API sends it) plus details and checks. */
export type VenueCard = {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  image?: string | null;
  image_alt?: string | null;
  place_label?: string;
  destination_slug?: string;
  lat?: number | null;
  lng?: number | null;
  kind?: ListingKind;
  details: ListingDetails;
  verification: VenueVerification;
  distance_m?: number;
};

export type EatAndStay = {
  restaurants: VenueCard[];
  stays: VenueCard[];
  targets: { restaurants: number; stays: number };
};

export type PortalListingDetails = {
  listing_kind: ListingKind;
  licence_number: string;
  licence_authority: string;
  licence_expires_on: string | null;
  verification: { level: VerifiedLevel | null; checked_on: string | null; review_by: string | null };
  checked: boolean;
  details: ListingDetails;
};

export type ListingDetailsInput = ListingDetails & {
  listing_kind: ListingKind;
  licence_number?: string;
  licence_authority?: string;
  licence_expires_on?: string | null;
};

export type AdminVenue = VenueCard & {
  checked: boolean;
  check_notes: string;
  owner: string;
  destination: string;
  licence_number: string;
  licence_authority: string;
  licence_expires_on: string | null;
};

export type ListingClaim = {
  id: string;
  note: string;
  created_at: string;
  organization: { id: string; name: string; verification: string };
  experience: { id: string; slug: string; title: string };
};

export type Coverage = {
  targets: { restaurants: number; stays: number };
  destinations: {
    slug: string;
    name: string;
    restaurants: number;
    stays: number;
    transport_cards: number;
    drivers: number;
    changers: number;
  }[];
};

export type CheckedVenueInput = {
  listing_kind: "restaurant" | "hotel";
  name: string;
  description: string;
  destination: string;
  address?: string;
  lat: number;
  lng: number;
  notes: string;
  cuisines?: string[];
  price_level?: number | null;
  reservation_phone?: string;
  stay_type?: StayType | null;
  stars?: number | null;
  price_from_minor?: number | null;
  booking_url?: string;
  amenities?: string[];
};

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export function fetchEatAndStay(slug: string) {
  return apiRequest<EatAndStay>(`/api/v1/venues/destinations/${encodeURIComponent(slug)}`);
}

export function fetchVenuesNear(kind: "restaurant" | "hotel", lat: number, lng: number, radius = 15000) {
  const params = new URLSearchParams({ kind, lat: String(lat), lng: String(lng), radius: String(radius) });
  return apiRequest<VenueCard[]>(`/api/v1/venues/near?${params.toString()}`);
}

export function fetchListingDetails(orgId: string, experienceId: string) {
  return apiRequest<PortalListingDetails>(`/api/v1/venues/portal/${orgId}/listings/${experienceId}`);
}

export function saveListingDetails(orgId: string, experienceId: string, input: ListingDetailsInput) {
  return apiRequest<VenueCard & { checked: boolean }>(
    `/api/v1/venues/portal/${orgId}/listings/${experienceId}`,
    json("PUT", input),
  );
}

// ---- Kinds of place (trip builder v2, migration 045) ------------------------------------------

export type PlaceRole = "meal" | "sight" | "activity" | "stay" | "service";
export type MealService = "breakfast" | "brunch" | "lunch" | "dinner" | "late";
export type PlaceGroup =
  | "food"
  | "stay"
  | "nature"
  | "heritage"
  | "entertainment"
  | "sport"
  | "wellness"
  | "shopping"
  | "family"
  | "events"
  | "essentials";

export type PlaceType = {
  slug: string;
  group: PlaceGroup;
  role: PlaceRole;
  names: Record<"en" | "ar" | "fr", string>;
  default_minutes: number;
  meal_services: MealService[];
  season_months: number[] | null;
  needs_schedule: boolean;
};

export type ListingPlaceTypes = {
  place_types: string[];
  roles: PlaceRole[];
  meal_services: MealService[];
  schedule_note: string;
};

export type PlaceTypesInput = {
  place_types: string[];
  meal_services?: MealService[];
  schedule_note?: string;
};

/** Which roles a listing of this kind may take: a meal or a night is always a checked restaurant or stay. */
export function rolesForKind(kind: ListingKind): PlaceRole[] {
  if (kind === "restaurant") return ["meal"];
  if (kind === "hotel") return ["stay"];
  return ["sight", "activity", "service"];
}

export function fetchPlaceTypes() {
  return apiRequest<PlaceType[]>("/api/v1/venues/place-types");
}

export function fetchListingPlaceTypes(orgId: string, experienceId: string) {
  return apiRequest<ListingPlaceTypes>(`/api/v1/venues/portal/${orgId}/listings/${experienceId}/place-types`);
}

export function saveListingPlaceTypes(orgId: string, experienceId: string, input: PlaceTypesInput) {
  return apiRequest<ListingPlaceTypes>(
    `/api/v1/venues/portal/${orgId}/listings/${experienceId}/place-types`,
    json("PUT", input),
  );
}

export function fetchClaims(orgId: string) {
  return apiRequest<
    {
      id: string;
      status: "pending" | "approved" | "rejected";
      reason: string;
      created_at: string;
      experience: { slug: string; title: string };
    }[]
  >(`/api/v1/venues/portal/${orgId}/claims`);
}

export function claimListing(orgId: string, slug: string, note: string) {
  return apiRequest<{ id: string; status: string }>(
    `/api/v1/venues/portal/${orgId}/claims`,
    json("POST", { slug, note }),
  );
}

// ---- Staff ------------------------------------------------------------------------------------

export function fetchAdminVenues(filter: { destination?: string; kind?: "restaurant" | "hotel"; due?: boolean } = {}) {
  const params = new URLSearchParams();
  if (filter.destination) params.set("destination", filter.destination);
  if (filter.kind) params.set("kind", filter.kind);
  if (filter.due) params.set("due", "true");
  const query = params.toString();
  return apiRequest<{ venues: AdminVenue[]; claims: ListingClaim[] }>(
    `/api/v1/admin/venues${query ? `?${query}` : ""}`,
  );
}

export function addCheckedVenue(input: CheckedVenueInput) {
  return apiRequest<VenueCard & { checked: boolean }>("/api/v1/admin/venues", json("POST", input));
}

export function checkVenue(experienceId: string, level: VerifiedLevel, notes: string, checkedOn?: string) {
  return apiRequest<VenueCard & { checked: boolean }>(
    `/api/v1/admin/venues/${experienceId}/check`,
    json("POST", { level, notes, checked_on: checkedOn ?? null }),
  );
}

export function decideClaim(claimId: string, decision: "approved" | "rejected", reason = "") {
  return apiRequest<{ id: string; status: string }>(
    `/api/v1/admin/venues/claims/${claimId}`,
    json("POST", { decision, reason }),
  );
}

export function fetchCoverage() {
  return apiRequest<Coverage>("/api/v1/admin/coverage");
}

export type { Experience };
