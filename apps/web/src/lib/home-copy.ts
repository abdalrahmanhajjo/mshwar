import { useLocale } from "@/components/shell/locale-provider";
import type { Locale } from "@/lib/locale";

/** Copy for the traveller homepage and the traveller header / footer. */
export type HomeKey =
  | "planYourTrip"
  | "findAGuide"
  | "heroEyebrow"
  | "heroTitleLead"
  | "heroTitleAccent"
  | "heroTitleTail"
  | "heroBody"
  | "heroPhotoCredit"
  | "searchLabel"
  | "searchWhere"
  | "searchWhereAny"
  | "searchWhen"
  | "searchWhenAny"
  | "searchGuests"
  | "searchGuestsValue"
  | "searchGuestsOne"
  | "searchType"
  | "searchTypeAny"
  | "searchSubmit"
  | "whyTitle"
  | "why1Title"
  | "why1Body"
  | "why2Title"
  | "why2Body"
  | "why3Title"
  | "why3Body"
  | "why4Title"
  | "why4Body"
  | "moodKicker"
  | "moodTitle"
  | "moodAll"
  | "moodAllLine"
  | "moodNature"
  | "moodNatureLine"
  | "moodCoast"
  | "moodCoastLine"
  | "moodCulture"
  | "moodCultureLine"
  | "moodAdventure"
  | "moodAdventureLine"
  | "moodCity"
  | "moodCityLine"
  | "moodFood"
  | "moodFoodLine"
  | "mapKicker"
  | "mapTitleLead"
  | "mapTitleAccent"
  | "mapBody"
  | "mapStatPlaces"
  | "mapStatRegions"
  | "mapHint"
  | "mapOpenFull"
  | "mapAll"
  | "mapLabel"
  | "mapPin"
  | "mapSea"
  | "mapBeirut"
  | "mapTripoli"
  | "mapBaalbek"
  | "mapTyre"
  | "mapPreview"
  | "cardViewDetails"
  | "cardUpTo"
  | "cardRating"
  | "plannerKicker"
  | "plannerTitleLead"
  | "plannerTitleAccent"
  | "plannerBody"
  | "plannerBenefit1"
  | "plannerBenefit2"
  | "plannerBenefit3"
  | "plannerSecondary"
  | "plannerCardDay"
  | "plannerCardStops"
  | "plannerStop1"
  | "plannerStop1Place"
  | "plannerStop2"
  | "plannerStop2Place"
  | "plannerStop3"
  | "plannerStop3Place"
  | "plannerStop4"
  | "plannerStop4Place"
  | "plannerDrive"
  | "plannerCardNote"
  | "plannerCardFits"
  | "destKicker"
  | "destTitle"
  | "destAll"
  | "storyKicker"
  | "storyTitle"
  | "storyBody"
  | "storyNote"
  | "storyCta"
  | "reviewsKicker"
  | "reviewsVerified"
  | "reviewsOn"
  | "reviewsPrev"
  | "reviewsNext"
  | "reviewsOf"
  | "inspiredTitle"
  | "inspiredBody"
  | "inspiredEmail"
  | "inspiredCta"
  | "inspiredNote"
  | "footerExplore"
  | "footerPlan"
  | "footerWork"
  | "footerHelp"
  | "footerLanguage"
  | "footerNav";

