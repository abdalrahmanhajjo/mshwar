import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/** Copy for finding things by name: place and guide search, destination and language pickers. */
export type SearchKey =
  | "placeSearch"
  | "placeSearching"
  | "placeNone"
  | "placeHint"
  | "placeChosen"
  | "placeChange"
  | "placeUse"
  | "myLocation"
  | "locating"
  | "locationDenied"
  | "locationOutside"
  | "pinSet"
  | "exactPin"
  | "openMap"
  | "destinationPick"
  | "regionsPick"
  | "regionsHint"
  | "languagesPick"
  | "languageOther"
  | "languageAdd"
  | "guideSearch"
  | "allRegions"
  | "allLanguages"
  | "noGuides"
  | "resultCount"
  | "clearFilters"
  | "requestSearch"
  | "queueSearch"
  | "proposalSearch"
  | "tourSearch"
  | "remove"
  | "noResults"
  | "clearSearch"
  | "regionFilter"
  | "languageFilter";

export const searchCopy: Record<Locale, Record<SearchKey, string>> = {
  en: {
    placeSearch: "Search places by name",
    placeSearching: "Searching…",
    placeNone: "No places match. Try another name, or propose it from Places.",
    placeHint: "Type at least two letters.",
    placeChosen: "Chosen: {title}",
    placeChange: "Change",
    placeUse: "Meet at a place from the catalogue",
    myLocation: "Use my current location",
    locating: "Finding you…",
    locationDenied: "Couldn’t read your location. Pick a place or enter the pin.",
    locationOutside: "That location is outside Lebanon.",
    pinSet: "Pin set: {lat}, {lng}",
    exactPin: "Exact pin (optional)",
    openMap: "Check on the map",
    destinationPick: "Choose a destination",
    regionsPick: "Where you guide",
    regionsHint: "Pick every area you know well. Travellers planning there will see you.",
    languagesPick: "Languages you guide in",
    languageOther: "Other language (code, e.g. es)",
    languageAdd: "Add",
    guideSearch: "Search guides by name",
    allRegions: "All areas",
    allLanguages: "Any language",
    noGuides: "No guides match these filters.",
    resultCount: "{n} shown",
    clearFilters: "Clear filters",
    requestSearch: "Search by tour, trip or traveller",
    queueSearch: "Search applications by name",
    proposalSearch: "Search proposals by place or guide",
    tourSearch: "Search your tours",
    remove: "Remove {name}",
    noResults: "Nothing matches that search.",
    clearSearch: "Clear search",
    regionFilter: "Area",
    languageFilter: "Language",
  },
  ar: {
    placeSearch: "ابحث عن الأماكن بالاسم",
    placeSearching: "جارٍ البحث…",
    placeNone: "لا أماكن مطابقة. جرّب اسمًا آخر أو اقترحه من شاشة الأماكن.",
    placeHint: "اكتب حرفين على الأقل.",
    placeChosen: "المختار: {title}",
    placeChange: "غيّر",
    placeUse: "اللقاء عند مكان من الدليل",
    myLocation: "استخدم موقعي الحالي",
    locating: "جارٍ تحديد موقعك…",
    locationDenied: "تعذّر قراءة موقعك. اختر مكانًا أو أدخل الإحداثيات.",
    locationOutside: "هذا الموقع خارج لبنان.",
    pinSet: "تم تحديد الموقع: {lat}، {lng}",
    exactPin: "الإحداثيات الدقيقة (اختياري)",
    openMap: "تحقّق على الخريطة",
    destinationPick: "اختر وجهة",
    regionsPick: "أين ترشد",
    regionsHint: "اختر كل منطقة تعرفها جيدًا. سيراك المسافرون الذين يخطّطون فيها.",
    languagesPick: "اللغات التي ترشد بها",
    languageOther: "لغة أخرى (رمز، مثل es)",
    languageAdd: "أضف",
    guideSearch: "ابحث عن المرشدين بالاسم",
    allRegions: "كل المناطق",
    allLanguages: "أي لغة",
    noGuides: "لا مرشدين يطابقون هذه المرشِّحات.",
    resultCount: "{n} معروض",
    clearFilters: "امسح المرشِّحات",
    requestSearch: "ابحث بالجولة أو الرحلة أو المسافر",
    queueSearch: "ابحث في الطلبات بالاسم",
    proposalSearch: "ابحث في الاقتراحات بالمكان أو المرشد",
    tourSearch: "ابحث في جولاتك",
    remove: "احذف {name}",
    noResults: "لا شيء يطابق هذا البحث.",
    clearSearch: "امسح البحث",
    regionFilter: "المنطقة",
    languageFilter: "اللغة",
  },
  fr: {
    placeSearch: "Rechercher un lieu par son nom",
    placeSearching: "Recherche…",
    placeNone: "Aucun lieu ne correspond. Essayez un autre nom, ou proposez-le depuis Lieux.",
    placeHint: "Tapez au moins deux lettres.",
    placeChosen: "Choisi : {title}",
    placeChange: "Changer",
    placeUse: "Se retrouver à un lieu du catalogue",
    myLocation: "Utiliser ma position",
    locating: "Localisation…",
    locationDenied: "Position introuvable. Choisissez un lieu ou saisissez le repère.",
    locationOutside: "Cette position est hors du Liban.",
    pinSet: "Repère : {lat}, {lng}",
    exactPin: "Repère exact (facultatif)",
    openMap: "Voir sur la carte",
    destinationPick: "Choisir une destination",
    regionsPick: "Où vous guidez",
    regionsHint: "Choisissez chaque zone que vous connaissez bien. Les voyageurs qui y planifient vous verront.",
    languagesPick: "Langues dans lesquelles vous guidez",
    languageOther: "Autre langue (code, ex. es)",
    languageAdd: "Ajouter",
    guideSearch: "Rechercher un guide par son nom",
    allRegions: "Toutes les zones",
    allLanguages: "Toutes langues",
    noGuides: "Aucun guide ne correspond à ces filtres.",
    resultCount: "{n} affiché(s)",
    clearFilters: "Effacer les filtres",
    requestSearch: "Rechercher par circuit, voyage ou voyageur",
    queueSearch: "Rechercher une candidature par nom",
    proposalSearch: "Rechercher par lieu ou guide",
    tourSearch: "Rechercher vos circuits",
    remove: "Retirer {name}",
    noResults: "Rien ne correspond à cette recherche.",
    clearSearch: "Effacer la recherche",
    regionFilter: "Région",
    languageFilter: "Langue",
  },
};

export type SearchCopy = Record<SearchKey, string>;

export function useSearchCopy(): SearchCopy {
  const { locale } = useLocale();
  return searchCopy[locale];
}
