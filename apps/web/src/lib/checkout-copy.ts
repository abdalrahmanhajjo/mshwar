import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

export type CheckoutKey =
  | "title"
  | "fromListing"
  | "fromItinerary"
  | "modeInstant"
  | "modeRequest"
  | "modeInquiry"
  | "modeVisible"
  | "party"
  | "date"
  | "price"
  | "policy"
  | "review"
  | "commit"
  | "pay"
  | "inquiry"
  | "inquiryMessage"
  | "sendInquiry"
  | "capacityGone"
  | "holdUntil"
  | "cancelPreview"
  | "confirmCancel"
  | "refundAmount"
  | "confirmation"
  | "timeline"
  | "retrieve"
  | "continueCheckout"
  | "suggestionNote"
  | "requestNote"
  | "confirmedNote"
  | "instantBlocked"
  | "bookThisStop";

export const checkoutCopy: Record<Locale, Record<CheckoutKey, string>> = {
  en: {
    title: "Checkout",
    fromListing: "Booking from listing",
    fromItinerary: "Booking from itinerary",
    modeInstant: "Instant confirm",
    modeRequest: "Request to book",
    modeInquiry: "Inquiry only",
    modeVisible: "Booking mode",
    party: "Party size",
    date: "Date and time",
    price: "Price",
    policy: "Cancellation policy",
    review: "Review before payment",
    commit: "Hold this booking",
    pay: "Pay now",
    inquiry: "Send an inquiry",
    inquiryMessage: "Your question",
    sendInquiry: "Send inquiry",
    capacityGone: "That last place was just taken. Pick another time.",
    holdUntil: "Held until",
    cancelPreview: "If you cancel",
    confirmCancel: "Confirm cancellation",
    refundAmount: "Refund",
    confirmation: "Confirmation",
    timeline: "Status timeline",
    retrieve: "Open confirmation",
    continueCheckout: "Continue to checkout",
    suggestionNote: "This is still a suggestion until you commit.",
    requestNote: "The business must accept before this is confirmed.",
    confirmedNote: "Confirmed only after a successful payment when payment is required.",
    instantBlocked: "Instant confirm needs authoritative capacity.",
    bookThisStop: "Book this stop",
  },
  ar: {
    title: "إتمام الحجز",
    fromListing: "حجز من الصفحة",
    fromItinerary: "حجز من البرنامج",
    modeInstant: "تأكيد فوري",
    modeRequest: "طلب حجز",
    modeInquiry: "استفسار فقط",
    modeVisible: "طريقة الحجز",
    party: "عدد الأشخاص",
    date: "التاريخ والوقت",
    price: "السعر",
    policy: "سياسة الإلغاء",
    review: "راجع قبل الدفع",
    commit: "احجز هذا الموعد",
    pay: "ادفع الآن",
    inquiry: "أرسل استفساراً",
    inquiryMessage: "سؤالك",
    sendInquiry: "إرسال الاستفسار",
    capacityGone: "المقعد الأخير أُخذ. اختر وقتاً آخر.",
    holdUntil: "محجوز حتى",
    cancelPreview: "إذا ألغيت",
    confirmCancel: "تأكيد الإلغاء",
    refundAmount: "المبلغ المسترد",
    confirmation: "التأكيد",
    timeline: "سجل الحالة",
    retrieve: "فتح التأكيد",
    continueCheckout: "متابعة إلى الحجز",
    suggestionNote: "هذا اقتراح إلى أن تلتزم.",
    requestNote: "يجب أن يقبل النشاط قبل التأكيد.",
    confirmedNote: "لا يُؤكَّد الحجز المدفوع إلا بعد دفع ناجح.",
    instantBlocked: "التأكيد الفوري يحتاج سعة موثوقة.",
    bookThisStop: "احجز هذه المحطة",
  },
  fr: {
    title: "Paiement",
    fromListing: "Réservation depuis l’annonce",
    fromItinerary: "Réservation depuis l’itinéraire",
    modeInstant: "Confirmation immédiate",
    modeRequest: "Demande de réservation",
    modeInquiry: "Demande de renseignement",
    modeVisible: "Mode de réservation",
    party: "Taille du groupe",
    date: "Date et heure",
    price: "Prix",
    policy: "Politique d’annulation",
    review: "Vérifier avant de payer",
    commit: "Réserver ce créneau",
    pay: "Payer",
    inquiry: "Envoyer une demande",
    inquiryMessage: "Votre message",
    sendInquiry: "Envoyer",
    capacityGone: "La dernière place vient d’être prise. Choisissez un autre horaire.",
    holdUntil: "Option jusqu’à",
    cancelPreview: "Si vous annulez",
    confirmCancel: "Confirmer l’annulation",
    refundAmount: "Remboursement",
    confirmation: "Confirmation",
    timeline: "Historique",
    retrieve: "Ouvrir la confirmation",
    continueCheckout: "Continuer vers le paiement",
    suggestionNote: "Ceci reste une suggestion tant que vous n’avez pas confirmé.",
    requestNote: "L’établissement doit accepter avant confirmation.",
    confirmedNote: "Une réservation payante n’est confirmée qu’après un paiement réussi.",
    instantBlocked: "La confirmation immédiate exige une capacité officielle.",
    bookThisStop: "Réserver cet arrêt",
  },
};

export function useCheckoutCopy() {
  const { locale } = useLocale();
  return checkoutCopy[locale];
}

export function bookingModeCopy(mode: string, locale: Locale): string {
  const copy = checkoutCopy[locale];
  if (mode === "instant") {
    return copy.modeInstant;
  }
  if (mode === "inquiry") {
    return copy.modeInquiry;
  }
  return copy.modeRequest;
}
