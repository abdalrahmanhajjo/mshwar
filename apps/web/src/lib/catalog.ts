export type ExperienceCategory = "culture" | "nature" | "coast" | "adventure" | "city";

export type Destination = {
  slug: string;
  name: string;
  region: string;
  country: string;
  blurb: string;
  tags: string[];
  image: string;
  imageAlt: string;
};

export type Experience = {
  slug: string;
  title: string;
  category: ExperienceCategory;
  destinationSlug: string;
  placeLabel: string;
  hours: number;
  priceFrom: number;
  image: string;
  imageAlt: string;
  summary: string;
  body: string;
  tags: string[];
  bookingMode: "instant" | "request" | "inquiry";
  priceLabel: "from" | "estimated" | "quote";
  facts: { title: string; body: string }[];
};

export type Idea = {
  slug: string;
  kicker: string;
  title: string;
  description: string;
  stops: number;
  priceFrom: number;
  image: string;
  imageAlt: string;
  accent?: boolean;
  experienceSlugs: string[];
};

export const CATEGORIES: { slug: "all" | ExperienceCategory; label: string }[] = [
  { slug: "all", label: "All experiences" },
  { slug: "nature", label: "Nature" },
  { slug: "coast", label: "Coast" },
  { slug: "culture", label: "Culture" },
  { slug: "adventure", label: "Adventure" },
  { slug: "city", label: "City" },
];

export const DESTINATIONS: Destination[] = [
  {
    slug: "byblos",
    name: "Byblos",
    region: "Mount Lebanon",
    country: "Lebanon",
    blurb: "Wander stone lanes, pause by the old harbour, and make time for a long lunch beside the Mediterranean.",
    tags: ["Old town", "By the sea", "Easy walking"],
    image: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Fishing boats in a stone harbour",
  },
  {
    slug: "batroun",
    name: "Batroun",
    region: "North Lebanon",
    country: "Lebanon",
    blurb: "A friendly coastal town for a slower day by the water.",
    tags: ["Coast", "Friendly", "Relaxed pace"],
    image: "https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Stone church by the coast",
  },
  {
    slug: "bsharri",
    name: "Bsharri",
    region: "North Lebanon",
    country: "Lebanon",
    blurb: "Mountain air, cedar forest, and a different perspective.",
    tags: ["Forest", "Outdoors", "Mountain air"],
    image: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Cedar tree against a clear sky",
  },
  {
    slug: "qadisha-valley",
    name: "Qadisha Valley",
    region: "North Lebanon",
    country: "Lebanon",
    blurb: "Hike the scenic valley road at your own pace.",
    tags: ["Hiking", "Scenic", "Active"],
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Green mountain valley",
  },
  {
    slug: "baalbek",
    name: "Baalbek",
    region: "Bekaa",
    country: "Lebanon",
    blurb: "Give Lebanon’s history a day of your own.",
    tags: ["Heritage", "Architecture", "History"],
    image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Ancient stone columns",
  },
  {
    slug: "beirut",
    name: "Beirut",
    region: "Beirut",
    country: "Lebanon",
    blurb: "City, coffee, and sunset — from street to sea.",
    tags: ["City", "Coffee", "Sunset"],
    image: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Sea rocks at sunset",
  },
];

