import type { GuideJoinKey } from "@/lib/guide-join-copy";

/**
 * Starting points for a guide's first tour. A template fills in words, a length and a group
 * size; it never sets a price, and its stops are only suggested - the guide adds each real
 * place from the map, so a tour's route is always published catalogue places.
 */
export type TourTemplate = {
  id: string;
  title: GuideJoinKey;
  body: GuideJoinKey;
  included: GuideJoinKey;
  bring: GuideJoinKey;
  stops: GuideJoinKey;
  durationMinutes: number;
  maxParty: number;
};

export const TOUR_TEMPLATES: TourTemplate[] = [
  {
    id: "byblos",
    title: "tplByblosTitle",
    body: "tplByblosBody",
    included: "tplByblosIncluded",
    bring: "tplByblosBring",
    stops: "tplByblosStops",
    durationMinutes: 150,
    maxParty: 12,
  },
  {
    id: "batroun",
    title: "tplBatrounTitle",
    body: "tplBatrounBody",
    included: "tplBatrounIncluded",
    bring: "tplBatrounBring",
    stops: "tplBatrounStops",
    durationMinutes: 150,
    maxParty: 12,
  },
  {
    id: "qadisha",
    title: "tplQadishaTitle",
    body: "tplQadishaBody",
    included: "tplQadishaIncluded",
    bring: "tplQadishaBring",
    stops: "tplQadishaStops",
    durationMinutes: 300,
    maxParty: 10,
  },
  {
    id: "beirut",
    title: "tplBeirutTitle",
    body: "tplBeirutBody",
    included: "tplBeirutIncluded",
    bring: "tplBeirutBring",
    stops: "tplBeirutStops",
    durationMinutes: 180,
    maxParty: 10,
  },
  {
    id: "baalbek",
    title: "tplBaalbekTitle",
    body: "tplBaalbekBody",
    included: "tplBaalbekIncluded",
    bring: "tplBaalbekBring",
    stops: "tplBaalbekStops",
    durationMinutes: 180,
    maxParty: 15,
  },
  {
    id: "tyre",
    title: "tplTyreTitle",
    body: "tplTyreBody",
    included: "tplTyreIncluded",
    bring: "tplTyreBring",
    stops: "tplTyreStops",
    durationMinutes: 180,
    maxParty: 12,
  },
];
