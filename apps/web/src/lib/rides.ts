import { apiRequest } from "@/lib/api/client";
import type { PublicPartner, Vehicle } from "@/lib/partners";

/** Booking a verified driver (V3). Mirrors services/api rides.py. */
export type RideKind = "ride" | "day" | "airport";
export type RideState = "confirmed" | "completed" | "cancelled_by_traveller" | "cancelled_by_driver" | "no_show";
export type RequestStatus = "open" | "booked" | "cancelled" | "expired";
export type RideReportCategory =
  "safety" | "wrong_driver" | "wrong_plate" | "unsafe_vehicle" | "overcharge" | "no_show" | "conduct" | "other";

export type DriverCard = PublicPartner & {
  rating: { average: number | null; count: number; completed_rides: number };
  day_rate_minor: number | null;
  airport_pickups: boolean;
};

export type DriverPage = DriverCard & { reviews: { rating: number; body: string; at: string }[] };

export type Place = { name: string; lat: number | null; lng: number | null };

export type Quote = {
  id: string;
  price_minor: number;
  currency: string;
  note: string;
  status: "offered" | "accepted" | "withdrawn" | "declined" | "expired";
  created_at: string;
  vehicle: Vehicle;
  driver: DriverCard;
};

export type RideRequest = {
  id: string;
  kind: RideKind;
  status: RequestStatus;
  destination: { slug: string; name: string };
  pickup: Place;
  dropoff: Place;
  starts_at: string;
  hours: number | null;
  party_size: number;
  luggage: number;
  flight_number: string;
  notes: string;
  expires_at: string;
  trip_id: string | null;
  created_at: string;
  ride_id: string | null;
  quotes?: Quote[];
};

export type DriverInboxItem = RideRequest & {
  my_quote: { id: string; price_minor: number; currency: string; status: Quote["status"]; note: string } | null;
  quotes_so_far: number;
};

export type ReviewPair = {
  mine: { rating: number; body: string } | null;
  theirs: { rating: number; body: string } | null;
  can_write: boolean;
};

export type Ride = {
  id: string;
  state: RideState;
  price_minor: number;
  currency: string;
  request: RideRequest;
  vehicle: Vehicle;
  driver: DriverCard;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string;
  created_at: string;
  reviews: ReviewPair;
  viewer?: "traveller" | "driver";
  /** Traveller view, while booked: the driver's verified phone. */
  driver_phone?: string | null;
  /** Driver view: who they are picking up. */
  traveller?: { display_name: string; phone: string | null };
  /** Returned once, when the ride is booked or the link is renewed. */
  share_token?: string;
};

export type RideRequestDetail = RideRequest & { quotes: Quote[]; ride: Ride | null };

export type SharedRide = {
  state: RideState;
  starts_at: string;
  kind: RideKind;
  pickup: string;
  dropoff: string;
  driver: { display_name: string; photo_url: string | null; trust_level: string };
  vehicle: { plate: string; make: string; model: string; colour: string };
};

export type RideRequestInput = {
  kind: RideKind;
  destination: string;
  trip_id?: string | null;
  pickup_name: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_name?: string;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  starts_at: string;
  hours?: number | null;
  party_size: number;
  luggage?: number;
  flight_number?: string;
  notes?: string;
};

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export function fetchDrivers(destination?: string) {
  const query = destination ? `?destination=${encodeURIComponent(destination)}` : "";
  return apiRequest<DriverCard[]>(`/api/v1/rides/drivers${query}`);
}

export function fetchDriverPage(slug: string) {
  return apiRequest<DriverPage>(`/api/v1/rides/drivers/${encodeURIComponent(slug)}`);
}

export function fetchSharedRide(token: string) {
  return apiRequest<SharedRide>(`/api/v1/rides/shared/${encodeURIComponent(token)}`);
}

export function requestRide(input: RideRequestInput) {
  return apiRequest<RideRequest>("/api/v1/rides/requests", json("POST", input));
}

export function fetchMyRides() {
  return apiRequest<{ requests: RideRequest[]; rides: Ride[] }>("/api/v1/rides/mine");
}

export function fetchRideRequest(id: string) {
  return apiRequest<RideRequestDetail>(`/api/v1/rides/requests/${id}`);
}

export function cancelRideRequest(id: string) {
  return apiRequest<RideRequest>(`/api/v1/rides/requests/${id}/cancel`, json("POST"));
}

export function acceptQuote(quoteId: string) {
  return apiRequest<Ride>(`/api/v1/rides/quotes/${quoteId}/accept`, json("POST"));
}

export function renewShareLink(rideId: string) {
  return apiRequest<{ share_token: string }>(`/api/v1/rides/${rideId}/share`, json("POST"));
}

export function fetchRide(id: string) {
  return apiRequest<Ride>(`/api/v1/rides/${id}`);
}

export function cancelRide(id: string, reason = "") {
  return apiRequest<Ride>(`/api/v1/rides/${id}/cancel`, json("POST", { reason }));
}

export function finishRide(id: string, outcome: "completed" | "no_show") {
  return apiRequest<Ride>(`/api/v1/rides/${id}/finish`, json("POST", { outcome }));
}

export function reviewRide(id: string, rating: number, body = "") {
  return apiRequest<Ride>(`/api/v1/rides/${id}/review`, json("POST", { rating, body }));
}

export function reportRide(rideId: string, category: RideReportCategory, details: string) {
  return apiRequest<{ id: string; category: string; escalated: boolean }>(
    "/api/v1/rides/reports",
    json("POST", { ride_id: rideId, category, details }),
  );
}

// ---- Driver side --------------------------------------------------------------------------------

export function setDriverTerms(dayRateMinor: number | null, airportPickups: boolean) {
  return apiRequest<DriverCard>(
    "/api/v1/rides/driver/terms",
    json("PUT", { day_rate_minor: dayRateMinor, airport_pickups: airportPickups }),
  );
}

export function fetchDriverInbox() {
  return apiRequest<DriverInboxItem[]>("/api/v1/rides/driver/requests");
}

export function sendQuote(requestId: string, vehicleId: string, priceMinor: number, note = "") {
  return apiRequest<DriverInboxItem>(
    `/api/v1/rides/driver/requests/${requestId}/quote`,
    json("POST", { vehicle_id: vehicleId, price_minor: priceMinor, note }),
  );
}

export function withdrawQuote(requestId: string) {
  return apiRequest<{ withdrawn: boolean }>(`/api/v1/rides/driver/requests/${requestId}/withdraw`, json("POST"));
}

export function fetchDriverRides() {
  return apiRequest<Ride[]>("/api/v1/rides/driver/rides");
}

/** The share link a traveller sends to family. */
export function shareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/rides/shared/${token}`;
}
