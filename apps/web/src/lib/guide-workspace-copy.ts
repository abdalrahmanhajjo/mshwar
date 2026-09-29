import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/**
 * Copy for the guide's workspace (guide plan step 6): the month view, calendar feed and
 * imported calendars, the day's check-in and payment, earnings and insights.
 */
export type GuideWorkspaceKey =
  | "monthTitle"
  | "monthBody"
  | "prevMonth"
  | "nextMonth"
  | "legendOpen"
  | "legendPartly"
  | "legendFull"
  | "legendPrivate"
  | "legendBlocked"
  | "legendHired"
  | "legendOff"
  | "dayEmpty"
  | "runSeats"
  | "runClosed"
  | "runPrivate"
  | "guestsN"
  | "requestPending"
  | "checkedIn"
  | "noShow"
  | "blockManual"
  | "blockExternal"
  | "hiredDay"
  | "dayOff"
  | "loadError"
  | "syncTitle"
  | "feedTitle"
  | "feedBody"
  | "feedCreate"
  | "feedReplace"
  | "feedRevoke"
  | "feedActive"
  | "feedOnce"
  | "feedHow"
  | "copy"
  | "copied"
  | "importTitle"
  | "importBody"
  | "importUrl"
  | "importLabel"
  | "importAdd"
  | "importSync"
  | "importRemove"
  | "importOk"
  | "importFailed"
  | "importPending"
  | "importMax"
  | "importEmpty"
  | "dayTitle"
  | "dayNote"
  | "arrived"
  | "markNoShow"
  | "checkedInAt"
  | "markedNoShow"
  | "paymentTitle"
  | "paymentAmount"
  | "paymentMethod"
  | "methodcash"
  | "methodwallet"
  | "methodcard"
  | "methodtransfer"
  | "methodother"
  | "paymentSave"
  | "paymentSaved"
  | "paymentInvalid"
  | "earningsTitle"
  | "earningsBody"
  | "month"
  | "expected"
  | "received"
  | "fee"
  | "yours"
  | "upcoming"
  | "downloadCsv"
  | "colDate"
  | "colBooking"
  | "colTour"
  | "colGuests"
  | "colExpected"
  | "colReceived"
  | "notRecorded"
  | "earningsEmpty"
  | "feeNote"
  | "insightsTitle"
  | "insightsBody"
  | "period"
  | "days30"
  | "days90"
  | "days365"
  | "colRequests"
  | "colConfirmed"
  | "colDeclined"
  | "colLapsed"
  | "colCancelled"
  | "colGuestsServed"
  | "colOccupancy"
  | "replyTitle"
  | "replyStats"
  | "replyNone"
  | "insightsEmpty"
  | "minutes"
  | "hours";

export type GuideWorkspaceCopy = Record<GuideWorkspaceKey, string>;

