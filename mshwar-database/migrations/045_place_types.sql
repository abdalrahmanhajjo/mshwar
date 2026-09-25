-- 045_place_types.sql
-- Trip builder v2, phase 2 (docs/ai-trip-builder-v2-plan.md, sections 3.3 and 3.11).
--
-- A traveller can now ask for a day step by step ("breakfast at a sweets place,
-- a mountain, bowling, a cinema, a hotel"). To fill each step the planner needs
-- to know what KIND of place every listing is. Until now a listing was one of
-- four listing kinds plus five broad categories, so "bowling" or "sweets" could
-- not be asked of the catalogue at all.
--
--   1. app.place_types - a closed catalogue of kinds of place (en/ar/fr names,
--      the planner role each one plays, a usual visit length, the meals it
--      usually serves, its season). Slugs match the step tags the planner reads
--      from text (app/planner/script/vocabulary.py), so a step tag IS a type.
--   2. app.experience_place_types - which types a listing is, set by its owner
--      or by staff, never by the language model.
--   3. Meal services and a schedule note on listing_details: "serves breakfast",
--      "showtimes vary, call ahead" - we never show a time we do not hold.
--   4. app.planner_retrieve_step - trusted candidates for ONE step. Restaurants
--      and stays must be checked (app.venue_is_checked); every row must be
--      published, visible, from a verified organisation, in a published place.
--
-- Nothing here makes a place trusted: types only say what a place is. Trust
-- still comes from the existing checks.

-- ---- 1. Kinds of place ------------------------------------------------------------------------
CREATE TABLE app.place_types (
    slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    place_group text NOT NULL CHECK (place_group IN (
        'food', 'stay', 'nature', 'heritage', 'entertainment', 'sport', 'wellness', 'shopping', 'family',
        'events', 'essentials'
    )),
    -- The planner step this kind of place fills. Money changers are offices, not listings (042).
    role text NOT NULL CHECK (role IN ('meal', 'sight', 'activity', 'stay', 'service')),
    name_en text NOT NULL CHECK (btrim(name_en) <> ''),
    name_ar text NOT NULL CHECK (btrim(name_ar) <> ''),
    name_fr text NOT NULL CHECK (btrim(name_fr) <> ''),
    default_minutes integer NOT NULL CHECK (default_minutes BETWEEN 10 AND 720),
    meal_services text[] NOT NULL DEFAULT '{}'
        CHECK (meal_services <@ ARRAY['breakfast', 'brunch', 'lunch', 'dinner', 'late']::text[]),
    season_months smallint[] CHECK (
        season_months IS NULL
        OR (cardinality(season_months) BETWEEN 1 AND 12 AND season_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[])
    ),
    -- Times vary (films, concerts): the plan says "check times" instead of inventing one.
    needs_schedule boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true,
    CHECK (role = 'meal' OR cardinality(meal_services) = 0)
);

ALTER TABLE app.place_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.place_types FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.place_types FROM PUBLIC, mshwar_backend;

INSERT INTO app.place_types
    (slug, place_group, role, name_en, name_ar, name_fr, default_minutes, meal_services, season_months, needs_schedule)
SELECT slug, place_group, role, name_en, name_ar, name_fr, default_minutes,
       coalesce(meal_services, '{}'), season_months, coalesce(needs_schedule, false)
FROM jsonb_to_recordset($types$
[
  {"slug": "restaurant", "place_group": "food", "role": "meal", "name_en": "Restaurant", "name_ar": "مطعم", "name_fr": "Restaurant", "default_minutes": 75, "meal_services": ["lunch", "dinner"]},
  {"slug": "sweets", "place_group": "food", "role": "meal", "name_en": "Sweets and knefeh", "name_ar": "حلويات وكنافة", "name_fr": "Pâtisserie orientale", "default_minutes": 40, "meal_services": ["breakfast"]},
  {"slug": "bakery", "place_group": "food", "role": "meal", "name_en": "Bakery", "name_ar": "فرن", "name_fr": "Boulangerie", "default_minutes": 30, "meal_services": ["breakfast"]},
  {"slug": "manakish", "place_group": "food", "role": "meal", "name_en": "Manakish bakery", "name_ar": "فرن مناقيش", "name_fr": "Man'ouché", "default_minutes": 40, "meal_services": ["breakfast", "lunch"]},
  {"slug": "cafe", "place_group": "food", "role": "meal", "name_en": "Café", "name_ar": "مقهى", "name_fr": "Café", "default_minutes": 45, "meal_services": ["breakfast", "brunch"]},
  {"slug": "juice-bar", "place_group": "food", "role": "meal", "name_en": "Juice bar", "name_ar": "محل عصير", "name_fr": "Bar à jus", "default_minutes": 20},
  {"slug": "ice-cream", "place_group": "food", "role": "meal", "name_en": "Ice cream", "name_ar": "بوظة", "name_fr": "Glacier", "default_minutes": 20},
  {"slug": "mezze", "place_group": "food", "role": "meal", "name_en": "Lebanese mezze", "name_ar": "مازة لبنانية", "name_fr": "Mezzés libanais", "default_minutes": 90, "meal_services": ["lunch", "dinner"]},
  {"slug": "grill", "place_group": "food", "role": "meal", "name_en": "Grill", "name_ar": "مشاوي", "name_fr": "Grillades", "default_minutes": 75, "meal_services": ["lunch", "dinner"]},
  {"slug": "seafood", "place_group": "food", "role": "meal", "name_en": "Seafood", "name_ar": "مأكولات بحرية", "name_fr": "Fruits de mer", "default_minutes": 90, "meal_services": ["lunch", "dinner"]},
  {"slug": "shawarma", "place_group": "food", "role": "meal", "name_en": "Shawarma", "name_ar": "شاورما", "name_fr": "Chawarma", "default_minutes": 30, "meal_services": ["lunch", "dinner", "late"]},
  {"slug": "falafel", "place_group": "food", "role": "meal", "name_en": "Falafel", "name_ar": "فلافل", "name_fr": "Falafel", "default_minutes": 30, "meal_services": ["breakfast", "lunch", "dinner"]},
  {"slug": "pizza", "place_group": "food", "role": "meal", "name_en": "Pizza", "name_ar": "بيتزا", "name_fr": "Pizzeria", "default_minutes": 60, "meal_services": ["lunch", "dinner", "late"]},
  {"slug": "burger", "place_group": "food", "role": "meal", "name_en": "Burgers", "name_ar": "برغر", "name_fr": "Burgers", "default_minutes": 45, "meal_services": ["lunch", "dinner", "late"]},
  {"slug": "sushi", "place_group": "food", "role": "meal", "name_en": "Sushi", "name_ar": "سوشي", "name_fr": "Sushi", "default_minutes": 60, "meal_services": ["lunch", "dinner"]},
  {"slug": "international", "place_group": "food", "role": "meal", "name_en": "International food", "name_ar": "مطبخ عالمي", "name_fr": "Cuisine internationale", "default_minutes": 75, "meal_services": ["lunch", "dinner"]},
  {"slug": "fine-dining", "place_group": "food", "role": "meal", "name_en": "Fine dining", "name_ar": "مطعم راقٍ", "name_fr": "Gastronomique", "default_minutes": 120, "meal_services": ["dinner"]},
  {"slug": "rooftop", "place_group": "food", "role": "meal", "name_en": "Rooftop", "name_ar": "مطعم على السطح", "name_fr": "Rooftop", "default_minutes": 90, "meal_services": ["dinner", "late"]},
  {"slug": "family-restaurant", "place_group": "family", "role": "meal", "name_en": "Family restaurant", "name_ar": "مطعم عائلي", "name_fr": "Restaurant familial", "default_minutes": 75, "meal_services": ["lunch", "dinner"]},

  {"slug": "hotel", "place_group": "stay", "role": "stay", "name_en": "Hotel", "name_ar": "فندق", "name_fr": "Hôtel", "default_minutes": 600},
  {"slug": "boutique-hotel", "place_group": "stay", "role": "stay", "name_en": "Boutique hotel", "name_ar": "فندق بوتيك", "name_fr": "Hôtel de charme", "default_minutes": 600},
  {"slug": "resort", "place_group": "stay", "role": "stay", "name_en": "Resort", "name_ar": "منتجع", "name_fr": "Complexe hôtelier", "default_minutes": 600},
  {"slug": "guesthouse", "place_group": "stay", "role": "stay", "name_en": "Guesthouse", "name_ar": "بيت ضيافة", "name_fr": "Maison d'hôtes", "default_minutes": 600},
  {"slug": "hostel", "place_group": "stay", "role": "stay", "name_en": "Hostel", "name_ar": "نزل شبابي", "name_fr": "Auberge de jeunesse", "default_minutes": 600},
  {"slug": "apartment", "place_group": "stay", "role": "stay", "name_en": "Apartment", "name_ar": "شقة مفروشة", "name_fr": "Appartement", "default_minutes": 600},
  {"slug": "chalet", "place_group": "stay", "role": "stay", "name_en": "Chalet", "name_ar": "شاليه", "name_fr": "Chalet", "default_minutes": 600},
  {"slug": "eco-lodge", "place_group": "stay", "role": "stay", "name_en": "Eco-lodge", "name_ar": "نُزُل بيئي", "name_fr": "Écolodge", "default_minutes": 600},
  {"slug": "farm-stay", "place_group": "stay", "role": "stay", "name_en": "Farm stay", "name_ar": "إقامة في مزرعة", "name_fr": "Séjour à la ferme", "default_minutes": 600},
  {"slug": "monastery-stay", "place_group": "stay", "role": "stay", "name_en": "Monastery stay", "name_ar": "إقامة في دير", "name_fr": "Séjour au monastère", "default_minutes": 600},
  {"slug": "camping", "place_group": "stay", "role": "stay", "name_en": "Campsite", "name_ar": "مخيّم", "name_fr": "Camping", "default_minutes": 600, "season_months": [5, 6, 7, 8, 9, 10]},
  {"slug": "glamping", "place_group": "stay", "role": "stay", "name_en": "Glamping", "name_ar": "تخييم فاخر", "name_fr": "Glamping", "default_minutes": 600, "season_months": [4, 5, 6, 7, 8, 9, 10]},

  {"slug": "mountain", "place_group": "nature", "role": "sight", "name_en": "Mountain", "name_ar": "جبل", "name_fr": "Montagne", "default_minutes": 90},
  {"slug": "viewpoint", "place_group": "nature", "role": "sight", "name_en": "Viewpoint", "name_ar": "منظر بانورامي", "name_fr": "Point de vue", "default_minutes": 30},
  {"slug": "cedars", "place_group": "nature", "role": "sight", "name_en": "Cedar forest", "name_ar": "غابة أرز", "name_fr": "Forêt de cèdres", "default_minutes": 90},
  {"slug": "forest", "place_group": "nature", "role": "sight", "name_en": "Forest", "name_ar": "غابة", "name_fr": "Forêt", "default_minutes": 90},
  {"slug": "valley", "place_group": "nature", "role": "sight", "name_en": "Valley", "name_ar": "وادي", "name_fr": "Vallée", "default_minutes": 120},
  {"slug": "waterfall", "place_group": "nature", "role": "sight", "name_en": "Waterfall", "name_ar": "شلال", "name_fr": "Cascade", "default_minutes": 60},
  {"slug": "river", "place_group": "nature", "role": "sight", "name_en": "River", "name_ar": "نهر", "name_fr": "Rivière", "default_minutes": 60},
  {"slug": "spring", "place_group": "nature", "role": "sight", "name_en": "Spring", "name_ar": "نبع", "name_fr": "Source", "default_minutes": 45},
  {"slug": "lake", "place_group": "nature", "role": "sight", "name_en": "Lake", "name_ar": "بحيرة", "name_fr": "Lac", "default_minutes": 60},
  {"slug": "cave", "place_group": "nature", "role": "sight", "name_en": "Cave", "name_ar": "مغارة", "name_fr": "Grotte", "default_minutes": 75},
  {"slug": "natural-bridge", "place_group": "nature", "role": "sight", "name_en": "Natural bridge", "name_ar": "جسر طبيعي", "name_fr": "Pont naturel", "default_minutes": 45},
  {"slug": "nature-reserve", "place_group": "nature", "role": "sight", "name_en": "Nature reserve", "name_ar": "محمية طبيعية", "name_fr": "Réserve naturelle", "default_minutes": 150},
  {"slug": "beach", "place_group": "nature", "role": "sight", "name_en": "Beach", "name_ar": "شاطئ", "name_fr": "Plage", "default_minutes": 180, "season_months": [5, 6, 7, 8, 9, 10]},
  {"slug": "island", "place_group": "nature", "role": "sight", "name_en": "Island", "name_ar": "جزيرة", "name_fr": "Île", "default_minutes": 180, "season_months": [5, 6, 7, 8, 9, 10]},
  {"slug": "picnic-area", "place_group": "nature", "role": "sight", "name_en": "Picnic area", "name_ar": "منطقة نزهة", "name_fr": "Aire de pique-nique", "default_minutes": 90},
  {"slug": "hiking", "place_group": "nature", "role": "activity", "name_en": "Hiking trail", "name_ar": "درب مشي", "name_fr": "Sentier de randonnée", "default_minutes": 180},

  {"slug": "ruins", "place_group": "heritage", "role": "sight", "name_en": "Ancient ruins", "name_ar": "آثار", "name_fr": "Vestiges antiques", "default_minutes": 120},
  {"slug": "castle", "place_group": "heritage", "role": "sight", "name_en": "Castle or citadel", "name_ar": "قلعة", "name_fr": "Château ou citadelle", "default_minutes": 75},
  {"slug": "old-town", "place_group": "heritage", "role": "sight", "name_en": "Old town", "name_ar": "البلدة القديمة", "name_fr": "Vieille ville", "default_minutes": 90},
  {"slug": "souk", "place_group": "heritage", "role": "sight", "name_en": "Souk", "name_ar": "سوق قديم", "name_fr": "Souk", "default_minutes": 75},
  {"slug": "palace", "place_group": "heritage", "role": "sight", "name_en": "Palace", "name_ar": "قصر", "name_fr": "Palais", "default_minutes": 75},
  {"slug": "museum", "place_group": "heritage", "role": "sight", "name_en": "Museum", "name_ar": "متحف", "name_fr": "Musée", "default_minutes": 90},
  {"slug": "gallery", "place_group": "heritage", "role": "sight", "name_en": "Art gallery", "name_ar": "معرض فني", "name_fr": "Galerie d'art", "default_minutes": 45},
  {"slug": "church", "place_group": "heritage", "role": "sight", "name_en": "Church", "name_ar": "كنيسة", "name_fr": "Église", "default_minutes": 30},
  {"slug": "mosque", "place_group": "heritage", "role": "sight", "name_en": "Mosque", "name_ar": "مسجد", "name_fr": "Mosquée", "default_minutes": 30},
  {"slug": "monastery", "place_group": "heritage", "role": "sight", "name_en": "Monastery", "name_ar": "دير", "name_fr": "Monastère", "default_minutes": 60},
  {"slug": "shrine", "place_group": "heritage", "role": "sight", "name_en": "Shrine", "name_ar": "مزار", "name_fr": "Sanctuaire", "default_minutes": 30},
  {"slug": "cultural-centre", "place_group": "heritage", "role": "sight", "name_en": "Cultural centre", "name_ar": "مركز ثقافي", "name_fr": "Centre culturel", "default_minutes": 60},
  {"slug": "memorial", "place_group": "heritage", "role": "sight", "name_en": "Memorial", "name_ar": "نصب تذكاري", "name_fr": "Mémorial", "default_minutes": 20},
  {"slug": "street-art", "place_group": "heritage", "role": "sight", "name_en": "Street art", "name_ar": "فن الشارع", "name_fr": "Art urbain", "default_minutes": 45},
  {"slug": "theatre", "place_group": "heritage", "role": "activity", "name_en": "Theatre", "name_ar": "مسرح", "name_fr": "Théâtre", "default_minutes": 150, "needs_schedule": true},

  {"slug": "cinema", "place_group": "entertainment", "role": "activity", "name_en": "Cinema", "name_ar": "سينما", "name_fr": "Cinéma", "default_minutes": 150, "needs_schedule": true},
  {"slug": "bowling", "place_group": "entertainment", "role": "activity", "name_en": "Bowling", "name_ar": "بولينغ", "name_fr": "Bowling", "default_minutes": 90},
  {"slug": "escape-room", "place_group": "entertainment", "role": "activity", "name_en": "Escape room", "name_ar": "غرفة الهروب", "name_fr": "Escape game", "default_minutes": 75},
  {"slug": "karting", "place_group": "entertainment", "role": "activity", "name_en": "Karting", "name_ar": "كارتينغ", "name_fr": "Karting", "default_minutes": 60},
  {"slug": "arcade", "place_group": "entertainment", "role": "activity", "name_en": "Arcade", "name_ar": "صالة ألعاب", "name_fr": "Salle d'arcade", "default_minutes": 60},
  {"slug": "billiards", "place_group": "entertainment", "role": "activity", "name_en": "Billiards", "name_ar": "بلياردو", "name_fr": "Billard", "default_minutes": 60},
  {"slug": "trampoline-park", "place_group": "entertainment", "role": "activity", "name_en": "Trampoline park", "name_ar": "حديقة ترامبولين", "name_fr": "Parc de trampolines", "default_minutes": 60},
  {"slug": "paintball", "place_group": "entertainment", "role": "activity", "name_en": "Paintball", "name_ar": "بينتبول", "name_fr": "Paintball", "default_minutes": 90},
  {"slug": "laser-tag", "place_group": "entertainment", "role": "activity", "name_en": "Laser tag", "name_ar": "ليزر تاغ", "name_fr": "Laser game", "default_minutes": 60},
  {"slug": "amusement-park", "place_group": "entertainment", "role": "activity", "name_en": "Amusement park", "name_ar": "مدينة ملاهي", "name_fr": "Parc d'attractions", "default_minutes": 180},
  {"slug": "water-park", "place_group": "entertainment", "role": "activity", "name_en": "Water park", "name_ar": "حديقة مائية", "name_fr": "Parc aquatique", "default_minutes": 240, "season_months": [5, 6, 7, 8, 9, 10]},
  {"slug": "zoo", "place_group": "entertainment", "role": "activity", "name_en": "Zoo", "name_ar": "حديقة حيوانات", "name_fr": "Zoo", "default_minutes": 120},
  {"slug": "aquarium", "place_group": "entertainment", "role": "activity", "name_en": "Aquarium", "name_ar": "أكواريوم", "name_fr": "Aquarium", "default_minutes": 90},
  {"slug": "bar", "place_group": "entertainment", "role": "activity", "name_en": "Bar", "name_ar": "بار", "name_fr": "Bar", "default_minutes": 90},
  {"slug": "winery", "place_group": "entertainment", "role": "activity", "name_en": "Winery", "name_ar": "مصنع نبيذ", "name_fr": "Domaine viticole", "default_minutes": 90},
  {"slug": "nightclub", "place_group": "entertainment", "role": "activity", "name_en": "Nightclub", "name_ar": "نادٍ ليلي", "name_fr": "Boîte de nuit", "default_minutes": 180},
  {"slug": "live-music", "place_group": "entertainment", "role": "activity", "name_en": "Live music", "name_ar": "موسيقى حيّة", "name_fr": "Musique live", "default_minutes": 150, "needs_schedule": true},
  {"slug": "comedy-club", "place_group": "entertainment", "role": "activity", "name_en": "Comedy club", "name_ar": "عرض كوميدي", "name_fr": "Club de comédie", "default_minutes": 120, "needs_schedule": true},
  {"slug": "karaoke", "place_group": "entertainment", "role": "activity", "name_en": "Karaoke", "name_ar": "كاريوكي", "name_fr": "Karaoké", "default_minutes": 120},

  {"slug": "skiing", "place_group": "sport", "role": "activity", "name_en": "Ski resort", "name_ar": "منتجع تزلج", "name_fr": "Station de ski", "default_minutes": 300, "season_months": [12, 1, 2, 3, 4]},
  {"slug": "paragliding", "place_group": "sport", "role": "activity", "name_en": "Paragliding", "name_ar": "طيران شراعي", "name_fr": "Parapente", "default_minutes": 90},
  {"slug": "zipline", "place_group": "sport", "role": "activity", "name_en": "Zipline", "name_ar": "انزلاق بالحبل", "name_fr": "Tyrolienne", "default_minutes": 60},
  {"slug": "climbing", "place_group": "sport", "role": "activity", "name_en": "Climbing", "name_ar": "تسلّق", "name_fr": "Escalade", "default_minutes": 150},
  {"slug": "via-ferrata", "place_group": "sport", "role": "activity", "name_en": "Via ferrata", "name_ar": "فيا فيراتا", "name_fr": "Via ferrata", "default_minutes": 180},
  {"slug": "diving", "place_group": "sport", "role": "activity", "name_en": "Diving", "name_ar": "غطس", "name_fr": "Plongée", "default_minutes": 180, "season_months": [5, 6, 7, 8, 9, 10, 11]},
  {"slug": "kayaking", "place_group": "sport", "role": "activity", "name_en": "Kayaking and rafting", "name_ar": "كاياك وتجديف", "name_fr": "Kayak et rafting", "default_minutes": 120},
  {"slug": "sailing", "place_group": "sport", "role": "activity", "name_en": "Sailing and boat trips", "name_ar": "رحلات بحرية", "name_fr": "Voile et sorties en bateau", "default_minutes": 150, "season_months": [5, 6, 7, 8, 9, 10]},
  {"slug": "horse-riding", "place_group": "sport", "role": "activity", "name_en": "Horse riding", "name_ar": "ركوب الخيل", "name_fr": "Équitation", "default_minutes": 90},
  {"slug": "cycling", "place_group": "sport", "role": "activity", "name_en": "Cycling", "name_ar": "ركوب الدراجات", "name_fr": "Vélo", "default_minutes": 150},
  {"slug": "quad-biking", "place_group": "sport", "role": "activity", "name_en": "Quad biking", "name_ar": "دراجات رباعية", "name_fr": "Quad", "default_minutes": 90},
  {"slug": "golf", "place_group": "sport", "role": "activity", "name_en": "Golf", "name_ar": "غولف", "name_fr": "Golf", "default_minutes": 180},
  {"slug": "padel", "place_group": "sport", "role": "activity", "name_en": "Padel and tennis", "name_ar": "بادل وتنس", "name_fr": "Padel et tennis", "default_minutes": 90},
  {"slug": "public-pool", "place_group": "sport", "role": "activity", "name_en": "Swimming pool", "name_ar": "مسبح", "name_fr": "Piscine", "default_minutes": 150, "season_months": [5, 6, 7, 8, 9, 10]},
  {"slug": "beach-club", "place_group": "sport", "role": "activity", "name_en": "Beach club", "name_ar": "نادٍ شاطئي", "name_fr": "Club de plage", "default_minutes": 240, "season_months": [5, 6, 7, 8, 9, 10]},

  {"slug": "spa", "place_group": "wellness", "role": "activity", "name_en": "Spa", "name_ar": "سبا", "name_fr": "Spa", "default_minutes": 120},
  {"slug": "hammam", "place_group": "wellness", "role": "activity", "name_en": "Hammam", "name_ar": "حمّام تقليدي", "name_fr": "Hammam", "default_minutes": 90},
  {"slug": "yoga", "place_group": "wellness", "role": "activity", "name_en": "Yoga", "name_ar": "يوغا", "name_fr": "Yoga", "default_minutes": 75},

  {"slug": "shopping", "place_group": "shopping", "role": "activity", "name_en": "Shopping street", "name_ar": "شارع تسوّق", "name_fr": "Rue commerçante", "default_minutes": 90},
  {"slug": "mall", "place_group": "shopping", "role": "activity", "name_en": "Mall", "name_ar": "مول", "name_fr": "Centre commercial", "default_minutes": 120},
  {"slug": "market", "place_group": "shopping", "role": "activity", "name_en": "Market", "name_ar": "سوق", "name_fr": "Marché", "default_minutes": 60},
  {"slug": "farmers-market", "place_group": "shopping", "role": "activity", "name_en": "Farmers' market", "name_ar": "سوق المزارعين", "name_fr": "Marché paysan", "default_minutes": 60},
  {"slug": "souvenirs", "place_group": "shopping", "role": "activity", "name_en": "Crafts and souvenirs", "name_ar": "حِرَف وتذكارات", "name_fr": "Artisanat et souvenirs", "default_minutes": 45},
  {"slug": "soap-maker", "place_group": "shopping", "role": "activity", "name_en": "Soap maker", "name_ar": "صانع صابون", "name_fr": "Savonnerie", "default_minutes": 45},
  {"slug": "bookshop", "place_group": "shopping", "role": "activity", "name_en": "Bookshop", "name_ar": "مكتبة", "name_fr": "Librairie", "default_minutes": 45},

  {"slug": "playground", "place_group": "family", "role": "activity", "name_en": "Playground", "name_ar": "ملعب أطفال", "name_fr": "Aire de jeux", "default_minutes": 60},
  {"slug": "kids-play-centre", "place_group": "family", "role": "activity", "name_en": "Kids' play centre", "name_ar": "مركز ألعاب أطفال", "name_fr": "Centre de jeux pour enfants", "default_minutes": 90},
  {"slug": "park", "place_group": "family", "role": "sight", "name_en": "Park", "name_ar": "حديقة عامة", "name_fr": "Parc", "default_minutes": 60},
  {"slug": "petting-farm", "place_group": "family", "role": "activity", "name_en": "Petting farm", "name_ar": "مزرعة حيوانات", "name_fr": "Ferme pédagogique", "default_minutes": 90},

  {"slug": "festival-venue", "place_group": "events", "role": "activity", "name_en": "Festival venue", "name_ar": "موقع مهرجان", "name_fr": "Lieu de festival", "default_minutes": 180, "season_months": [6, 7, 8, 9], "needs_schedule": true},

  {"slug": "pharmacy", "place_group": "essentials", "role": "service", "name_en": "Pharmacy", "name_ar": "صيدلية", "name_fr": "Pharmacie", "default_minutes": 15},
  {"slug": "hospital", "place_group": "essentials", "role": "service", "name_en": "Hospital", "name_ar": "مستشفى", "name_fr": "Hôpital", "default_minutes": 60},
  {"slug": "clinic", "place_group": "essentials", "role": "service", "name_en": "Clinic", "name_ar": "عيادة", "name_fr": "Clinique", "default_minutes": 45},
  {"slug": "atm", "place_group": "essentials", "role": "service", "name_en": "ATM", "name_ar": "صراف آلي", "name_fr": "Distributeur", "default_minutes": 10},
  {"slug": "sim-card", "place_group": "essentials", "role": "service", "name_en": "SIM card shop", "name_ar": "محل خطوط هاتف", "name_fr": "Boutique de cartes SIM", "default_minutes": 20},
  {"slug": "petrol", "place_group": "essentials", "role": "service", "name_en": "Petrol station", "name_ar": "محطة وقود", "name_fr": "Station-service", "default_minutes": 10},
  {"slug": "ev-charger", "place_group": "essentials", "role": "service", "name_en": "EV charger", "name_ar": "شاحن سيارات كهربائية", "name_fr": "Borne de recharge", "default_minutes": 45},
  {"slug": "tourist-info", "place_group": "essentials", "role": "service", "name_en": "Tourist information", "name_ar": "مكتب معلومات سياحية", "name_fr": "Office de tourisme", "default_minutes": 15},
  {"slug": "car-rental", "place_group": "essentials", "role": "service", "name_en": "Car rental", "name_ar": "تأجير سيارات", "name_fr": "Location de voitures", "default_minutes": 30},
  {"slug": "laundry", "place_group": "essentials", "role": "service", "name_en": "Laundry", "name_ar": "مصبغة", "name_fr": "Laverie", "default_minutes": 20},
  {"slug": "public-toilets", "place_group": "essentials", "role": "service", "name_en": "Public toilets", "name_ar": "حمّامات عامة", "name_fr": "Toilettes publiques", "default_minutes": 10},
  {"slug": "luggage-storage", "place_group": "essentials", "role": "service", "name_en": "Luggage storage", "name_ar": "حفظ الأمتعة", "name_fr": "Consigne à bagages", "default_minutes": 10}
]
$types$::jsonb) AS t(
    slug text, place_group text, role text, name_en text, name_ar text, name_fr text, default_minutes integer,
    meal_services text[], season_months smallint[], needs_schedule boolean
)
ON CONFLICT (slug) DO NOTHING;

-- ---- 2. What a listing is ----------------------------------------------------------------------
CREATE TABLE app.experience_place_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    experience_id uuid NOT NULL REFERENCES app.experiences(id) ON DELETE CASCADE,
    place_type text NOT NULL REFERENCES app.place_types(slug),
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (experience_id, place_type)
);
CREATE UNIQUE INDEX experience_place_types_one_primary ON app.experience_place_types (experience_id) WHERE is_primary;
CREATE INDEX experience_place_types_type_idx ON app.experience_place_types (place_type, experience_id);

