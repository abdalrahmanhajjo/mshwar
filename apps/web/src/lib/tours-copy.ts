import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/** Copy for the tours marketplace, tour pages and destination tour sections (guide plan step 4). */
export type ToursKey =
  | "metaTitle"
  | "metaDescription"
  | "kicker"
  | "title"
  | "body"
  | "search"
  | "searchPlaceholder"
  | "destination"
  | "anyDestination"
  | "date"
  | "language"
  | "anyLanguage"
  | "duration"
  | "anyDuration"
  | "upTo2h"
  | "upTo4h"
  | "upToDay"
  | "maxPrice"
  | "instantOnly"
  | "sort"
  | "sortrecommended"
  | "sortprice"
  | "sortduration"
  | "sortsoonest"
  | "apply"
  | "reset"
  | "results"
  | "resultsOne"
  | "empty"
  | "unavailable"
  | "listView"
  | "mapView"
  | "mapLabel"
  | "mapError"
  | "perPerson"
  | "perGroup"
  | "free"
  | "fromPrice"
  | "hours"
  | "minutes"
  | "nextDate"
  | "noDates"
  | "instant"
  | "reviewsCount"
  | "reviewsCountOne"
  | "noReviewsYet"
  | "byGuide"
  | "founding"
  | "licensed"
  | "localHost"
  | "crumbTours"
  | "highlights"
  | "about"
  | "route"
  | "routeHint"
  | "meeting"
  | "included"
  | "bring"
  | "accessibility"
  | "languages"
  | "groupSize"
  | "upToPeople"
  | "faq"
  | "guideTitle"
  | "seeGuide"
  | "reviewsTitle"
  | "noReviews"
  | "checkAvailability"
  | "paidOnDay"
  | "destinationTitle"
  | "destinationBody"
  | "seeAll"
  | "browseTours"
  | "photoFallback"
  | "contentTitle"
  | "contentBody"
  | "contentHighlights"
  | "contentHighlightsHint"
  | "contentFaq"
  | "contentQuestion"
  | "contentAnswer"
  | "contentAddQuestion"
  | "contentRemoveQuestion"
  | "contentAccessibility"
  | "contentAccessibilityHint"
  | "contentSave"
  | "contentSaved"
  | "viewPage";

export type ToursCopy = Record<ToursKey, string>;

