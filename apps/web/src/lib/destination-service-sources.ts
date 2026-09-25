import { apiRequest } from "@/lib/api/client";

export type ServiceCategory = "transport" | "drivers" | "money" | "eat" | "stay";
export type DestinationServiceSource = {
  id: string;
  destination_slug: string;
  category: ServiceCategory;
  name: string;
  locality: string;
  service_type: "car_rental" | "driver_service" | "money_transfer" | "bank" | "atm" | "eat" | "stay";
  coverage: "local" | "airport" | "national";
  source_url: string;
  source_name: string;
  source_kind: "operator" | "directory";
  checked_on: string;
  review_by: string;
};

export function fetchDestinationServiceSources(slug: string): Promise<DestinationServiceSource[]> {
  return apiRequest(`/api/v1/catalogue/destinations/${encodeURIComponent(slug)}/services`);
}