ALTER TABLE app.experience_place_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.experience_place_types FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.experience_place_types FROM PUBLIC, mshwar_backend;

-- Which kind of place a listing is decides what the planner may plan it as, so every change is audited.
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON app.experience_place_types
    FOR EACH ROW EXECUTE FUNCTION app.audit_change();

-- ---- 3. Meals served and schedules we do not hold -----------------------------------------------
ALTER TABLE app.listing_details
    ADD COLUMN IF NOT EXISTS meal_services text[] NOT NULL DEFAULT '{}'
        CHECK (meal_services <@ ARRAY['breakfast', 'brunch', 'lunch', 'dinner', 'late']::text[]),
    ADD COLUMN IF NOT EXISTS schedule_note text NOT NULL DEFAULT '' CHECK (length(schedule_note) <= 280);

-- Listings that already say what they are get the matching type. Nothing is guessed beyond that.
INSERT INTO app.experience_place_types (experience_id, place_type, is_primary)
SELECT e.id,
       CASE WHEN e.listing_kind = 'restaurant' THEN 'restaurant'
            ELSE coalesce(NULLIF(d.stay_type, ''), 'hotel') END,
       true
FROM app.experiences e
LEFT JOIN app.listing_details d ON d.experience_id = e.id
WHERE e.listing_kind IN ('restaurant', 'hotel')
ON CONFLICT (experience_id, place_type) DO NOTHING;

