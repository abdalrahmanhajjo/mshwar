export type CheckoutSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  remaining: number;
  authoritative: boolean;
};

export type CheckoutQuote = {
  experience_id: string;
  experience_title: string;
  slug: string;
  slot_id: string;
  starts_at: string;
  ends_at: string;
  party_size: number;
  configured_mode: string;
  effective_mode: string;
  instant_eligible: boolean;
  price_rule_id: string;
  policy_id: string;
  currency: string;
  total_minor: number;
  payment_required: boolean;
  price_snapshot: Record<string, unknown>;
  policy_snapshot: { terms?: string; rules?: Record<string, unknown> };
  remaining: number;
};

export type CheckoutBooking = {
  id: string;
  listing_slug: string;
  experience_title: string;
  status: string;
  mode: string;
  party_size: number;
  total_minor: number;
  currency: string;
  payment_required: boolean;
  hold_until?: string | null;
  inventory_reserved: boolean;
  price_snapshot: Record<string, unknown>;
  policy_snapshot: Record<string, unknown>;
  starts_at: string;
  ends_at: string;
};

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    return body.detail ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...init });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as T;
}

export function fetchSlots(slug: string) {
  return request<{ booking_mode: string; effective_mode: string; instant_eligible: boolean; slots: CheckoutSlot[] }>(
    `/api/v1/checkout/slots/${slug}`,
  );
}

export function quoteCheckout(payload: { listing_slug: string; slot_id: string; party_size: number }) {
  return request<CheckoutQuote>("/api/v1/checkout/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function commitCheckout(
  payload: CheckoutQuote & { listing_slug: string; trip_stop_id?: string },
  idempotencyKey: string,
) {
  return request<CheckoutBooking>("/api/v1/checkout/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({
      listing_slug: payload.listing_slug,
      slot_id: payload.slot_id,
      party_size: payload.party_size,
      price_rule_id: payload.price_rule_id,
      policy_id: payload.policy_id,
      trip_stop_id: payload.trip_stop_id,
      idempotency_key: idempotencyKey,
    }),
  });
}

export function sendInquiry(payload: { listing_slug: string; party_size: number; message: string }) {
  const key = `inq-${crypto.randomUUID()}`;
  return request("/api/v1/checkout/inquiry", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({ ...payload, idempotency_key: key }),
  });
}

export function fetchCheckoutBooking(id: string) {
  return request<CheckoutBooking>(`/api/v1/checkout/${id}`);
}

export function fetchTimeline(id: string) {
  return request<{
    booking: CheckoutBooking;
    timeline: { to_status: string; reason?: string; correlation_id?: string; created_at: string }[];
  }>(`/api/v1/checkout/${id}/timeline`);
}

export function fetchConfirmation(id: string, locale = "en") {
  return request<{ rendered: { body: string; dir: string; title: string }; price_snapshot: Record<string, unknown> }>(
    `/api/v1/checkout/${id}/confirmation?locale=${locale}`,
  );
}

export function previewCancel(id: string) {
  return request<{ refund_minor: number; currency: string; cancellable: boolean }>(
    `/api/v1/checkout/${id}/cancel-preview`,
    { method: "POST" },
  );
}

export function cancelCheckoutBooking(id: string, reason: string) {
  return request<CheckoutBooking>(`/api/v1/checkout/${id}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export function payCheckout(id: string, idempotencyKey: string) {
  return request(`/api/v1/checkout/${id}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ idempotency_key: idempotencyKey }),
  });
}

export function listMyCheckoutBookings() {
  return request<CheckoutBooking[]>("/api/v1/checkout/mine");
}
