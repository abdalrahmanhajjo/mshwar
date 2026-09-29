import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/** Copy for booking a tour (guide plan step 3), for travellers and for the guide. */
export type TourBookingKey =
  | "metaTitle"
  | "stepDate"
  | "stepTime"
  | "stepGuests"
  | "stepReview"
  | "prevMonth"
  | "nextMonth"
  | "noDates"
  | "fromPrice"
  | "pickDay"
  | "seatsLeft"
  | "privateStart"
  | "minGroup"
  | "adults"
  | "children"
  | "childrenUpTo"
  | "childrenAdultPrice"
  | "language"
  | "languageAny"
  | "extras"
  | "perPerson"
  | "perBooking"
  | "note"
  | "notePlaceholder"
  | "summary"
  | "lineAdults"
  | "lineChildren"
  | "lineGroup"
  | "total"
  | "free"
  | "paidOnDay"
  | "instant"
  | "request"
  | "policyflexible"
  | "policymoderate"
  | "policystrict"
  | "freeUntil"
  | "bookNow"
  | "sendRequest"
  | "booking"
  | "signIn"
  | "confirmedTitle"
  | "requestedTitle"
  | "codeLabel"
  | "viewBooking"
  | "loadError"
  | "notFound"
  | "byGuide"
  | "viewTitle"
  | "statuspending"
  | "statusconfirmed"
  | "statusrejected"
  | "statuscancelled"
  | "statusexpired"
  | "statuscompleted"
  | "statusrefunded"
  | "when"
  | "meeting"
  | "guests"
  | "guide"
  | "replyBy"
  | "cancel"
  | "cancelReason"
  | "cancelConfirm"
  | "cancelLate"
  | "cancelledByGuide"
  | "cancelledByTraveller"
  | "lateNote"
  | "movedTo"
  | "openNew"
  | "movedFrom"
  | "reschedule"
  | "rescheduleMessage"
  | "rescheduleSend"
  | "rescheduleNone"
  | "proposalFromGuide"
  | "proposalFromTraveller"
  | "proposalMine"
  | "accept"
  | "decline"
  | "declineReason"
  | "acceptRequest"
  | "declineRequest"
  | "settingsTitle"
  | "settingsBody"
  | "instantLabel"
  | "instantHint"
  | "ttl"
  | "policyLabel"
  | "childPrice"
  | "childPriceHint"
  | "childAge"
  | "extraName"
  | "extraPrice"
  | "extraUnit"
  | "addExtra"
  | "removeExtra"
  | "saveSettings"
  | "settingsSaved"
  | "hostFree"
  | "openBooking";

export type TourBookingCopy = Record<TourBookingKey, string>;