export const EXPERIENCES: Experience[] = [
  {
    slug: "slow-day-byblos",
    title: "A slow day in Byblos",
    category: "culture",
    destinationSlug: "byblos",
    placeLabel: "Byblos · Mount Lebanon",
    hours: 3,
    priceFrom: 35,
    image: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Harbour boats in Byblos",
    summary: "Byblos. A little closer.",
    body: "Wander stone lanes, pause by the old harbour, and make time for a long lunch beside the Mediterranean. A day for taking the scenic route.",
    tags: ["Old town", "By the sea", "Easy walking"],
    bookingMode: "request",
    priceLabel: "estimated",
    facts: [
      {
        title: "Time to enjoy it",
        body: "Allow around 3 hours for this sample experience.",
      },
      {
        title: "Bring your people",
        body: "Choose your party size and make the day your own.",
      },
      {
        title: "Meet in Byblos",
        body: "Exact meeting details are confirmed by the provider before a real booking.",
      },
      {
        title: "Know before you go",
        body: "Check opening hours, access and local conditions before travelling.",
      },
    ],
  },
  {
    slug: "coastal-escapes-batroun",
    title: "Coastal escapes in Batroun",
    category: "coast",
    destinationSlug: "batroun",
    placeLabel: "Batroun · North Lebanon",
    hours: 4,
    priceFrom: 45,
    image: "https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Coastal church in Batroun",
    summary: "Salt air and a friendly town.",
    body: "A coastal day with room to linger — swim, walk the old town, and eat when you are ready.",
    tags: ["Coast", "Friendly", "Relaxed pace"],
    bookingMode: "request",
    priceLabel: "from",
    facts: [
      { title: "Time to enjoy it", body: "Allow around 4 hours for this sample experience." },
      { title: "Bring your people", body: "Choose your party size and make the day your own." },
      { title: "Meet in Batroun", body: "Exact meeting details are confirmed by the provider before a real booking." },
      { title: "Know before you go", body: "Hours, access and weather need checking before travel." },
    ],
  },
  {
    slug: "among-ancient-cedars",
    title: "Among the ancient cedars",
    category: "nature",
    destinationSlug: "bsharri",
    placeLabel: "Bsharri · North Lebanon",
    hours: 2,
    priceFrom: 25,
    image: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Cedar tree in mountain light",
    summary: "A day above it all.",
    body: "Cedar forest and a different perspective. Short walks, cooler air, and time to look up.",
    tags: ["Forest", "Outdoors", "Mountain air"],
    bookingMode: "inquiry",
    priceLabel: "from",
    facts: [
      { title: "Time to enjoy it", body: "Allow around 2 hours for this sample experience." },
      { title: "Bring your people", body: "Choose your party size and make the day your own." },
      { title: "Meet in Bsharri", body: "Exact meeting details are confirmed by the provider before a real booking." },
      { title: "Know before you go", body: "Mountain weather changes quickly. Check conditions before you leave." },
    ],
  },
  {
    slug: "take-the-valley-road",
    title: "Take the valley road",
    category: "adventure",
    destinationSlug: "qadisha-valley",
    placeLabel: "Qadisha Valley · North Lebanon",
    hours: 5,
    priceFrom: 40,
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Valley road through the mountains",
    summary: "The scenic route, on purpose.",
    body: "A longer day for people who want the road itself — viewpoints, short walks, and a slower descent.",
    tags: ["Hiking", "Scenic", "Active"],
    bookingMode: "request",
    priceLabel: "from",
    facts: [
      { title: "Time to enjoy it", body: "Allow around 5 hours for this sample experience." },
      { title: "Bring your people", body: "Choose your party size and make the day your own." },
      {
        title: "Meet in Qadisha Valley",
        body: "Exact meeting details are confirmed by the provider before a real booking.",
      },
      { title: "Know before you go", body: "Wear shoes you can walk in. Some paths are uneven." },
    ],
  },
  {
    slug: "journey-through-baalbek",
    title: "A journey through Baalbek",
    category: "culture",
    destinationSlug: "baalbek",
    placeLabel: "Baalbek · Bekaa",
    hours: 3,
    priceFrom: 30,
    image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Ancient columns in Baalbek",
    summary: "Following the stories.",
    body: "Give Lebanon’s history a day of your own — columns, courtyards, and time to stand still.",
    tags: ["Heritage", "Architecture", "History"],
    bookingMode: "request",
    priceLabel: "estimated",
    facts: [
      { title: "Time to enjoy it", body: "Allow around 3 hours for this sample experience." },
      { title: "Bring your people", body: "Choose your party size and make the day your own." },
      { title: "Meet in Baalbek", body: "Exact meeting details are confirmed by the provider before a real booking." },
      { title: "Know before you go", body: "There is little shade. Bring water and a hat." },
    ],
  },
  {
    slug: "beirut-street-to-sea",
    title: "Beirut, from street to sea",
    category: "city",
    destinationSlug: "beirut",
    placeLabel: "Beirut · Beirut",
    hours: 3,
    priceFrom: 20,
    image: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Beirut coastline at dusk",
    summary: "Coffee, streets, and sunset.",
    body: "A city day that ends at the water — neighbourhoods, a long walk, and a seat facing the sea.",
    tags: ["City", "Coffee", "Sunset"],
    bookingMode: "inquiry",
    priceLabel: "from",
    facts: [
      { title: "Time to enjoy it", body: "Allow around 3 hours for this sample experience." },
      { title: "Bring your people", body: "Choose your party size and make the day your own." },
      { title: "Meet in Beirut", body: "Exact meeting details are confirmed by the provider before a real booking." },
      { title: "Know before you go", body: "Traffic and timing change. Leave a little room." },
    ],
  },
];