export const guideWorkspaceCopy: Record<Locale, GuideWorkspaceCopy> = {
  en: {
    monthTitle: "Your month",
    monthBody: "Every run, booking, busy time and hired day at a glance. Tap a day to see it.",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    legendOpen: "Open",
    legendPartly: "Partly booked",
    legendFull: "Full",
    legendPrivate: "Private booking",
    legendBlocked: "Busy",
    legendHired: "Hired",
    legendOff: "Day off",
    dayEmpty: "Nothing on this day.",
    runSeats: "{reserved} of {capacity} booked",
    runClosed: "Closed",
    runPrivate: "Private",
    guestsN: "{n} guests",
    requestPending: "request",
    checkedIn: "checked in",
    noShow: "no-show",
    blockManual: "Blocked",
    blockExternal: "Busy in your calendar",
    hiredDay: "Hired for the day",
    dayOff: "Day off",
    loadError: "We couldn't load this. Please try again.",
    syncTitle: "Connect your calendars",
    feedTitle: "See Mshwar in your own calendar",
    feedBody:
      "Subscribe to a private address and your confirmed runs and hired days appear in Google, Apple or Outlook. Guests' names are never in it.",
    feedCreate: "Create address",
    feedReplace: "Make a new address",
    feedRevoke: "Turn off",
    feedActive:
      "An address is active since {date}. It is shown only once; make a new one if you need it again (the old one stops working).",
    feedOnce: "Copy this address now. It is shown only once.",
    feedHow: "Google Calendar: Other calendars → From URL. Apple Calendar: File → New Calendar Subscription.",
    copy: "Copy",
    copied: "Copied",
    importTitle: "Busy time from your other calendars",
    importBody:
      "Paste a calendar's secret iCal address (Google: Settings → your calendar → Secret address in iCal format). We read only when you are busy, never what the event is, every 15 minutes, and travellers can't book over it.",
    importUrl: "Secret address",
    importLabel: "Name (optional)",
    importAdd: "Connect",
    importSync: "Sync now",
    importRemove: "Disconnect",
    importOk: "{n} busy times · read {date}",
    importFailed: "Couldn't read it: {error}. The last busy times are kept.",
    importPending: "Waiting for the first read",
    importMax: "Up to 3 calendars.",
    importEmpty: "No calendars connected.",
    dayTitle: "On the day",
    dayNote: "From an hour before the start, check the guests in and record what they paid you.",
    arrived: "Guests arrived",
    markNoShow: "No-show",
    checkedInAt: "Checked in at {time}",
    markedNoShow: "Marked as a no-show",
    paymentTitle: "Payment received",
    paymentAmount: "Amount (USD)",
    paymentMethod: "How",
    methodcash: "Cash",
    methodwallet: "Wallet (Whish, OMT…)",
    methodcard: "Card",
    methodtransfer: "Bank transfer",
    methodother: "Other",
    paymentSave: "Save payment",
    paymentSaved: "Recorded {amount} ({method})",
    paymentInvalid: "Enter the amount you received.",
    earningsTitle: "Earnings",
    earningsBody:
      "What your bookings said and what you recorded as received. Guests pay you on the day; Mshwar never holds your money.",
    month: "Month",
    expected: "Booked value",
    received: "Recorded as received",
    fee: "Mshwar fee ({p}%)",
    yours: "Yours",
    upcoming: "Confirmed ahead: {n} bookings worth {amount}",
    downloadCsv: "Download CSV",
    colDate: "Date",
    colBooking: "Booking",
    colTour: "Tour",
    colGuests: "Guests",
    colExpected: "Booked",
    colReceived: "Received",
    notRecorded: "Not recorded",
    earningsEmpty: "No confirmed bookings in this month.",
    feeNote: "Mshwar's fee is 0% today. Founding Guides keep 0% for good.",
    insightsTitle: "Insights",
    insightsBody: "How each tour is doing, counted from real bookings only.",
    period: "Period",
    days30: "Last 30 days",
    days90: "Last 90 days",
    days365: "Last 12 months",
    colRequests: "Requests",
    colConfirmed: "Confirmed",
    colDeclined: "Declined",
    colLapsed: "Lapsed",
    colCancelled: "Cancelled (you / guest)",
    colGuestsServed: "Guests",
    colOccupancy: "Seats filled",
    replyTitle: "How fast you answer",
    replyStats: "{within} of {answered} requests answered within 24 hours · typical reply {time}",
    replyNone: "No requests answered in this period.",
    insightsEmpty: "No tours yet.",
    minutes: "{n} min",
    hours: "{n} h",
  },
  ar: {
    monthTitle: "شهرك",
    monthBody: "كل جولة وحجز ووقت مشغول ويوم استئجار بنظرة واحدة. اضغط على يوم لعرضه.",
    prevMonth: "الشهر السابق",
    nextMonth: "الشهر التالي",
    legendOpen: "متاح",
    legendPartly: "محجوز جزئياً",
    legendFull: "مكتمل",
    legendPrivate: "حجز خاص",
    legendBlocked: "مشغول",
    legendHired: "مستأجَر",
    legendOff: "يوم عطلة",
    dayEmpty: "لا شيء في هذا اليوم.",
    runSeats: "{reserved} من {capacity} محجوزة",
    runClosed: "مغلق",
    runPrivate: "خاص",
    guestsN: "{n} ضيوف",
    requestPending: "طلب",
    checkedIn: "حضر",
    noShow: "لم يحضر",
    blockManual: "محجوب",
    blockExternal: "مشغول في تقويمك",
    hiredDay: "مستأجَر لليوم",
    dayOff: "يوم عطلة",
    loadError: "تعذّر التحميل. حاول مجدداً.",
    syncTitle: "اربط تقاويمك",
    feedTitle: "اعرض مشوار في تقويمك الخاص",
    feedBody:
      "اشترك في عنوان خاص فتظهر جولاتك المؤكَّدة وأيام الاستئجار في Google أو Apple أو Outlook. لا تظهر أسماء الضيوف فيه أبداً.",
    feedCreate: "أنشئ العنوان",
    feedReplace: "أنشئ عنواناً جديداً",
    feedRevoke: "أوقف",
    feedActive:
      "هناك عنوان فعّال منذ {date}. يُعرض مرة واحدة فقط؛ أنشئ عنواناً جديداً إن احتجته مجدداً (ويتوقف القديم).",
    feedOnce: "انسخ هذا العنوان الآن. لن يُعرض مرة أخرى.",
    feedHow: "تقويم Google: تقاويم أخرى ← من عنوان URL. تقويم Apple: ملف ← اشتراك تقويم جديد.",
    copy: "نسخ",
    copied: "نُسخ",
    importTitle: "الوقت المشغول من تقاويمك الأخرى",
    importBody:
      "الصق عنوان iCal السري لتقويمك (Google: الإعدادات ← تقويمك ← العنوان السري بتنسيق iCal). نقرأ فقط متى تكون مشغولاً، لا تفاصيل الحدث، كل 15 دقيقة، ولا يستطيع المسافرون الحجز فوقه.",
    importUrl: "العنوان السري",
    importLabel: "الاسم (اختياري)",
    importAdd: "اربط",
    importSync: "زامِن الآن",
    importRemove: "افصل",
    importOk: "{n} أوقات مشغولة · قُرئ {date}",
    importFailed: "تعذّرت القراءة: {error}. تبقى آخر الأوقات المشغولة.",
    importPending: "بانتظار القراءة الأولى",
    importMax: "حتى 3 تقاويم.",
    importEmpty: "لا تقاويم مربوطة.",
    dayTitle: "يوم الجولة",
    dayNote: "قبل الانطلاق بساعة، سجّل حضور الضيوف وما دفعوه لك.",
    arrived: "حضر الضيوف",
    markNoShow: "لم يحضروا",
    checkedInAt: "سُجّل الحضور عند {time}",
    markedNoShow: "سُجّل عدم الحضور",
    paymentTitle: "الدفعة المستلمة",
    paymentAmount: "المبلغ (دولار)",
    paymentMethod: "الطريقة",
    methodcash: "نقداً",
    methodwallet: "محفظة (Whish، OMT…)",
    methodcard: "بطاقة",
    methodtransfer: "تحويل مصرفي",
    methodother: "أخرى",
    paymentSave: "احفظ الدفعة",
    paymentSaved: "سُجّل {amount} ({method})",
    paymentInvalid: "أدخل المبلغ الذي استلمته.",
    earningsTitle: "الأرباح",
    earningsBody: "ما قالته حجوزاتك وما سجّلته كمستلَم. يدفع لك الضيوف يوم الجولة؛ لا يحتفظ مشوار بأموالك أبداً.",
    month: "الشهر",
    expected: "قيمة الحجوزات",
    received: "المسجَّل كمستلَم",
    fee: "عمولة مشوار ({p}%)",
    yours: "لك",
    upcoming: "مؤكَّد لاحقاً: {n} حجوزات بقيمة {amount}",
    downloadCsv: "تنزيل CSV",
    colDate: "التاريخ",
    colBooking: "الحجز",
    colTour: "الجولة",
    colGuests: "الضيوف",
    colExpected: "المحجوز",
    colReceived: "المستلَم",
    notRecorded: "غير مسجَّل",
    earningsEmpty: "لا حجوزات مؤكَّدة في هذا الشهر.",
    feeNote: "عمولة مشوار 0% اليوم. ويحتفظ المرشدون المؤسِّسون بـ0% دائماً.",
    insightsTitle: "المؤشرات",
    insightsBody: "أداء كل جولة، محسوباً من الحجوزات الحقيقية فقط.",
    period: "الفترة",
    days30: "آخر 30 يوماً",
    days90: "آخر 90 يوماً",
    days365: "آخر 12 شهراً",
    colRequests: "الطلبات",
    colConfirmed: "المؤكَّدة",
    colDeclined: "المرفوضة",
    colLapsed: "المنتهية",
    colCancelled: "الملغاة (أنت / الضيف)",
    colGuestsServed: "الضيوف",
    colOccupancy: "المقاعد المشغولة",
    replyTitle: "سرعة ردّك",
    replyStats: "{within} من {answered} طلبات رُدّ عليها خلال 24 ساعة · الردّ المعتاد {time}",
    replyNone: "لا طلبات رُدّ عليها في هذه الفترة.",
    insightsEmpty: "لا جولات بعد.",
    minutes: "{n} د",
    hours: "{n} س",
  },
  fr: {
    monthTitle: "Votre mois",
    monthBody:
      "Chaque départ, réservation, créneau occupé et journée réservée en un coup d'œil. Touchez un jour pour le voir.",
    prevMonth: "Mois précédent",
    nextMonth: "Mois suivant",
    legendOpen: "Ouvert",
    legendPartly: "En partie réservé",
    legendFull: "Complet",
    legendPrivate: "Réservation privée",
    legendBlocked: "Occupé",
    legendHired: "Réservé à la journée",
    legendOff: "Jour de repos",
    dayEmpty: "Rien ce jour-là.",
    runSeats: "{reserved} sur {capacity} réservées",
    runClosed: "Fermé",
    runPrivate: "Privé",
    guestsN: "{n} participants",
    requestPending: "demande",
    checkedIn: "présent",
    noShow: "absent",
    blockManual: "Bloqué",
    blockExternal: "Occupé dans votre agenda",
    hiredDay: "Réservé à la journée",
    dayOff: "Jour de repos",
    loadError: "Chargement impossible. Réessayez.",
    syncTitle: "Connectez vos agendas",
    feedTitle: "Voir Mshwar dans votre propre agenda",
    feedBody:
      "Abonnez-vous à une adresse privée : vos départs confirmés et journées réservées apparaissent dans Google, Apple ou Outlook. Les noms des participants n'y figurent jamais.",
    feedCreate: "Créer l'adresse",
    feedReplace: "Créer une nouvelle adresse",
    feedRevoke: "Désactiver",
    feedActive:
      "Une adresse est active depuis le {date}. Elle n'est montrée qu'une fois ; créez-en une nouvelle si besoin (l'ancienne cesse de fonctionner).",
    feedOnce: "Copiez cette adresse maintenant. Elle n'est montrée qu'une fois.",
    feedHow: "Google Agenda : Autres agendas → À partir de l'URL. Calendrier Apple : Fichier → Nouvel abonnement.",
    copy: "Copier",
    copied: "Copié",
    importTitle: "Vos autres agendas",
    importBody:
      "Collez l'adresse iCal secrète d'un agenda (Google : Paramètres → votre agenda → Adresse secrète au format iCal). Nous lisons seulement quand vous êtes occupé, jamais le contenu, toutes les 15 minutes, et personne ne peut réserver par-dessus.",
    importUrl: "Adresse secrète",
    importLabel: "Nom (facultatif)",
    importAdd: "Connecter",
    importSync: "Synchroniser",
    importRemove: "Déconnecter",
    importOk: "{n} créneaux occupés · lu {date}",
    importFailed: "Lecture impossible : {error}. Les derniers créneaux sont conservés.",
    importPending: "En attente de la première lecture",
    importMax: "Jusqu'à 3 agendas.",
    importEmpty: "Aucun agenda connecté.",
    dayTitle: "Le jour J",
    dayNote: "Dès une heure avant le départ, pointez les participants et notez ce qu'ils vous ont payé.",
    arrived: "Participants présents",
    markNoShow: "Absents",
    checkedInAt: "Pointés à {time}",
    markedNoShow: "Indiqués absents",
    paymentTitle: "Paiement reçu",
    paymentAmount: "Montant (USD)",
    paymentMethod: "Moyen",
    methodcash: "Espèces",
    methodwallet: "Portefeuille (Whish, OMT…)",
    methodcard: "Carte",
    methodtransfer: "Virement",
    methodother: "Autre",
    paymentSave: "Enregistrer le paiement",
    paymentSaved: "Enregistré : {amount} ({method})",
    paymentInvalid: "Saisissez le montant reçu.",
    earningsTitle: "Revenus",
    earningsBody:
      "Ce que disaient vos réservations et ce que vous avez noté comme reçu. Les participants vous paient le jour même ; Mshwar ne détient jamais votre argent.",
    month: "Mois",
    expected: "Valeur réservée",
    received: "Noté comme reçu",
    fee: "Commission Mshwar ({p} %)",
    yours: "Pour vous",
    upcoming: "Confirmé à venir : {n} réservations pour {amount}",
    downloadCsv: "Télécharger le CSV",
    colDate: "Date",
    colBooking: "Réservation",
    colTour: "Visite",
    colGuests: "Participants",
    colExpected: "Réservé",
    colReceived: "Reçu",
    notRecorded: "Non noté",
    earningsEmpty: "Aucune réservation confirmée ce mois-ci.",
    feeNote: "La commission de Mshwar est de 0 % aujourd'hui. Les Guides fondateurs gardent 0 % pour toujours.",
    insightsTitle: "Statistiques",
    insightsBody: "Comment se porte chaque visite, d'après les vraies réservations uniquement.",
    period: "Période",
    days30: "30 derniers jours",
    days90: "90 derniers jours",
    days365: "12 derniers mois",
    colRequests: "Demandes",
    colConfirmed: "Confirmées",
    colDeclined: "Refusées",
    colLapsed: "Expirées",
    colCancelled: "Annulées (vous / client)",
    colGuestsServed: "Participants",
    colOccupancy: "Places remplies",
    replyTitle: "Votre rapidité de réponse",
    replyStats: "{within} demandes sur {answered} traitées en moins de 24 h · réponse typique {time}",
    replyNone: "Aucune demande traitée sur cette période.",
    insightsEmpty: "Pas encore de visite.",
    minutes: "{n} min",
    hours: "{n} h",
  },
};

export function useGuideWorkspaceCopy(): GuideWorkspaceCopy {
  const { locale } = useLocale();
  return guideWorkspaceCopy[locale];
}
