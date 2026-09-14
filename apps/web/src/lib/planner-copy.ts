import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

export type PlannerKey =
  | "startTitle"
  | "startHint"
  | "searchPlace"
  | "searchPlaceholder"
  | "dropPin"
  | "useLocation"
  | "locationDenied"
  | "manualEntry"
  | "saveStart"
  | "savedStart"
  | "precisePermission"
  | "mapFallback"
  | "planTitle"
  | "planHint"
  | "optimize"
  | "infeasible"
  | "metricsUnavailable"
  | "weatherWarning"
  | "noWarning"
  | "forecastUnavailable"
  | "replanAffected"
  | "replanNone"
  | "before"
  | "after"
  | "indoor"
  | "outdoor"
  | "weatherSensitive"
  | "thresholdsTitle"
  | "thresholdsHint";

export const plannerCopy: Record<Locale, Record<PlannerKey, string>> = {
  en: {
    startTitle: "Where should this plan start?",
    startHint: "Search, drop a pin, or type a place. Device location is optional and never the only way in.",
    searchPlace: "Search a place",
    searchPlaceholder: "Hamra, Byblos, airport…",
    dropPin: "Drop a pin on the map",
    useLocation: "Use my location",
    locationDenied: "Location permission was denied. Search, pin, or type a place instead.",
    manualEntry: "Type a label and coordinates",
    saveStart: "Save as default start",
    savedStart: "Saved to your profile",
    precisePermission: "Precise location is requested only when you tap Use my location.",
    mapFallback: "Map tiles need a browser Maps key. The pin grid still works.",
    planTitle: "Route, weather and replan",
    planHint: "Travel times come from the routing service. Weather warnings never change bookings.",
    optimize: "Optimise stop order",
    infeasible: "No feasible plan honours locked stops, hours and return-by.",
    metricsUnavailable: "Travel time is unavailable from the routing provider. These are not estimates.",
    weatherWarning: "Weather warning",
    noWarning: "No weather warning for this plan.",
    forecastUnavailable: "Forecast unavailable — no warning shown.",
    replanAffected: "Rebuild weather-affected stops",
    replanNone: "No feasible alternative. The current plan was left unchanged.",
    before: "Before",
    after: "After",
    indoor: "Indoor",
    outdoor: "Outdoor",
    weatherSensitive: "Weather-sensitive",
    thresholdsTitle: "Weather warning thresholds",
    thresholdsHint: "Warnings name affected stops. They never cancel bookings.",
  },
  ar: {
    startTitle: "من أين تبدأ هذه الخطة؟",
    startHint: "ابحث أو أسقط دبوساً أو اكتب مكاناً. موقع الجهاز اختياري وليس الطريق الوحيد.",
    searchPlace: "ابحث عن مكان",
    searchPlaceholder: "الحمرا، جبيل، المطار…",
    dropPin: "أسقط دبوساً على الخريطة",
    useLocation: "استخدم موقعي",
    locationDenied: "رُفض إذن الموقع. استخدم البحث أو الدبوس أو الإدخال اليدوي.",
    manualEntry: "اكتب اسماً وإحداثيات",
    saveStart: "احفظ كنقطة انطلاق افتراضية",
    savedStart: "حُفظ في ملفك",
    precisePermission: "يُطلب الموقع الدقيق فقط عند الضغط على استخدم موقعي.",
    mapFallback: "بلاطات الخريطة تحتاج مفتاح متصفح. شبكة الدبابيس ما زالت تعمل.",
    planTitle: "المسار والطقس وإعادة التخطيط",
    planHint: "أوقات التنقل من خدمة التوجيه. تحذيرات الطقس لا تغيّر الحجوزات.",
    optimize: "حسّن ترتيب المحطات",
    infeasible: "لا توجد خطة ممكنة تحترم المحطات المقفلة والساعات ووقت العودة.",
    metricsUnavailable: "وقت التنقل غير متاح من المزود. هذه ليست تقديرات.",
    weatherWarning: "تحذير طقس",
    noWarning: "لا يوجد تحذير طقس لهذه الخطة.",
    forecastUnavailable: "التوقع غير متاح — لن يُعرض تحذير.",
    replanAffected: "أعد بناء المحطات المتأثرة بالطقس",
    replanNone: "لا بديل ممكن. بقيت الخطة الحالية كما هي.",
    before: "قبل",
    after: "بعد",
    indoor: "داخلي",
    outdoor: "خارجي",
    weatherSensitive: "حسّاس للطقس",
    thresholdsTitle: "عتبات تحذير الطقس",
    thresholdsHint: "التحذيرات تسمّي المحطات المتأثرة ولا تلغي الحجوزات.",
  },
  fr: {
    startTitle: "D’où part ce plan ?",
    startHint: "Recherchez, déposez une épingle ou saisissez un lieu. La géolocalisation est facultative.",
    searchPlace: "Rechercher un lieu",
    searchPlaceholder: "Hamra, Byblos, aéroport…",
    dropPin: "Déposer une épingle",
    useLocation: "Utiliser ma position",
    locationDenied: "Permission refusée. Utilisez la recherche, l’épingle ou la saisie.",
    manualEntry: "Saisir un libellé et des coordonnées",
    saveStart: "Enregistrer comme départ par défaut",
    savedStart: "Enregistré dans le profil",
    precisePermission: "La position précise n’est demandée que si vous appuyez sur Utiliser ma position.",
    mapFallback: "Les tuiles carte nécessitent une clé navigateur. La grille d’épingles reste utilisable.",
    planTitle: "Itinéraire, météo et replanification",
    planHint:
      "Les temps de trajet viennent du service d’itinéraire. Les alertes météo ne modifient jamais les réservations.",
    optimize: "Optimiser l’ordre des arrêts",
    infeasible: "Aucun plan ne respecte les arrêts verrouillés, les horaires et l’heure de retour.",
    metricsUnavailable: "Le temps de trajet est indisponible. Ce ne sont pas des estimations.",
    weatherWarning: "Alerte météo",
    noWarning: "Aucune alerte météo pour ce plan.",
    forecastUnavailable: "Prévision indisponible — aucune alerte affichée.",
    replanAffected: "Reconstruire les arrêts touchés par la météo",
    replanNone: "Aucune alternative possible. Le plan actuel n’a pas été modifié.",
    before: "Avant",
    after: "Après",
    indoor: "Intérieur",
    outdoor: "Extérieur",
    weatherSensitive: "Sensible à la météo",
    thresholdsTitle: "Seuils d’alerte météo",
    thresholdsHint: "Les alertes nomment les arrêts concernés. Elles n’annulent jamais une réservation.",
  },
};

export function usePlannerCopy() {
  const { locale } = useLocale();
  return plannerCopy[locale];
}