export const IDEAS: Idea[] = [
  {
    slug: "coast-calling",
    kicker: "Idea 01 · 2 stops",
    title: "The coast is calling.",
    description: "Harbour lanes, old streets and a little sea air.",
    stops: 2,
    priceFrom: 80,
    image: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Harbour boats along the coast",
    experienceSlugs: ["slow-day-byblos", "coastal-escapes-batroun"],
  },
  {
    slug: "day-above",
    kicker: "Idea 02 · 2 stops",
    title: "A day above it all.",
    description: "Cedar forests and a different perspective.",
    stops: 2,
    priceFrom: 65,
    image: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Cedar forest in mountain light",
    accent: true,
    experienceSlugs: ["among-ancient-cedars", "take-the-valley-road"],
  },
  {
    slug: "following-stories",
    kicker: "Idea 03 · 1 stop",
    title: "Following the stories.",
    description: "Give Lebanon’s history a day of your own.",
    stops: 1,
    priceFrom: 30,
    image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Ancient columns",
    experienceSlugs: ["journey-through-baalbek"],
  },
];

export const HOME_HERO_IMAGE =
  "https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=2000&q=80";

export type ExperienceFilters = {
  q?: string;
  category?: string;
  destination?: string;
  sort?: string;
};

export function getDestination(slug: string): Destination | undefined {
  return DESTINATIONS.find((item) => item.slug === slug);
}

export function getExperience(slug: string): Experience | undefined {
  return EXPERIENCES.find((item) => item.slug === slug);
}

export function experiencesForDestination(slug: string): Experience[] {
  return EXPERIENCES.filter((item) => item.destinationSlug === slug);
}

export function relatedExperiences(slug: string, limit = 3): Experience[] {
  const current = getExperience(slug);
  if (!current) {
    return EXPERIENCES.slice(0, limit);
  }
  const related = EXPERIENCES.filter(
    (item) =>
      item.slug !== slug && (item.destinationSlug === current.destinationSlug || item.category === current.category),
  );
  return (related.length ? related : EXPERIENCES.filter((item) => item.slug !== slug)).slice(0, limit);
}

export function filterExperiences(filters: ExperienceFilters): Experience[] {
  const q = filters.q?.trim().toLowerCase() ?? "";
  const category = filters.category && filters.category !== "all" ? filters.category : "";
  const destination = filters.destination?.trim() ?? "";
  let rows = EXPERIENCES.filter((item) => {
    if (category && item.category !== category) {
      return false;
    }
    if (destination && item.destinationSlug !== destination) {
      return false;
    }
    if (!q) {
      return true;
    }
    const hay = `${item.title} ${item.placeLabel} ${item.tags.join(" ")} ${item.body}`.toLowerCase();
    return hay.includes(q);
  });
  if (filters.sort === "price") {
    rows = [...rows].sort((a, b) => a.priceFrom - b.priceFrom);
  } else if (filters.sort === "duration") {
    rows = [...rows].sort((a, b) => a.hours - b.hours);
  }
  return rows;
}

export function bookingModeLabel(mode: Experience["bookingMode"]): string {
  if (mode === "instant") {
    return "Instant confirm";
  }
  if (mode === "inquiry") {
    return "Inquiry";
  }
  return "Request to book";
}