export const homeCopy: Record<Locale, Record<HomeKey, string>> = {
  en: {
    planYourTrip: "Plan your trip",
    findAGuide: "Find a guide",
    heroEyebrow: "Mountains, coast, cities and villages",
    heroTitleLead: "Find your next",
    heroTitleAccent: "chapter",
    heroTitleTail: "in Lebanon.",
    heroBody: "Real places, honest prices and a planner that builds the day around you — from the cedars to the sea.",
    heroPhotoCredit: "Baalbek, Bekaa Valley",
    searchLabel: "Search experiences",
    searchWhere: "Where",
    searchWhereAny: "Anywhere in Lebanon",
    searchWhen: "When",
    searchWhenAny: "Any date",
    searchGuests: "Guests",
    searchGuestsValue: "{n} guests",
    searchGuestsOne: "1 guest",
    searchType: "Experience",
    searchTypeAny: "Any kind",
    searchSubmit: "Search",
    whyTitle: "Why Mshwar",
    why1Title: "Real, sourced places",
    why1Body: "Every listing has its source on record.",
    why2Title: "All of Lebanon",
    why2Body: "Mountains, coast, cities and villages.",
    why3Title: "Honest prices",
    why3Body: "Published, or “on request” — never guessed.",
    why4Title: "At your pace",
    why4Body: "Plan with AI, or build the day yourself.",
    moodKicker: "Explore by mood",
    moodTitle: "What are you in the mood for?",
    moodAll: "All experiences",
    moodAllLine: "Everything that’s published, in one place",
    moodNature: "Nature",
    moodNatureLine: "Cedars, valleys and trails",
    moodCoast: "Coast",
    moodCoastLine: "Old harbours and sea air",
    moodCulture: "Culture",
    moodCultureLine: "Temples, souks and stone lanes",
    moodAdventure: "Adventure",
    moodAdventureLine: "Gorges, caves and long walks",
    moodCity: "Cities",
    moodCityLine: "Streets that stay up late",
    moodFood: "Food & drink",
    moodFoodLine: "Sweets, mezze and long lunches",
    mapKicker: "Explore on the map",
    mapTitleLead: "All of Lebanon,",
    mapTitleAccent: "one map away.",
    mapBody:
      "From the coast to the Bekaa, every place on Mshwar sits where it really is. Tap a pin to see it, zoom into any town, then plan the drive.",
    mapStatPlaces: "places on the map",
    mapStatRegions: "regions",
    mapHint: "Tap a pin to see the place",
    mapOpenFull: "Open the full map",
    mapAll: "See all experiences",
    mapLabel: "Map of places across Lebanon",
    mapPin: "{title}, {place}",
    mapSea: "Mediterranean Sea",
    mapBeirut: "Beirut",
    mapTripoli: "Tripoli",
    mapBaalbek: "Baalbek",
    mapTyre: "Tyre",
    mapPreview: "Preview of Lebanon with the places on Mshwar",
    cardViewDetails: "View details",
    cardUpTo: "Up to {n} people",
    cardRating: "Rated {n} out of 5",
    plannerKicker: "Trip planner",
    plannerTitleLead: "Your trip to Lebanon,",
    plannerTitleAccent: "made simple.",
    plannerBody:
      "Describe the day you want, or pick the places yourself. Mshwar puts the stops in order, checks opening hours and drive times, and keeps the plan when you’re happy with it.",
    plannerBenefit1: "Plan in English, Arabic or French",
    plannerBenefit2: "Best order and drive times worked out",
    plannerBenefit3: "Saved only when you confirm",
    plannerSecondary: "Build it myself",
    plannerCardDay: "Sunday",
    plannerCardStops: "4 stops",
    plannerStop1: "Coffee with a mountain view",
    plannerStop1Place: "Mount Lebanon",
    plannerStop2: "A walk through an old village",
    plannerStop2Place: "Batroun district",
    plannerStop3: "Lunch somewhere local",
    plannerStop3Place: "Batroun",
    plannerStop4: "Sunset by the sea",
    plannerStop4Place: "Batroun coast",
    plannerDrive: "{n} min drive",
    plannerCardNote: "An example day. Your plan uses real places and real opening hours.",
    plannerCardFits: "This day works",
    destKicker: "Destinations",
    destTitle: "Discover Lebanon’s destinations",
    destAll: "All destinations",
    storyKicker: "One small country",
    storyTitle: "Different sides of the same home.",
    storyBody:
      "Morning among Roman columns, lunch by a Phoenician harbour, evening in a mountain village. Lebanon fits a lot into one day — Mshwar helps you choose what goes in yours.",
    storyNote: "all within a few hours’ drive",
    storyCta: "Start with a feeling",
    reviewsKicker: "From travellers",
    reviewsVerified: "Verified booking",
    reviewsOn: "on {title}",
    reviewsPrev: "Previous story",
    reviewsNext: "Next story",
    reviewsOf: "{n} of {total}",
    inspiredTitle: "Stay inspired.",
    inspiredBody:
      "New places, destination ideas and local stories. Create a free account and choose to hear from us — you can stop any time.",
    inspiredEmail: "Email address",
    inspiredCta: "Continue",
    inspiredNote: "Nothing is sent unless you choose it.",
    footerExplore: "Explore",
    footerPlan: "Plan",
    footerWork: "Work with us",
    footerHelp: "Help",
    footerLanguage: "Language",
    footerNav: "Site links",
  },
  ar: {
    planYourTrip: "خطّط لرحلتك",
    findAGuide: "اختر مرشدك",
    heroEyebrow: "جبال، ساحل، مدن وقرى",
    heroTitleLead: "اكتشف",
    heroTitleAccent: "فصلك",
    heroTitleTail: "التالي في لبنان.",
    heroBody: "أماكن حقيقية، أسعار واضحة، ومخطِّط يبني يومك على مقاسك — من الأرز إلى البحر.",
    heroPhotoCredit: "بعلبك، البقاع",
    searchLabel: "ابحث عن تجارب",
    searchWhere: "إلى أين",
    searchWhereAny: "أي مكان في لبنان",
    searchWhen: "متى",
    searchWhenAny: "أي تاريخ",
    searchGuests: "الضيوف",
    searchGuestsValue: "{n} ضيوف",
    searchGuestsOne: "ضيف واحد",
    searchType: "التجربة",
    searchTypeAny: "أي نوع",
    searchSubmit: "ابحث",
    whyTitle: "لماذا مشوار",
    why1Title: "أماكن حقيقية وموثّقة",
    why1Body: "لكل مكان مصدر مسجَّل.",
    why2Title: "لبنان كلّه",
    why2Body: "جبال وساحل ومدن وقرى.",
    why3Title: "أسعار صادقة",
    why3Body: "منشورة، أو «عند الطلب» — لا تخمين.",
    why4Title: "على راحتك",
    why4Body: "خطّط بالذكاء الاصطناعي، أو ابنِ يومك بنفسك.",
    moodKicker: "اكتشف حسب مزاجك",
    moodTitle: "شو جوّك اليوم؟",
    moodAll: "كل التجارب",
    moodAllLine: "كل ما هو منشور، في مكان واحد",
    moodNature: "طبيعة",
    moodNatureLine: "أرز ووديان ومسارات",
    moodCoast: "ساحل",
    moodCoastLine: "موانئ قديمة وهواء البحر",
    moodCulture: "ثقافة",
    moodCultureLine: "معابد وأسواق وأزقّة حجرية",
    moodAdventure: "مغامرة",
    moodAdventureLine: "وديان ومغاور ومشي طويل",
    moodCity: "مدن",
    moodCityLine: "شوارع تسهر حتى الصباح",
    moodFood: "أكل وشرب",
    moodFoodLine: "حلويات ومازة وغداء طويل",
    mapKicker: "استكشف على الخريطة",
    mapTitleLead: "لبنان كلّه،",
    mapTitleAccent: "على خريطة واحدة.",
    mapBody:
      "من الساحل إلى البقاع، كل مكان على مشوار في موقعه الحقيقي. اضغط على علامة لترى المكان، وقرّب على أي بلدة، ثم خطّط للطريق.",
    mapStatPlaces: "مكانًا على الخريطة",
    mapStatRegions: "مناطق",
    mapHint: "اضغط على علامة لترى المكان",
    mapOpenFull: "افتح الخريطة الكاملة",
    mapAll: "كل التجارب",
    mapLabel: "خريطة الأماكن في لبنان",
    mapPin: "{title}، {place}",
    mapSea: "البحر المتوسط",
    mapBeirut: "بيروت",
    mapTripoli: "طرابلس",
    mapBaalbek: "بعلبك",
    mapTyre: "صور",
    mapPreview: "معاينة لبنان مع الأماكن على مشوار",
    cardViewDetails: "عرض التفاصيل",
    cardUpTo: "حتى {n} أشخاص",
    cardRating: "التقييم {n} من 5",
    plannerKicker: "مخطِّط الرحلات",
    plannerTitleLead: "رحلتك إلى لبنان،",
    plannerTitleAccent: "بكل بساطة.",
    plannerBody:
      "صِف اليوم الذي تريده، أو اختر الأماكن بنفسك. يرتّب مشوار المحطات، ويتحقق من أوقات العمل ومدة القيادة، ويحفظ الخطة حين ترضى عنها.",
    plannerBenefit1: "خطّط بالعربية أو الإنجليزية أو الفرنسية",
    plannerBenefit2: "أفضل ترتيب ومدة القيادة محسوبة",
    plannerBenefit3: "لا تُحفظ إلا بعد تأكيدك",
    plannerSecondary: "سأبنيها بنفسي",
    plannerCardDay: "الأحد",
    plannerCardStops: "4 محطات",
    plannerStop1: "قهوة مطلّة على الجبل",
    plannerStop1Place: "جبل لبنان",
    plannerStop2: "مشي في قرية قديمة",
    plannerStop2Place: "قضاء البترون",
    plannerStop3: "غداء في مكان محلّي",
    plannerStop3Place: "البترون",
    plannerStop4: "غروب على البحر",
    plannerStop4Place: "ساحل البترون",
    plannerDrive: "{n} دقيقة بالسيارة",
    plannerCardNote: "يوم على سبيل المثال. خطتك تستخدم أماكن حقيقية وأوقات عمل حقيقية.",
    plannerCardFits: "هذا اليوم ممكن",
    destKicker: "الوجهات",
    destTitle: "اكتشف وجهات لبنان",
    destAll: "كل الوجهات",
    storyKicker: "بلد صغير",
    storyTitle: "وجوه مختلفة لبيت واحد.",
    storyBody:
      "صباح بين أعمدة رومانية، غداء قرب ميناء فينيقي، ومساء في قرية جبلية. لبنان يتّسع لكثير في يوم واحد — ومشوار يساعدك تختار ما يدخل في يومك.",
    storyNote: "وكلّها على بُعد ساعات قليلة بالسيارة",
    storyCta: "ابدأ بشعور",
    reviewsKicker: "من المسافرين",
    reviewsVerified: "حجز موثّق",
    reviewsOn: "عن {title}",
    reviewsPrev: "القصة السابقة",
    reviewsNext: "القصة التالية",
    reviewsOf: "{n} من {total}",
    inspiredTitle: "ابقَ على اطّلاع.",
    inspiredBody: "أماكن جديدة، أفكار لوجهات، وقصص محلية. أنشئ حساباً مجانياً واختر أن نراسلك — ويمكنك التوقف متى شئت.",
    inspiredEmail: "البريد الإلكتروني",
    inspiredCta: "متابعة",
    inspiredNote: "لا نرسل شيئاً إلا إذا اخترت ذلك.",
    footerExplore: "استكشف",
    footerPlan: "خطّط",
    footerWork: "اعمل معنا",
    footerHelp: "المساعدة",
    footerLanguage: "اللغة",
    footerNav: "روابط الموقع",
  },
  fr: {
    planYourTrip: "Planifier mon voyage",
    findAGuide: "Trouver un guide",
    heroEyebrow: "Montagnes, côte, villes et villages",
    heroTitleLead: "Écrivez votre prochain",
    heroTitleAccent: "chapitre",
    heroTitleTail: "au Liban.",
    heroBody:
      "De vrais lieux, des prix honnêtes et un planificateur qui construit la journée autour de vous — des cèdres jusqu’à la mer.",
    heroPhotoCredit: "Baalbek, vallée de la Békaa",
    searchLabel: "Rechercher des expériences",
    searchWhere: "Où",
    searchWhereAny: "Partout au Liban",
    searchWhen: "Quand",
    searchWhenAny: "N’importe quand",
    searchGuests: "Voyageurs",
    searchGuestsValue: "{n} voyageurs",
    searchGuestsOne: "1 voyageur",
    searchType: "Expérience",
    searchTypeAny: "Tous types",
    searchSubmit: "Rechercher",
    whyTitle: "Pourquoi Mshwar",
    why1Title: "Des lieux réels et sourcés",
    why1Body: "Chaque fiche a sa source enregistrée.",
    why2Title: "Tout le Liban",
    why2Body: "Montagnes, côte, villes et villages.",
    why3Title: "Des prix honnêtes",
    why3Body: "Publiés, ou « sur demande » — jamais devinés.",
    why4Title: "À votre rythme",
    why4Body: "Planifiez avec l’IA, ou composez la journée vous-même.",
    moodKicker: "Explorer selon l’envie",
    moodTitle: "De quoi avez-vous envie ?",
    moodAll: "Toutes les expériences",
    moodAllLine: "Tout ce qui est publié, au même endroit",
    moodNature: "Nature",
    moodNatureLine: "Cèdres, vallées et sentiers",
    moodCoast: "Côte",
    moodCoastLine: "Vieux ports et air marin",
    moodCulture: "Culture",
    moodCultureLine: "Temples, souks et ruelles de pierre",
    moodAdventure: "Aventure",
    moodAdventureLine: "Gorges, grottes et longues marches",
    moodCity: "Villes",
    moodCityLine: "Des rues qui veillent tard",
    moodFood: "Cuisine",
    moodFoodLine: "Douceurs, mezzés et longs déjeuners",
    mapKicker: "Explorer sur la carte",
    mapTitleLead: "Tout le Liban,",
    mapTitleAccent: "sur une seule carte.",
    mapBody:
      "De la côte à la Békaa, chaque lieu de Mshwar est placé là où il se trouve vraiment. Touchez un repère pour le voir, zoomez sur une ville, puis préparez la route.",
    mapStatPlaces: "lieux sur la carte",
    mapStatRegions: "régions",
    mapHint: "Touchez un repère pour voir le lieu",
    mapOpenFull: "Ouvrir la carte complète",
    mapAll: "Toutes les expériences",
    mapLabel: "Carte des lieux au Liban",
    mapPin: "{title}, {place}",
    mapSea: "Mer Méditerranée",
    mapBeirut: "Beyrouth",
    mapTripoli: "Tripoli",
    mapBaalbek: "Baalbek",
    mapTyre: "Tyr",
    mapPreview: "Aperçu du Liban avec les lieux de Mshwar",
    cardViewDetails: "Voir les détails",
    cardUpTo: "Jusqu’à {n} personnes",
    cardRating: "Noté {n} sur 5",
    plannerKicker: "Planificateur",
    plannerTitleLead: "Votre voyage au Liban,",
    plannerTitleAccent: "tout simplement.",
    plannerBody:
      "Décrivez la journée que vous voulez, ou choisissez les lieux vous-même. Mshwar ordonne les étapes, vérifie les horaires et les trajets, et garde le plan quand il vous convient.",
    plannerBenefit1: "En français, en anglais ou en arabe",
    plannerBenefit2: "Meilleur ordre et temps de trajet calculés",
    plannerBenefit3: "Enregistré seulement après confirmation",
    plannerSecondary: "Le composer moi-même",
    plannerCardDay: "Dimanche",
    plannerCardStops: "4 étapes",
    plannerStop1: "Un café face à la montagne",
    plannerStop1Place: "Mont-Liban",
    plannerStop2: "Balade dans un vieux village",
    plannerStop2Place: "Caza de Batroun",
    plannerStop3: "Déjeuner dans une adresse locale",
    plannerStop3Place: "Batroun",
    plannerStop4: "Coucher de soleil sur la mer",
    plannerStop4Place: "Côte de Batroun",
    plannerDrive: "{n} min de route",
    plannerCardNote: "Une journée d’exemple. Votre plan utilise de vrais lieux et de vrais horaires.",
    plannerCardFits: "Cette journée tient",
    destKicker: "Destinations",
    destTitle: "Découvrez les destinations du Liban",
    destAll: "Toutes les destinations",
    storyKicker: "Un petit pays",
    storyTitle: "Les visages d’une même maison.",
    storyBody:
      "Le matin parmi les colonnes romaines, le déjeuner près d’un port phénicien, le soir dans un village de montagne. Le Liban tient beaucoup en une journée — Mshwar vous aide à choisir.",
    storyNote: "le tout à quelques heures de route",
    storyCta: "Partir d’une envie",
    reviewsKicker: "Des voyageurs",
    reviewsVerified: "Réservation vérifiée",
    reviewsOn: "sur {title}",
    reviewsPrev: "Récit précédent",
    reviewsNext: "Récit suivant",
    reviewsOf: "{n} sur {total}",
    inspiredTitle: "Restez inspiré.",
    inspiredBody:
      "Nouveaux lieux, idées de destinations et histoires locales. Créez un compte gratuit et choisissez de recevoir nos nouvelles — arrêt possible à tout moment.",
    inspiredEmail: "Adresse e-mail",
    inspiredCta: "Continuer",
    inspiredNote: "Rien n’est envoyé sans votre choix.",
    footerExplore: "Explorer",
    footerPlan: "Planifier",
    footerWork: "Travailler avec nous",
    footerHelp: "Aide",
    footerLanguage: "Langue",
    footerNav: "Liens du site",
  },
};

export function useHomeCopy() {
  const { locale } = useLocale();
  return homeCopy[locale];
}
