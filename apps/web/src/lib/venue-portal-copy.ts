import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/** Copy for the business portal's restaurant and stay details, and listing claims. */
export type VenuePortalKey =
  | "detailsTitle"
  | "detailsBody"
  | "kindLabel"
  | "kind_experience"
  | "kind_attraction"
  | "kind_restaurant"
  | "kind_hotel"
  | "licenceNumber"
  | "licenceAuthority"
  | "licenceExpires"
  | "licenceNote"
  | "cuisines"
  | "priceLevel"
  | "priceAny"
  | "reservationPhone"
  | "reservationWhatsapp"
  | "reservationUrl"
  | "stayType"
  | "stay_hotel"
  | "stay_guesthouse"
  | "stay_hostel"
  | "stay_apartment"
  | "stars"
  | "rooms"
  | "checkIn"
  | "checkOut"
  | "priceFrom"
  | "bookingUrl"
  | "acceptsRequests"
  | "amenities"
  | "accessibility"
  | "save"
  | "saved"
  | "checkedStatus"
  | "notChecked"
  | "loadError"
  | "claimsTitle"
  | "claimsBody"
  | "findPlace"
  | "chosen"
  | "change"
  | "claimNote"
  | "sendClaim"
  | "claimSent"
  | "yourClaims"
  | "claim_pending"
  | "claim_approved"
  | "claim_rejected"
  | "noClaims"
  | "noOrg";