export const tourBookingCopy: Record<Locale, TourBookingCopy> = {
  en: {
    metaTitle: "Book {title}",
    stepDate: "Choose a date",
    stepTime: "Choose a time",
    stepGuests: "Who's coming",
    stepReview: "Review and book",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    noDates: "No open dates this month.",
    fromPrice: "from {price}",
    pickDay: "Pick a day with open times.",
    seatsLeft: "{n} seats left",
    privateStart: "Private: just your group",
    minGroup: "Runs with {n}+ guests",
    adults: "Adults",
    children: "Children",
    childrenUpTo: "Up to {age} years, {price} each",
    childrenAdultPrice: "Children pay the adult price.",
    language: "Language",
    languageAny: "No preference",
    extras: "Extras",
    perPerson: "{price} per person",
    perBooking: "{price} per booking",
    note: "Anything the guide should know?",
    notePlaceholder: "Dietary needs, access, children's ages…",
    summary: "Your booking",
    lineAdults: "{n} × adult",
    lineChildren: "{n} × child",
    lineGroup: "Price for the group",
    total: "Total",
    free: "Free",
    paidOnDay: "Paid on the day, to your guide. Nothing is charged now.",
    instant: "Confirmed instantly",
    request: "The guide replies within {n} hours",
    policyflexible: "Free cancellation until 24 hours before",
    policymoderate: "Free cancellation until 3 days before",
    policystrict: "Free cancellation until 7 days before",
    freeUntil: "Free to cancel until {date}",
    bookNow: "Book now",
    sendRequest: "Send request",
    booking: "Booking…",
    signIn: "Sign in to book",
    confirmedTitle: "You're booked",
    requestedTitle: "Request sent",
    codeLabel: "Booking code",
    viewBooking: "View booking",
    loadError: "We couldn't load this. Please try again.",
    notFound: "Booking not found.",
    byGuide: "with {name}",
    viewTitle: "Booking {code}",
    statuspending: "Waiting for the guide",
    statusconfirmed: "Confirmed",
    statusrejected: "Declined",
    statuscancelled: "Cancelled",
    statusexpired: "Not answered in time",
    statuscompleted: "Completed",
    statusrefunded: "Refunded",
    when: "When",
    meeting: "Meeting point",
    guests: "Guests",
    guide: "Guide",
    replyBy: "The guide replies by {date}",
    cancel: "Cancel booking",
    cancelReason: "Why are you cancelling?",
    cancelConfirm: "Cancel this booking",
    cancelLate: "It is past the free cancellation deadline, so this will be recorded as a late cancellation.",
    cancelledByGuide: "Cancelled by the guide",
    cancelledByTraveller: "Cancelled by the traveller",
    lateNote: "Cancelled after the free deadline",
    movedTo: "This booking moved to a new time.",
    openNew: "Open the new booking",
    movedFrom: "Moved from an earlier time.",
    reschedule: "Propose another time",
    rescheduleMessage: "Message (optional)",
    rescheduleSend: "Send proposal",
    rescheduleNone: "No other open times.",
    proposalFromGuide: "The guide proposed {date}.",
    proposalFromTraveller: "The traveller proposed {date}.",
    proposalMine: "You proposed {date}. Waiting for an answer.",
    accept: "Accept",
    decline: "Decline",
    declineReason: "Reason",
    acceptRequest: "Accept request",
    declineRequest: "Decline request",
    settingsTitle: "How this tour books",
    settingsBody: "Prices shown to travellers are only these and the tour price. Everything is paid on the day.",
    instantLabel: "Instant booking",
    instantHint: "Travellers are confirmed at once, within your schedule and rules.",
    ttl: "Reply to requests within (hours)",
    policyLabel: "Cancellation policy",
    childPrice: "Child price (USD)",
    childPriceHint: "Leave empty to charge children the adult price.",
    childAge: "Children up to age",
    extraName: "Extra",
    extraPrice: "Price (USD)",
    extraUnit: "Charged",
    addExtra: "Add an extra",
    removeExtra: "Remove {name}",
    saveSettings: "Save booking settings",
    settingsSaved: "Booking settings saved.",
    hostFree: "As a local host, extras and child places are free.",
    openBooking: "Open",
  },
  ar: {
    metaTitle: "احجز {title}",
    stepDate: "اختر التاريخ",
    stepTime: "اختر الوقت",
    stepGuests: "من سيأتي",
    stepReview: "المراجعة والحجز",
    prevMonth: "الشهر السابق",
    nextMonth: "الشهر التالي",
    noDates: "لا مواعيد متاحة هذا الشهر.",
    fromPrice: "ابتداءً من {price}",
    pickDay: "اختر يوماً فيه مواعيد متاحة.",
    seatsLeft: "{n} مقاعد متبقية",
    privateStart: "خاصة: مجموعتك فقط",
    minGroup: "تُقام بـ{n} ضيوف أو أكثر",
    adults: "البالغون",
    children: "الأطفال",
    childrenUpTo: "حتى عمر {age} سنة، {price} للطفل",
    childrenAdultPrice: "يدفع الأطفال سعر البالغين.",
    language: "اللغة",
    languageAny: "لا تفضيل",
    extras: "إضافات",
    perPerson: "{price} للشخص",
    perBooking: "{price} للحجز",
    note: "هل من شيء يجب أن يعرفه المرشد؟",
    notePlaceholder: "حاجات غذائية، سهولة الوصول، أعمار الأطفال…",
    summary: "حجزك",
    lineAdults: "{n} × بالغ",
    lineChildren: "{n} × طفل",
    lineGroup: "سعر المجموعة",
    total: "المجموع",
    free: "مجاناً",
    paidOnDay: "يُدفع يوم الجولة للمرشد مباشرةً. لا يُحتسب أي مبلغ الآن.",
    instant: "تأكيد فوري",
    request: "يردّ المرشد خلال {n} ساعة",
    policyflexible: "إلغاء مجاني حتى 24 ساعة قبل الموعد",
    policymoderate: "إلغاء مجاني حتى 3 أيام قبل الموعد",
    policystrict: "إلغاء مجاني حتى 7 أيام قبل الموعد",
    freeUntil: "الإلغاء مجاني حتى {date}",
    bookNow: "احجز الآن",
    sendRequest: "أرسل الطلب",
    booking: "جارٍ الحجز…",
    signIn: "سجّل الدخول للحجز",
    confirmedTitle: "تم حجزك",
    requestedTitle: "أُرسل الطلب",
    codeLabel: "رمز الحجز",
    viewBooking: "عرض الحجز",
    loadError: "تعذّر التحميل. حاول مجدداً.",
    notFound: "الحجز غير موجود.",
    byGuide: "مع {name}",
    viewTitle: "الحجز {code}",
    statuspending: "بانتظار المرشد",
    statusconfirmed: "مؤكَّد",
    statusrejected: "مرفوض",
    statuscancelled: "ملغى",
    statusexpired: "لم يُردّ عليه في الوقت",
    statuscompleted: "مكتمل",
    statusrefunded: "مُسترد",
    when: "الموعد",
    meeting: "نقطة اللقاء",
    guests: "الضيوف",
    guide: "المرشد",
    replyBy: "يردّ المرشد قبل {date}",
    cancel: "إلغاء الحجز",
    cancelReason: "لماذا تلغي؟",
    cancelConfirm: "ألغِ هذا الحجز",
    cancelLate: "انقضت مهلة الإلغاء المجاني، لذلك سيُسجَّل هذا إلغاءً متأخراً.",
    cancelledByGuide: "ألغاه المرشد",
    cancelledByTraveller: "ألغاه المسافر",
    lateNote: "أُلغي بعد انقضاء المهلة المجانية",
    movedTo: "نُقل هذا الحجز إلى موعد جديد.",
    openNew: "افتح الحجز الجديد",
    movedFrom: "نُقل من موعد سابق.",
    reschedule: "اقترح موعداً آخر",
    rescheduleMessage: "رسالة (اختيارية)",
    rescheduleSend: "أرسل الاقتراح",
    rescheduleNone: "لا مواعيد أخرى متاحة.",
    proposalFromGuide: "اقترح المرشد {date}.",
    proposalFromTraveller: "اقترح المسافر {date}.",
    proposalMine: "اقترحت {date}. بانتظار الرد.",
    accept: "قبول",
    decline: "رفض",
    declineReason: "السبب",
    acceptRequest: "قبول الطلب",
    declineRequest: "رفض الطلب",
    settingsTitle: "كيف تُحجز هذه الجولة",
    settingsBody: "لا يرى المسافرون إلا هذه الأسعار وسعر الجولة. كل شيء يُدفع يوم الجولة.",
    instantLabel: "حجز فوري",
    instantHint: "يُؤكَّد المسافرون فوراً، ضمن جدولك وقواعدك.",
    ttl: "الرد على الطلبات خلال (ساعات)",
    policyLabel: "سياسة الإلغاء",
    childPrice: "سعر الطفل (بالدولار)",
    childPriceHint: "اتركه فارغاً ليدفع الأطفال سعر البالغين.",
    childAge: "الأطفال حتى عمر",
    extraName: "إضافة",
    extraPrice: "السعر (بالدولار)",
    extraUnit: "يُحتسب",
    addExtra: "أضف إضافة",
    removeExtra: "إزالة {name}",
    saveSettings: "حفظ إعدادات الحجز",
    settingsSaved: "حُفظت إعدادات الحجز.",
    hostFree: "بصفتك مضيفاً محلياً، الإضافات وأماكن الأطفال مجانية.",
    openBooking: "فتح",
  },
  fr: {
    metaTitle: "Réserver {title}",
    stepDate: "Choisissez une date",
    stepTime: "Choisissez une heure",
    stepGuests: "Qui vient",
    stepReview: "Vérifier et réserver",
    prevMonth: "Mois précédent",
    nextMonth: "Mois suivant",
    noDates: "Aucune date ouverte ce mois-ci.",
    fromPrice: "dès {price}",
    pickDay: "Choisissez un jour avec des horaires ouverts.",
    seatsLeft: "{n} places restantes",
    privateStart: "Privé : seulement votre groupe",
    minGroup: "A lieu dès {n} participants",
    adults: "Adultes",
    children: "Enfants",
    childrenUpTo: "Jusqu'à {age} ans, {price} chacun",
    childrenAdultPrice: "Les enfants paient le prix adulte.",
    language: "Langue",
    languageAny: "Pas de préférence",
    extras: "Options",
    perPerson: "{price} par personne",
    perBooking: "{price} par réservation",
    note: "Quelque chose que le guide doit savoir ?",
    notePlaceholder: "Régime alimentaire, accessibilité, âge des enfants…",
    summary: "Votre réservation",
    lineAdults: "{n} × adulte",
    lineChildren: "{n} × enfant",
    lineGroup: "Prix pour le groupe",
    total: "Total",
    free: "Gratuit",
    paidOnDay: "Payé le jour même, à votre guide. Rien n'est débité maintenant.",
    instant: "Confirmation immédiate",
    request: "Le guide répond sous {n} heures",
    policyflexible: "Annulation gratuite jusqu'à 24 heures avant",
    policymoderate: "Annulation gratuite jusqu'à 3 jours avant",
    policystrict: "Annulation gratuite jusqu'à 7 jours avant",
    freeUntil: "Annulation gratuite jusqu'au {date}",
    bookNow: "Réserver",
    sendRequest: "Envoyer la demande",
    booking: "Réservation…",
    signIn: "Connectez-vous pour réserver",
    confirmedTitle: "C'est réservé",
    requestedTitle: "Demande envoyée",
    codeLabel: "Code de réservation",
    viewBooking: "Voir la réservation",
    loadError: "Chargement impossible. Réessayez.",
    notFound: "Réservation introuvable.",
    byGuide: "avec {name}",
    viewTitle: "Réservation {code}",
    statuspending: "En attente du guide",
    statusconfirmed: "Confirmée",
    statusrejected: "Refusée",
    statuscancelled: "Annulée",
    statusexpired: "Sans réponse à temps",
    statuscompleted: "Terminée",
    statusrefunded: "Remboursée",
    when: "Quand",
    meeting: "Point de rendez-vous",
    guests: "Participants",
    guide: "Guide",
    replyBy: "Le guide répond avant le {date}",
    cancel: "Annuler la réservation",
    cancelReason: "Pourquoi annulez-vous ?",
    cancelConfirm: "Annuler cette réservation",
    cancelLate: "Le délai d'annulation gratuite est passé : l'annulation sera enregistrée comme tardive.",
    cancelledByGuide: "Annulée par le guide",
    cancelledByTraveller: "Annulée par le voyageur",
    lateNote: "Annulée après le délai gratuit",
    movedTo: "Cette réservation a été déplacée.",
    openNew: "Ouvrir la nouvelle réservation",
    movedFrom: "Déplacée depuis un horaire précédent.",
    reschedule: "Proposer un autre horaire",
    rescheduleMessage: "Message (facultatif)",
    rescheduleSend: "Envoyer la proposition",
    rescheduleNone: "Aucun autre horaire ouvert.",
    proposalFromGuide: "Le guide propose le {date}.",
    proposalFromTraveller: "Le voyageur propose le {date}.",
    proposalMine: "Vous avez proposé le {date}. En attente de réponse.",
    accept: "Accepter",
    decline: "Refuser",
    declineReason: "Motif",
    acceptRequest: "Accepter la demande",
    declineRequest: "Refuser la demande",
    settingsTitle: "Comment cette visite se réserve",
    settingsBody: "Les voyageurs ne voient que ces prix et le prix de la visite. Tout se paie le jour même.",
    instantLabel: "Réservation immédiate",
    instantHint: "Les voyageurs sont confirmés tout de suite, dans votre horaire et vos règles.",
    ttl: "Répondre aux demandes sous (heures)",
    policyLabel: "Politique d'annulation",
    childPrice: "Prix enfant (USD)",
    childPriceHint: "Laissez vide pour appliquer le prix adulte.",
    childAge: "Enfants jusqu'à",
    extraName: "Option",
    extraPrice: "Prix (USD)",
    extraUnit: "Facturé",
    addExtra: "Ajouter une option",
    removeExtra: "Retirer {name}",
    saveSettings: "Enregistrer",
    settingsSaved: "Réglages de réservation enregistrés.",
    hostFree: "En tant qu'hôte local, les options et les places enfants sont gratuites.",
    openBooking: "Ouvrir",
  },
};

export function useTourBookingCopy(): TourBookingCopy {
  const { locale } = useLocale();
  return tourBookingCopy[locale];
}

export function tourBookingText(locale: Locale, key: TourBookingKey): string {
  return tourBookingCopy[locale][key];
}