export const toursCopy: Record<Locale, ToursCopy> = {
  en: {
    metaTitle: "Guided tours in Lebanon with local guides",
    metaDescription:
      "Small-group and private tours across Lebanon with licensed guides and local hosts. Choose a date, see the full price, pay your guide on the day.",
    kicker: "Guided tours",
    title: "Tours with the people who know Lebanon best",
    body: "Walks, hikes and food tours by licensed guides and local hosts. Pick a date, see the whole price, and pay your guide on the day.",
    search: "Search",
    searchPlaceholder: "Byblos, food, hiking…",
    destination: "Where",
    anyDestination: "Anywhere",
    date: "Date",
    language: "Language",
    anyLanguage: "Any language",
    duration: "Length",
    anyDuration: "Any length",
    upTo2h: "Up to 2 hours",
    upTo4h: "Up to 4 hours",
    upToDay: "Up to a full day",
    maxPrice: "Max price (USD)",
    instantOnly: "Instant confirmation only",
    sort: "Sort",
    sortrecommended: "Recommended",
    sortprice: "Price: low to high",
    sortduration: "Shortest first",
    sortsoonest: "Soonest date",
    apply: "Show tours",
    reset: "Clear filters",
    results: "{n} tours",
    resultsOne: "1 tour",
    empty: "No tours match these filters yet. Try fewer filters.",
    unavailable: "Tours can't be shown right now. Please try again soon.",
    listView: "List",
    mapView: "Map",
    mapLabel: "Map of tours",
    mapError: "The map couldn't load. The list below has every tour.",
    perPerson: "per person",
    perGroup: "per group",
    free: "Free",
    fromPrice: "From {price}",
    hours: "{n} h",
    minutes: "{n} min",
    nextDate: "Next date: {date}",
    noDates: "No open dates yet",
    instant: "Instant confirmation",
    reviewsCount: "{avg} · {n} reviews",
    reviewsCountOne: "{avg} · 1 review",
    noReviewsYet: "No reviews yet",
    byGuide: "with {name}",
    founding: "Founding Guide #{n}",
    licensed: "Licensed guide",
    localHost: "Local host",
    crumbTours: "Tours",
    highlights: "Highlights",
    about: "About this tour",
    route: "The route",
    routeHint: "The places on the tour, in order, from the meeting point.",
    meeting: "Meeting point",
    included: "What's included",
    bring: "What to bring",
    accessibility: "Accessibility",
    languages: "Languages",
    groupSize: "Group size",
    upToPeople: "Up to {n} people",
    faq: "Questions",
    guideTitle: "Your guide",
    seeGuide: "See {name}'s page",
    reviewsTitle: "What travellers say about {name}",
    noReviews: "No reviews yet. Reviews appear after completed tours, from both sides at once.",
    checkAvailability: "Check availability",
    paidOnDay: "Paid on the day, to your guide",
    destinationTitle: "Guided tours in {name}",
    destinationBody: "Walk it with someone who lives it: tours that start here.",
    seeAll: "See all tours",
    browseTours: "Browse tours",
    photoFallback: "No photo yet",
    contentTitle: "Tour page",
    contentBody: "What travellers read before they book. Only write what is true for every run.",
    contentHighlights: "Highlights (one per line, up to 8)",
    contentHighlightsHint: "Short and concrete: a place, a taste, a view.",
    contentFaq: "Questions and answers",
    contentQuestion: "Question",
    contentAnswer: "Answer",
    contentAddQuestion: "Add a question",
    contentRemoveQuestion: "Remove question {n}",
    contentAccessibility: "Accessibility",
    contentAccessibilityHint: "Steps, slopes, rest stops, whether a stroller or wheelchair can come.",
    contentSave: "Save tour page",
    contentSaved: "Tour page saved.",
    viewPage: "View page",
  },
  ar: {
    metaTitle: "جولات مع مرشدين محليين في لبنان",
    metaDescription:
      "جولات بمجموعات صغيرة وجولات خاصة في كل لبنان مع مرشدين مرخّصين ومضيفين محليين. اختر موعداً، اطّلع على السعر كاملاً، وادفع للمرشد يوم الجولة.",
    kicker: "جولات مع مرشد",
    title: "جولات مع أكثر من يعرف لبنان",
    body: "نزهات ومسارات وجولات طعام مع مرشدين مرخّصين ومضيفين محليين. اختر موعداً، اطّلع على السعر كاملاً، وادفع للمرشد يوم الجولة.",
    search: "بحث",
    searchPlaceholder: "جبيل، طعام، مشي…",
    destination: "أين",
    anyDestination: "في أي مكان",
    date: "التاريخ",
    language: "اللغة",
    anyLanguage: "أي لغة",
    duration: "المدة",
    anyDuration: "أي مدة",
    upTo2h: "حتى ساعتين",
    upTo4h: "حتى 4 ساعات",
    upToDay: "حتى يوم كامل",
    maxPrice: "أعلى سعر (بالدولار)",
    instantOnly: "تأكيد فوري فقط",
    sort: "الترتيب",
    sortrecommended: "المقترح",
    sortprice: "السعر: من الأقل",
    sortduration: "الأقصر أولاً",
    sortsoonest: "الأقرب موعداً",
    apply: "عرض الجولات",
    reset: "مسح الفلاتر",
    results: "{n} جولات",
    resultsOne: "جولة واحدة",
    empty: "لا جولات تطابق هذه الفلاتر بعد. جرّب فلاتر أقل.",
    unavailable: "تعذّر عرض الجولات الآن. حاول بعد قليل.",
    listView: "قائمة",
    mapView: "خريطة",
    mapLabel: "خريطة الجولات",
    mapError: "تعذّر تحميل الخريطة. القائمة أدناه فيها كل الجولات.",
    perPerson: "للشخص",
    perGroup: "للمجموعة",
    free: "مجاناً",
    fromPrice: "ابتداءً من {price}",
    hours: "{n} س",
    minutes: "{n} د",
    nextDate: "الموعد التالي: {date}",
    noDates: "لا مواعيد متاحة بعد",
    instant: "تأكيد فوري",
    reviewsCount: "{avg} · {n} تقييمات",
    reviewsCountOne: "{avg} · تقييم واحد",
    noReviewsYet: "لا تقييمات بعد",
    byGuide: "مع {name}",
    founding: "مرشد مؤسّس رقم {n}",
    licensed: "مرشد مرخّص",
    localHost: "مضيف محلي",
    crumbTours: "الجولات",
    highlights: "أبرز ما في الجولة",
    about: "عن هذه الجولة",
    route: "المسار",
    routeHint: "أماكن الجولة بالترتيب، انطلاقاً من نقطة اللقاء.",
    meeting: "نقطة اللقاء",
    included: "ما يشمله السعر",
    bring: "ما يجب إحضاره",
    accessibility: "سهولة الوصول",
    languages: "اللغات",
    groupSize: "حجم المجموعة",
    upToPeople: "حتى {n} أشخاص",
    faq: "أسئلة",
    guideTitle: "مرشدك",
    seeGuide: "صفحة {name}",
    reviewsTitle: "ماذا يقول المسافرون عن {name}",
    noReviews: "لا تقييمات بعد. تظهر التقييمات بعد الجولات المكتملة، من الطرفين معاً.",
    checkAvailability: "تحقّق من المواعيد",
    paidOnDay: "يُدفع يوم الجولة للمرشد",
    destinationTitle: "جولات مع مرشد في {name}",
    destinationBody: "امشِ فيها مع من يعيش فيها: جولات تنطلق من هنا.",
    seeAll: "كل الجولات",
    browseTours: "تصفّح الجولات",
    photoFallback: "لا صورة بعد",
    contentTitle: "صفحة الجولة",
    contentBody: "ما يقرؤه المسافرون قبل الحجز. اكتب فقط ما يصحّ في كل جولة.",
    contentHighlights: "أبرز ما فيها (سطر لكل نقطة، حتى 8)",
    contentHighlightsHint: "قصيرة وملموسة: مكان، طعم، منظر.",
    contentFaq: "أسئلة وأجوبة",
    contentQuestion: "السؤال",
    contentAnswer: "الجواب",
    contentAddQuestion: "أضف سؤالاً",
    contentRemoveQuestion: "إزالة السؤال {n}",
    contentAccessibility: "سهولة الوصول",
    contentAccessibilityHint: "الدرج، المنحدرات، أماكن الاستراحة، وهل يمكن إحضار عربة أطفال أو كرسي متحرك.",
    contentSave: "حفظ صفحة الجولة",
    contentSaved: "حُفظت صفحة الجولة.",
    viewPage: "عرض الصفحة",
  },
  fr: {
    metaTitle: "Visites guidées au Liban avec des guides locaux",
    metaDescription:
      "Visites en petit groupe ou privées partout au Liban avec des guides agréés et des hôtes locaux. Choisissez une date, voyez le prix complet, payez votre guide le jour même.",
    kicker: "Visites guidées",
    title: "Des visites avec ceux qui connaissent le mieux le Liban",
    body: "Balades, randonnées et visites gourmandes avec des guides agréés et des hôtes locaux. Choisissez une date, voyez le prix complet et payez votre guide le jour même.",
    search: "Rechercher",
    searchPlaceholder: "Byblos, cuisine, randonnée…",
    destination: "Où",
    anyDestination: "Partout",
    date: "Date",
    language: "Langue",
    anyLanguage: "Toutes les langues",
    duration: "Durée",
    anyDuration: "Toute durée",
    upTo2h: "Jusqu'à 2 heures",
    upTo4h: "Jusqu'à 4 heures",
    upToDay: "Jusqu'à une journée",
    maxPrice: "Prix max (USD)",
    instantOnly: "Confirmation immédiate uniquement",
    sort: "Trier",
    sortrecommended: "Recommandées",
    sortprice: "Prix croissant",
    sortduration: "Plus courtes d'abord",
    sortsoonest: "Date la plus proche",
    apply: "Voir les visites",
    reset: "Effacer les filtres",
    results: "{n} visites",
    resultsOne: "1 visite",
    empty: "Aucune visite ne correspond encore. Essayez moins de filtres.",
    unavailable: "Les visites ne peuvent pas être affichées. Réessayez bientôt.",
    listView: "Liste",
    mapView: "Carte",
    mapLabel: "Carte des visites",
    mapError: "La carte n'a pas pu se charger. La liste ci-dessous contient toutes les visites.",
    perPerson: "par personne",
    perGroup: "par groupe",
    free: "Gratuit",
    fromPrice: "Dès {price}",
    hours: "{n} h",
    minutes: "{n} min",
    nextDate: "Prochaine date : {date}",
    noDates: "Pas encore de date ouverte",
    instant: "Confirmation immédiate",
    reviewsCount: "{avg} · {n} avis",
    reviewsCountOne: "{avg} · 1 avis",
    noReviewsYet: "Pas encore d'avis",
    byGuide: "avec {name}",
    founding: "Guide fondateur n° {n}",
    licensed: "Guide agréé",
    localHost: "Hôte local",
    crumbTours: "Visites",
    highlights: "Les points forts",
    about: "À propos de cette visite",
    route: "L'itinéraire",
    routeHint: "Les lieux de la visite, dans l'ordre, depuis le point de rendez-vous.",
    meeting: "Point de rendez-vous",
    included: "Ce qui est inclus",
    bring: "À apporter",
    accessibility: "Accessibilité",
    languages: "Langues",
    groupSize: "Taille du groupe",
    upToPeople: "Jusqu'à {n} personnes",
    faq: "Questions",
    guideTitle: "Votre guide",
    seeGuide: "Voir la page de {name}",
    reviewsTitle: "Ce que les voyageurs disent de {name}",
    noReviews: "Pas encore d'avis. Les avis apparaissent après les visites terminées, des deux côtés à la fois.",
    checkAvailability: "Voir les disponibilités",
    paidOnDay: "Payé le jour même, à votre guide",
    destinationTitle: "Visites guidées à {name}",
    destinationBody: "À parcourir avec quelqu'un qui y vit : des visites qui partent d'ici.",
    seeAll: "Toutes les visites",
    browseTours: "Parcourir les visites",
    photoFallback: "Pas encore de photo",
    contentTitle: "Page de la visite",
    contentBody: "Ce que les voyageurs lisent avant de réserver. N'écrivez que ce qui est vrai à chaque sortie.",
    contentHighlights: "Points forts (un par ligne, jusqu'à 8)",
    contentHighlightsHint: "Courts et concrets : un lieu, une saveur, une vue.",
    contentFaq: "Questions et réponses",
    contentQuestion: "Question",
    contentAnswer: "Réponse",
    contentAddQuestion: "Ajouter une question",
    contentRemoveQuestion: "Retirer la question {n}",
    contentAccessibility: "Accessibilité",
    contentAccessibilityHint: "Marches, pentes, pauses, poussette ou fauteuil roulant possibles ou non.",
    contentSave: "Enregistrer la page",
    contentSaved: "Page de la visite enregistrée.",
    viewPage: "Voir la page",
  },
};

export function useToursCopy(): ToursCopy {
  const { locale } = useLocale();
  return toursCopy[locale];
}

export function toursText(locale: Locale, key: ToursKey): string {
  return toursCopy[locale][key];
}

/** "2 h 30 min", "45 min", "3 h". */
export function tourDuration(copy: ToursCopy, minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return copy.minutes.replace("{n}", String(rest));
  if (!rest) return copy.hours.replace("{n}", String(hours));
  return `${copy.hours.replace("{n}", String(hours))} ${copy.minutes.replace("{n}", String(rest))}`;
}