export const venuePortalCopy: Record<Locale, Record<VenuePortalKey, string>> = {
  en: {
    detailsTitle: "Restaurant or place to stay",
    detailsBody:
      "Add your tourism licence so travellers can see it was checked. Our team confirms it with the issuer before the badge shows.",
    kindLabel: "This listing is",
    kind_experience: "An experience",
    kind_attraction: "A place to visit",
    kind_restaurant: "A restaurant",
    kind_hotel: "A place to stay",
    licenceNumber: "Licence number",
    licenceAuthority: "Issued by",
    licenceExpires: "Licence expires",
    licenceNote: "Changing the licence number removes the check until we confirm it again.",
    cuisines: "Cuisines (comma separated)",
    priceLevel: "Price level",
    priceAny: "Not set",
    reservationPhone: "Reservation phone",
    reservationWhatsapp: "WhatsApp number",
    reservationUrl: "Online reservation link (https)",
    stayType: "Type of stay",
    stay_hotel: "Hotel",
    stay_guesthouse: "Guesthouse",
    stay_hostel: "Hostel",
    stay_apartment: "Apartment",
    stars: "Stars (official rating)",
    rooms: "Rooms",
    checkIn: "Check-in from",
    checkOut: "Check-out by",
    priceFrom: "Nightly price from (USD)",
    bookingUrl: "Booking link (https)",
    acceptsRequests: "Travellers can ask to stay through Mshwar",
    amenities: "Amenities (comma separated)",
    accessibility: "Accessibility (comma separated)",
    save: "Save details",
    saved: "Saved.",
    checkedStatus: "Checked {date}; re-check by {due}",
    notChecked: "Not checked yet. Once your licence number is in, our team will check it.",
    loadError: "Couldn't load. Try again.",
    claimsTitle: "Claim a place Mshwar listed",
    claimsBody:
      "If our team listed your restaurant or place to stay, claim it to manage it here. We check your licence before handing it over.",
    findPlace: "Find your place by name",
    chosen: "Chosen: {place}",
    change: "Change",
    claimNote: "How we can confirm it's yours (licence number, your role)",
    sendClaim: "Send claim",
    claimSent: "Claim sent. We'll check it and let you know.",
    yourClaims: "Your claims",
    claim_pending: "Waiting",
    claim_approved: "Approved",
    claim_rejected: "Rejected",
    noClaims: "No claims yet.",
    noOrg: "Choose a business first.",
  },
  ar: {
    detailsTitle: "مطعم أو مكان إقامة",
    detailsBody:
      "أضف ترخيصك السياحي ليرى المسافرون أنه جرى التحقّق منه. يتأكّد فريقنا منه لدى الجهة المُصدِرة قبل ظهور الشارة.",
    kindLabel: "هذا الإدراج",
    kind_experience: "تجربة",
    kind_attraction: "مكان للزيارة",
    kind_restaurant: "مطعم",
    kind_hotel: "مكان إقامة",
    licenceNumber: "رقم الترخيص",
    licenceAuthority: "الجهة المُصدِرة",
    licenceExpires: "تاريخ انتهاء الترخيص",
    licenceNote: "تغيير رقم الترخيص يُزيل التحقّق إلى أن نؤكّده مجددًا.",
    cuisines: "المطابخ (مفصولة بفواصل)",
    priceLevel: "مستوى السعر",
    priceAny: "غير محدّد",
    reservationPhone: "هاتف الحجز",
    reservationWhatsapp: "رقم واتساب",
    reservationUrl: "رابط الحجز عبر الإنترنت (https)",
    stayType: "نوع الإقامة",
    stay_hotel: "فندق",
    stay_guesthouse: "بيت ضيافة",
    stay_hostel: "نُزُل",
    stay_apartment: "شقة",
    stars: "النجوم (التصنيف الرسمي)",
    rooms: "الغرف",
    checkIn: "الوصول من",
    checkOut: "المغادرة قبل",
    priceFrom: "سعر الليلة ابتداءً من (دولار)",
    bookingUrl: "رابط الحجز (https)",
    acceptsRequests: "يمكن للمسافرين طلب الإقامة عبر مشوار",
    amenities: "المرافق (مفصولة بفواصل)",
    accessibility: "إمكانية الوصول (مفصولة بفواصل)",
    save: "احفظ التفاصيل",
    saved: "تم الحفظ.",
    checkedStatus: "تحقّقنا في {date}؛ إعادة التحقّق قبل {due}",
    notChecked: "لم يُتحقّق منه بعد. بعد إدخال رقم ترخيصك سيتحقّق منه فريقنا.",
    loadError: "تعذّر التحميل. حاول مجددًا.",
    claimsTitle: "طالب بمكان أدرجه مشوار",
    claimsBody: "إذا أدرج فريقنا مطعمك أو مكان إقامتك فطالب به لإدارته من هنا. نتحقّق من ترخيصك قبل تسليمه.",
    findPlace: "ابحث عن مكانك باسمه",
    chosen: "المختار: {place}",
    change: "غيّر",
    claimNote: "كيف نتأكّد أنه لك (رقم الترخيص، دورك)",
    sendClaim: "أرسل الطلب",
    claimSent: "أُرسل الطلب. سنتحقّق منه ونُعلمك.",
    yourClaims: "طلباتك",
    claim_pending: "بانتظار المراجعة",
    claim_approved: "موافق عليه",
    claim_rejected: "مرفوض",
    noClaims: "لا طلبات بعد.",
    noOrg: "اختر مؤسسة أولًا.",
  },
  fr: {
    detailsTitle: "Restaurant ou hébergement",
    detailsBody:
      "Ajoutez votre licence touristique pour que les voyageurs voient qu’elle a été vérifiée. Notre équipe la confirme auprès de l’émetteur avant d’afficher le badge.",
    kindLabel: "Cette fiche est",
    kind_experience: "Une expérience",
    kind_attraction: "Un lieu à visiter",
    kind_restaurant: "Un restaurant",
    kind_hotel: "Un hébergement",
    licenceNumber: "Numéro de licence",
    licenceAuthority: "Délivrée par",
    licenceExpires: "Expiration de la licence",
    licenceNote: "Modifier le numéro retire la vérification jusqu’à nouvelle confirmation.",
    cuisines: "Cuisines (séparées par des virgules)",
    priceLevel: "Niveau de prix",
    priceAny: "Non précisé",
    reservationPhone: "Téléphone de réservation",
    reservationWhatsapp: "Numéro WhatsApp",
    reservationUrl: "Lien de réservation (https)",
    stayType: "Type d’hébergement",
    stay_hotel: "Hôtel",
    stay_guesthouse: "Maison d’hôtes",
    stay_hostel: "Auberge",
    stay_apartment: "Appartement",
    stars: "Étoiles (classement officiel)",
    rooms: "Chambres",
    checkIn: "Arrivée à partir de",
    checkOut: "Départ avant",
    priceFrom: "Prix par nuit à partir de (USD)",
    bookingUrl: "Lien de réservation (https)",
    acceptsRequests: "Les voyageurs peuvent demander un séjour via Mshwar",
    amenities: "Équipements (séparés par des virgules)",
    accessibility: "Accessibilité (séparée par des virgules)",
    save: "Enregistrer",
    saved: "Enregistré.",
    checkedStatus: "Vérifié le {date} ; à revérifier avant le {due}",
    notChecked: "Pas encore vérifié. Dès que votre numéro de licence est saisi, notre équipe le vérifie.",
    loadError: "Chargement impossible. Réessayez.",
    claimsTitle: "Revendiquer un lieu référencé par Mshwar",
    claimsBody:
      "Si notre équipe a référencé votre restaurant ou hébergement, revendiquez-le pour le gérer ici. Nous vérifions votre licence avant.",
    findPlace: "Cherchez votre lieu par son nom",
    chosen: "Choisi : {place}",
    change: "Changer",
    claimNote: "Comment confirmer qu’il est à vous (licence, votre rôle)",
    sendClaim: "Envoyer",
    claimSent: "Demande envoyée. Nous la vérifions et vous tenons informé.",
    yourClaims: "Vos revendications",
    claim_pending: "En attente",
    claim_approved: "Approuvée",
    claim_rejected: "Refusée",
    noClaims: "Aucune revendication.",
    noOrg: "Choisissez d’abord un établissement.",
  },
};

export type VenuePortalCopy = Record<VenuePortalKey, string>;

export function useVenuePortalCopy(): VenuePortalCopy {
  const { locale } = useLocale();
  return venuePortalCopy[locale];
}