-- ---- 4. Reading types --------------------------------------------------------------------------
-- The planner role a listing plays when nobody has set its types yet.
CREATE FUNCTION app.listing_kind_role(p_kind text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = app, public
AS $$
    SELECT CASE p_kind
        WHEN 'restaurant' THEN 'meal'
        WHEN 'hotel' THEN 'stay'
        WHEN 'attraction' THEN 'sight'
        ELSE 'activity'
    END
$$;

CREATE FUNCTION app.experience_place_type_slugs(p_experience uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(array_agg(ept.place_type ORDER BY ept.is_primary DESC, ept.place_type), '{}')
    FROM app.experience_place_types ept
    JOIN app.place_types pt ON pt.slug = ept.place_type AND pt.active
    WHERE ept.experience_id = p_experience
$$;

-- The planner roles a listing can fill: from its types, or from its listing kind when it has none.
CREATE FUNCTION app.experience_roles(p_experience uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT CASE
        WHEN EXISTS (SELECT 1 FROM app.experience_place_types WHERE experience_id = p_experience) THEN (
            SELECT coalesce(array_agg(DISTINCT pt.role), '{}')
            FROM app.experience_place_types ept
            JOIN app.place_types pt ON pt.slug = ept.place_type AND pt.active
            WHERE ept.experience_id = p_experience
        )
        ELSE ARRAY[app.listing_kind_role((SELECT listing_kind FROM app.experiences WHERE id = p_experience))]
    END
$$;

-- Meals a listing serves: what its owner said, else what its kind of place usually serves, else unknown ({}).
CREATE FUNCTION app.experience_meal_services(p_experience uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT CASE
        WHEN cardinality(coalesce(d.meal_services, '{}')) > 0 THEN d.meal_services
        ELSE coalesce((
            SELECT array_agg(DISTINCT m ORDER BY m)
            FROM app.experience_place_types ept
            JOIN app.place_types pt ON pt.slug = ept.place_type AND pt.active
            CROSS JOIN LATERAL unnest(pt.meal_services) AS m
            WHERE ept.experience_id = p_experience
        ), '{}')
    END
    FROM (SELECT p_experience AS id) x
    LEFT JOIN app.listing_details d ON d.experience_id = x.id
$$;

-- A listing the planner may put in a day: the same bar as today's retrieval, plus the venue check
-- for restaurants and stays. Hidden listings are paused by moderation; hidden_at is checked anyway.
CREATE FUNCTION app.planner_step_eligible(p_experience uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce((
        SELECT e.status = 'published' AND e.hidden_at IS NULL
           AND o.status = 'active' AND o.verification = 'verified'
           AND d.status = 'published'
           AND (e.listing_kind NOT IN ('restaurant', 'hotel') OR app.venue_is_checked(e.id))
        FROM app.experiences e
        JOIN app.organizations o ON o.id = e.organization_id
        JOIN app.venues v ON v.id = e.venue_id
        JOIN app.destinations d ON d.id = v.destination_id
        WHERE e.id = p_experience
    ), false)
$$;

-- What the traveller is shown as the reason to trust a stop. Derived, never stored.
CREATE FUNCTION app.planner_trust_json(p_experience uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'level', CASE
            WHEN e.listing_kind IN ('restaurant', 'hotel') AND app.venue_is_checked(e.id) THEN e.verified_level
            ELSE 'verified_organisation'
        END,
        'checked_on', CASE WHEN e.listing_kind IN ('restaurant', 'hotel') THEN e.checked_on END,
        'review_by', CASE WHEN e.listing_kind IN ('restaurant', 'hotel') THEN e.review_by END
    )
    FROM app.experiences e WHERE e.id = p_experience
$$;

CREATE FUNCTION app.place_types_json()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'slug', pt.slug, 'group', pt.place_group, 'role', pt.role,
        'names', jsonb_build_object('en', pt.name_en, 'ar', pt.name_ar, 'fr', pt.name_fr),
        'default_minutes', pt.default_minutes, 'meal_services', to_jsonb(pt.meal_services),
        'season_months', to_jsonb(pt.season_months), 'needs_schedule', pt.needs_schedule
    ) ORDER BY pt.place_group, pt.slug), '[]'::jsonb)
    FROM app.place_types pt WHERE pt.active
$$;

-- ---- 5. Setting types (owners and staff) -------------------------------------------------------
-- One rule for both: 1-6 known types; a restaurant takes only meal types and a stay only stay types,
-- and only a restaurant or stay may take them - so a meal or a night is always a checked venue.
CREATE FUNCTION app.set_place_types_unchecked(p_experience uuid, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_kind text;
    v_types text[];
    v_unknown text;
    v_bad text;
    v_meals text[];
BEGIN
    SELECT listing_kind INTO v_kind FROM app.experiences WHERE id = p_experience;
    IF v_kind IS NULL THEN
        RAISE EXCEPTION 'listing not found' USING ERRCODE = 'P0002';
    END IF;
    IF jsonb_typeof(p_payload->'place_types') <> 'array' THEN
        RAISE EXCEPTION 'choose what kind of place this is' USING ERRCODE = '22023';
    END IF;
    -- Keep the order given: the first type is the main one.
    SELECT array_agg(slug ORDER BY first_at) INTO v_types
    FROM (
        SELECT lower(btrim(value)) AS slug, min(ordinality) AS first_at
        FROM jsonb_array_elements_text(p_payload->'place_types') WITH ORDINALITY
        WHERE btrim(value) <> ''
        GROUP BY lower(btrim(value))
    ) given;
    IF coalesce(cardinality(v_types), 0) NOT BETWEEN 1 AND 6 THEN
        RAISE EXCEPTION 'choose between one and six kinds of place' USING ERRCODE = '22023';
    END IF;
    SELECT t INTO v_unknown FROM unnest(v_types) t
    WHERE NOT EXISTS (SELECT 1 FROM app.place_types pt WHERE pt.slug = t AND pt.active) LIMIT 1;
    IF v_unknown IS NOT NULL THEN
        RAISE EXCEPTION 'unknown kind of place: %', v_unknown USING ERRCODE = '22023';
    END IF;
    SELECT pt.slug INTO v_bad FROM app.place_types pt WHERE pt.slug = ANY (v_types) AND (
        (v_kind = 'restaurant' AND pt.role <> 'meal')
        OR (v_kind = 'hotel' AND pt.role <> 'stay')
        OR (v_kind NOT IN ('restaurant', 'hotel') AND pt.role IN ('meal', 'stay'))
    ) LIMIT 1;
    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION '% does not fit a listing of this kind: set a restaurant or stay as its own listing', v_bad
            USING ERRCODE = '22023';
    END IF;

    DELETE FROM app.experience_place_types WHERE experience_id = p_experience AND NOT (place_type = ANY (v_types));
    UPDATE app.experience_place_types SET is_primary = false
    WHERE experience_id = p_experience AND is_primary AND place_type <> v_types[1];
    INSERT INTO app.experience_place_types (experience_id, place_type, is_primary)
    SELECT p_experience, t, t = v_types[1] FROM unnest(v_types) t
    ON CONFLICT (experience_id, place_type) DO UPDATE SET is_primary = EXCLUDED.is_primary;

    IF p_payload ? 'meal_services' OR p_payload ? 'schedule_note' THEN
        IF p_payload ? 'meal_services' AND jsonb_typeof(p_payload->'meal_services') <> 'array' THEN
            RAISE EXCEPTION 'meal services must be a list' USING ERRCODE = '22023';
        END IF;
        v_meals := coalesce((
            SELECT array_agg(DISTINCT lower(btrim(value)) ORDER BY lower(btrim(value)))
            FROM jsonb_array_elements_text(coalesce(p_payload->'meal_services', '[]'::jsonb))
            WHERE btrim(value) <> ''
        ), '{}');
        IF cardinality(v_meals) > 0 AND v_kind <> 'restaurant' THEN
            RAISE EXCEPTION 'only a restaurant serves meals' USING ERRCODE = '22023';
        END IF;
        INSERT INTO app.listing_details (experience_id) VALUES (p_experience) ON CONFLICT DO NOTHING;
        UPDATE app.listing_details
        SET meal_services = CASE WHEN p_payload ? 'meal_services' THEN v_meals ELSE meal_services END,
            schedule_note = CASE WHEN p_payload ? 'schedule_note'
                                 THEN left(btrim(coalesce(p_payload->>'schedule_note', '')), 280)
                                 ELSE schedule_note END,
            updated_at = now()
        WHERE experience_id = p_experience;
    END IF;
EXCEPTION
    WHEN check_violation THEN
        RAISE EXCEPTION 'meals can be breakfast, brunch, lunch, dinner or late' USING ERRCODE = '22023';
END;
$$;

CREATE FUNCTION app.listing_place_types_json(p_experience uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'place_types', to_jsonb(app.experience_place_type_slugs(p_experience)),
        'roles', to_jsonb(app.experience_roles(p_experience)),
        'meal_services', to_jsonb(coalesce(d.meal_services, '{}')),
        'schedule_note', coalesce(d.schedule_note, '')
    )
    FROM (SELECT p_experience AS id) x
    LEFT JOIN app.listing_details d ON d.experience_id = x.id
$$;

CREATE FUNCTION app.portal_set_place_types(p_user uuid, p_org uuid, p_experience uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'listings');
    IF NOT EXISTS (SELECT 1 FROM app.experiences WHERE id = p_experience AND organization_id = p_org) THEN
        RAISE EXCEPTION 'listing not found' USING ERRCODE = 'P0002';
    END IF;
    PERFORM set_config('app.organization_id', p_org::text, true);
    PERFORM app.set_place_types_unchecked(p_experience, coalesce(p_payload, '{}'::jsonb));
    RETURN app.listing_place_types_json(p_experience);
END;
$$;

CREATE FUNCTION app.portal_get_place_types(p_user uuid, p_org uuid, p_experience uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'listings');
    IF NOT EXISTS (SELECT 1 FROM app.experiences WHERE id = p_experience AND organization_id = p_org) THEN
        RAISE EXCEPTION 'listing not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN app.listing_place_types_json(p_experience);
END;
$$;

CREATE FUNCTION app.admin_set_place_types(p_admin uuid, p_experience uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_org uuid;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT organization_id INTO v_org FROM app.experiences WHERE id = p_experience;
    IF v_org IS NULL THEN
        RAISE EXCEPTION 'listing not found' USING ERRCODE = 'P0002';
    END IF;
    PERFORM set_config('app.organization_id', v_org::text, true);
    PERFORM app.set_place_types_unchecked(p_experience, coalesce(p_payload, '{}'::jsonb));
    RETURN app.listing_place_types_json(p_experience);
END;
$$;

-- How many plannable places each destination has of each kind, so staff check what travellers ask for.
CREATE FUNCTION app.admin_place_type_coverage(p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN jsonb_build_object(
        'place_types', app.place_types_json(),
        'destinations', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'slug', d.slug, 'name', d.name,
                'untyped', (
                    SELECT count(*) FROM app.experiences e JOIN app.venues v ON v.id = e.venue_id
                    WHERE v.destination_id = d.id AND app.planner_step_eligible(e.id)
                      AND NOT EXISTS (SELECT 1 FROM app.experience_place_types ept WHERE ept.experience_id = e.id)
                ),
                'types', coalesce((
                    SELECT jsonb_object_agg(counts.place_type, counts.n)
                    FROM (
                        SELECT ept.place_type, count(*) AS n
                        FROM app.experience_place_types ept
                        JOIN app.experiences e ON e.id = ept.experience_id
                        JOIN app.venues v ON v.id = e.venue_id
                        WHERE v.destination_id = d.id AND app.planner_step_eligible(e.id)
                        GROUP BY ept.place_type
                    ) counts
                ), '{}'::jsonb)
            ) ORDER BY d.name)
            FROM app.destinations d WHERE d.status = 'published'
        ), '[]'::jsonb)
    );
END;
$$;

-- ---- 6. Candidates for one step of a day --------------------------------------------------------
-- The same fields as app.planner_retrieve_candidates (031), so the API reads both with one model.
CREATE FUNCTION app.planner_candidate_json(p_experience uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', e.id, 'slug', e.slug, 'title', e.title, 'description', e.description, 'status', e.status,
        'duration_minutes', e.duration_minutes, 'min_party', e.min_party, 'max_party', e.max_party,
        'setting', e.setting, 'intensity', e.intensity, 'listing_kind', e.listing_kind,
        'inventory_available', e.inventory_available,
        'destination_slug', d.slug, 'destination_name', d.name,
        'venue_id', v.id, 'venue_name', v.name,
        'lat', ST_Y(v.location::geometry), 'lng', ST_X(v.location::geometry),
        'sponsored', EXISTS (SELECT 1 FROM app.planner_sponsorships sp WHERE sp.experience_id = e.id AND sp.active),
        'sponsored_label', (SELECT sp.label FROM app.planner_sponsorships sp WHERE sp.experience_id = e.id AND sp.active),
        'category_slugs', coalesce((
            SELECT jsonb_agg(t.slug ORDER BY t.slug) FROM app.experience_taxonomy et
            JOIN app.taxonomy t ON t.id = et.term_id WHERE et.experience_id = e.id AND t.kind = 'category'
        ), '[]'::jsonb),
        'interest_slugs', coalesce((
            SELECT jsonb_agg(t.slug ORDER BY t.slug) FROM app.experience_taxonomy et
            JOIN app.taxonomy t ON t.id = et.term_id WHERE et.experience_id = e.id AND t.kind IN ('interest', 'tag')
        ), '[]'::jsonb),
        'price', jsonb_build_object(
            'currency', coalesce(pr.currency, 'USD'), 'type', coalesce(pr.price_type, 'from'),
            'source', coalesce(pr.source, 'unknown'), 'amount_minor', pr.amount_minor, 'unit', coalesce(pr.unit, 'person')
        ),
        'hours', coalesce((
            SELECT jsonb_agg(jsonb_build_object('weekday', h.weekday, 'opens', h.opens, 'closes', h.closes)
                             ORDER BY h.weekday)
            FROM app.opening_hours h WHERE h.venue_id = v.id
        ), '[]'::jsonb),
        'exceptions', coalesce((
            SELECT jsonb_agg(jsonb_build_object('local_date', x.local_date, 'closed', x.closed,
                                                'opens', x.opens, 'closes', x.closes))
            FROM app.opening_exceptions x WHERE x.venue_id = v.id
        ), '[]'::jsonb),
        'facts', coalesce(e.catalogue_facts, '[]'::jsonb)
    )
    FROM app.experiences e
    JOIN app.venues v ON v.id = e.venue_id
    JOIN app.destinations d ON d.id = v.destination_id
    LEFT JOIN LATERAL (
        SELECT currency, price_type, source, amount_minor, unit FROM app.current_price_rule(e.id)
    ) pr ON true
    WHERE e.id = p_experience
$$;

-- p_step: {role, tags[], meal, destination_slugs[], near: {lat, lng, radius_m}, party_size, query,
--          exclude_ids[], limit}. Tags that are place types must match; other tags (sea-view, sunset)
-- only rank. With no type tag, any listing that can fill the role qualifies. Nothing is invented:
-- no match returns [].
CREATE FUNCTION app.planner_retrieve_step(p_step jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_role text := p_step->>'role';
    v_meal text := NULLIF(p_step->>'meal', '');
    v_tags text[] := ARRAY(
        SELECT DISTINCT lower(btrim(t))
        FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p_step->'tags') = 'array' THEN p_step->'tags' ELSE '[]' END) t
    );
    v_types text[];
    v_soft text;
    v_q text;
    v_dest text[] := ARRAY(
        SELECT jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(p_step->'destination_slugs') = 'array' THEN p_step->'destination_slugs' ELSE '[]' END)
    );
    v_exclude uuid[];
    v_party integer := NULLIF(p_step->>'party_size', '')::integer;
    v_lat double precision := NULLIF(p_step#>>'{near,lat}', '')::double precision;
    v_lng double precision := NULLIF(p_step#>>'{near,lng}', '')::double precision;
    v_radius integer := least(greatest(coalesce(NULLIF(p_step#>>'{near,radius_m}', '')::integer, 25000), 500), 150000);
    v_limit integer := least(greatest(coalesce(NULLIF(p_step->>'limit', '')::integer, 8), 1), 24);
    v_point geography;
    v_tsq tsquery;
    v_items jsonb;
BEGIN
    IF v_role IS NULL OR v_role NOT IN ('meal', 'sight', 'activity', 'stay', 'service') THEN
        RAISE EXCEPTION 'unknown step role' USING ERRCODE = '22023';
    END IF;
    IF v_meal IS NOT NULL AND v_meal NOT IN ('breakfast', 'brunch', 'lunch', 'dinner', 'snack') THEN
        RAISE EXCEPTION 'unknown meal' USING ERRCODE = '22023';
    END IF;
    IF (v_lat IS NULL) <> (v_lng IS NULL) OR v_lat NOT BETWEEN -90 AND 90 OR v_lng NOT BETWEEN -180 AND 180 THEN
        RAISE EXCEPTION 'near needs both lat and lng' USING ERRCODE = '22023';
    END IF;
    BEGIN
        v_exclude := ARRAY(
            SELECT x::uuid FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(p_step->'exclude_ids') = 'array' THEN p_step->'exclude_ids' ELSE '[]' END) x
        );
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'exclude_ids must be listing ids' USING ERRCODE = '22023';
    END;
    v_types := ARRAY(SELECT t FROM unnest(v_tags) t WHERE EXISTS (
        SELECT 1 FROM app.place_types pt WHERE pt.slug = t AND pt.active));
    v_soft := (SELECT string_agg(replace(t, '-', ' '), ' ') FROM unnest(v_tags) t WHERE NOT (t = ANY (v_types)));
    v_q := btrim(concat_ws(' ', NULLIF(btrim(coalesce(p_step->>'query', '')), ''), v_soft));
    IF v_lat IS NOT NULL THEN
        v_point := ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography;
    END IF;
    IF v_q <> '' THEN
        BEGIN
            v_tsq := websearch_to_tsquery('simple', v_q);
        EXCEPTION WHEN OTHERS THEN
            v_tsq := NULL;
        END;
    END IF;

    WITH pool AS (
        SELECT e.id,
               app.experience_place_type_slugs(e.id) AS types,
               app.experience_meal_services(e.id) AS meals,
               CASE WHEN v_point IS NULL THEN NULL ELSE ST_Distance(v.location, v_point) END AS distance_m,
               CASE WHEN v_tsq IS NULL THEN 0::float4
                    ELSE ts_rank_cd(to_tsvector('simple', coalesce(NULLIF(e.search_text, ''), e.title || ' ' || e.description)), v_tsq)
               END AS fts,
               CASE WHEN v_q = '' OR v_q IS NULL OR e.embedding IS NULL THEN 0::float4
                    ELSE (1 - (e.embedding <=> app.stub_embedding(v_q)))
               END AS vec
        FROM app.experiences e
        JOIN app.venues v ON v.id = e.venue_id
        JOIN app.destinations d ON d.id = v.destination_id
        WHERE e.status = 'published'
          AND NOT (e.id = ANY (v_exclude))
          AND (cardinality(v_dest) = 0 OR d.slug = ANY (v_dest))
          AND (v_point IS NULL OR ST_DWithin(v.location, v_point, v_radius))
          AND (v_party IS NULL OR (e.min_party <= v_party AND e.max_party >= v_party))
          AND v_role = ANY (app.experience_roles(e.id))
          AND app.planner_step_eligible(e.id)
    ), fitting AS (
        SELECT p.*,
               (cardinality(v_types) = 0 OR p.types && v_types) AS type_ok,
               (v_meal IS NULL OR v_role <> 'meal' OR v_meal = 'snack' OR cardinality(p.meals) = 0
                OR v_meal = ANY (p.meals) OR (v_meal = 'brunch' AND 'breakfast' = ANY (p.meals))) AS meal_ok,
               (v_role = 'meal' AND v_meal IS NOT NULL AND v_meal <> 'snack' AND cardinality(p.meals) = 0) AS meal_unconfirmed
        FROM pool p
    ), ranked AS (
        SELECT f.*,
               (CASE WHEN v_q = '' OR v_q IS NULL THEN 0 ELSE 0.7 * f.fts + 0.3 * greatest(f.vec, 0) END)
               + (CASE WHEN f.distance_m IS NULL THEN 0 ELSE 1 - least(f.distance_m / v_radius, 1) END)
               + (CASE WHEN cardinality(v_types) > 0 AND f.types[1] = ANY (v_types) THEN 0.25 ELSE 0 END)
               - (CASE WHEN f.meal_unconfirmed THEN 0.2 ELSE 0 END) AS score
        FROM fitting f
        WHERE f.type_ok AND f.meal_ok
    )
    SELECT coalesce(jsonb_agg(item ORDER BY score DESC, id), '[]'::jsonb)
    INTO v_items
    FROM (
        SELECT r.id, r.score,
               app.planner_candidate_json(r.id) || jsonb_build_object(
                   'fts', r.fts, 'vec', r.vec, 'hybrid', round(r.score::numeric, 4),
                   'distance_m', CASE WHEN r.distance_m IS NULL THEN NULL ELSE round(r.distance_m::numeric) END,
                   'place_types', to_jsonb(r.types),
                   'meal_services', to_jsonb(r.meals),
                   'meal_unconfirmed', r.meal_unconfirmed,
                   'schedule_note', coalesce((SELECT d.schedule_note FROM app.listing_details d WHERE d.experience_id = r.id), ''),
                   'needs_schedule', EXISTS (SELECT 1 FROM app.place_types pt WHERE pt.slug = ANY (r.types) AND pt.needs_schedule),
                   'trust', app.planner_trust_json(r.id)
               ) AS item
        FROM ranked r
        ORDER BY r.score DESC, r.id
        LIMIT v_limit
    ) q;
    RETURN coalesce(v_items, '[]'::jsonb);
EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'check the numbers in this step' USING ERRCODE = '22023';
END;
$$;

-- ---- Grants ------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION app.set_place_types_unchecked(uuid, jsonb) FROM PUBLIC, mshwar_backend;

GRANT EXECUTE ON FUNCTION
    app.listing_kind_role(text),
    app.experience_place_type_slugs(uuid),
    app.experience_roles(uuid),
    app.experience_meal_services(uuid),
    app.planner_step_eligible(uuid),
    app.planner_trust_json(uuid),
    app.place_types_json(),
    app.listing_place_types_json(uuid),
    app.portal_set_place_types(uuid, uuid, uuid, jsonb),
    app.portal_get_place_types(uuid, uuid, uuid),
    app.admin_set_place_types(uuid, uuid, jsonb),
    app.admin_place_type_coverage(uuid),
    app.planner_candidate_json(uuid),
    app.planner_retrieve_step(jsonb)
TO mshwar_backend;
