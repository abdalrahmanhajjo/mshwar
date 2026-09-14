import { securityFetch } from "@/lib/security";
export const HUB_PAGE_SIZE = 6;

export type HubPage<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

export type TripRecord = {
  id: string;
  name: string;
  status: "draft" | "locked" | "archived" | string;
  created_at: string;
};

export type FavoriteRecord = {
  id: string;
  listing_slug: string;
  created_at: string;
};

export type BookingRecord = {
  id: string;
  listing_slug: string;
  business_id: number | null;
  status: string;
  policy_summary: string;
  reason: string | null;
  created_at: string;
};

export type NotificationRecord = {
  id: string;
  title: string;
  body: string;
  category: string;
  read_at: string | null;
  created_at: string;
  deep_link?: string | null;
  event_type?: string | null;
  locale?: string | null;
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
  const response = await securityFetch(path, { credentials: "include", ...init });
  if (response.status === 204) {
    return undefined as T;
  }
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as T;
}

function listUrl(path: string, page: number): string {
  return `${path}?page=${page}&page_size=${HUB_PAGE_SIZE}`;
}

export function fetchTrips(page = 1) {
  return request<HubPage<TripRecord>>(listUrl("/api/v1/trips", page));
}

export function archiveTrip(id: string) {
  return request<TripRecord>(`/api/v1/trips/${id}/archive`, { method: "POST" });
}

export function fetchFavorites(page = 1) {
  return request<HubPage<FavoriteRecord>>(listUrl("/api/v1/favorites", page));
}

export function addFavorite(listingSlug: string) {
  return request<FavoriteRecord>("/api/v1/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listing_slug: listingSlug }),
  });
}

export function toggleFavorite(listingSlug: string) {
  return request<FavoriteRecord & { saved: boolean }>("/api/v1/favorites/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listing_slug: listingSlug }),
  });
}

export function mergeFavorites(listingSlugs: string[]) {
  return request<{ merged: number }>("/api/v1/favorites/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listing_slugs: listingSlugs }),
  });
}

export function removeFavorite(id: string) {
  return request<void>(`/api/v1/favorites/${id}`, { method: "DELETE" });
}

export function fetchBookings(page = 1) {
  return request<HubPage<BookingRecord>>(listUrl("/api/v1/bookings", page));
}

export function cancelBooking(id: string, reason: string) {
  return request<BookingRecord>(`/api/v1/bookings/${id}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export function fetchNotifications(page = 1) {
  return request<HubPage<NotificationRecord>>(listUrl("/api/v1/notifications", page));
}

export function markNotificationRead(id: string) {
  return request<NotificationRecord>(`/api/v1/notifications/${id}/read`, { method: "POST" });
}
