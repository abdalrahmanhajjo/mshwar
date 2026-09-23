import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/** Copy for the guide's working screens (G2): home, tours, calendar, requests, and tours on a public page. */
export type GuideWorkKey =
  | "portalKicker"
  | "notApprovedTitle"
  | "notApprovedBody"
  | "openApplication"
  | "loadError"
  | "saving"
  | "homeTitle"
  | "homeBody"
  | "homePending"
  | "homeUpcoming"
  | "homeTours"
  | "homeNextTitle"
  | "homeNothingNext"
  | "homeYourPage"
  | "homeGoRequests"
  | "homeGoTours"
  | "homeGoCalendar"
  | "toursTitle"
  | "toursBody"
  | "toursEmpty"
  | "tourNew"
  | "tourEdit"
  | "tourCancelEdit"
  | "tourTitle"
  | "tourDescription"
  | "tourDuration"
  | "tourMaxParty"
  | "tourMinAge"
  | "tourPrice"
  | "tourPriceUnit"
  | "tourPerPerson"
  | "tourPerGroup"
  | "tourHostFree"
  | "tourPaidOnDay"
  | "tourLanguages"
  | "tourMeetingName"
  | "tourMeetingAddress"
  | "tourMeetingLat"
  | "tourMeetingLng"
  | "tourMeetingDestination"
  | "tourRoute"
  | "tourRouteHint"
  | "tourRouteAdd"
  | "tourRoutePlaceholder"
  | "tourRouteRemove"
  | "tourRouteUp"
  | "tourRouteDown"
  | "tourRouteEmpty"
  | "tourIncluded"
  | "tourBring"
  | "tourCancellation"
  | "tourSave"
  | "tourSaved"
  | "tourPhoto"
  | "tourPhotoHint"
  | "tourPhotoUpload"
  | "tourPhotoCount"
  | "tourPublish"
  | "tourPublished"
  | "tourDraft"
  | "tourPaused"
  | "tourPublishBlocked"
  | "tourOpenDates"
  | "tourDatesOpened"
  | "tourDatesCapped"
  | "tourUpcoming"
  | "tourMinutes"
  | "tourFree"
  | "calendarTitle"
  | "calendarBody"
  | "weekday0"
  | "weekday1"
  | "weekday2"
  | "weekday3"
  | "weekday4"
  | "weekday5"
  | "weekday6"
  | "calendarAddStart"
  | "calendarRemoveStart"
  | "calendarNoStarts"
  | "calendarNotice"
  | "calendarNoticeHint"
  | "calendarCap"
  | "calendarCapHint"
  | "calendarDaysOff"
  | "calendarAddDayOff"
  | "calendarReason"
  | "calendarSave"
  | "calendarSaved"
  | "calendarOpenTitle"
  | "calendarOpenBody"
  | "requestsTitle"
  | "requestsBody"
  | "requestsEmpty"
  | "requestsPending"
  | "requestsConfirmed"
  | "requestsAll"
  | "requestParty"
  | "requestNote"
  | "requestNoteConfirm"
  | "requestNoteDecline"
  | "requestConfirm"
  | "requestDecline"
  | "requestCollect"
  | "requestFree"
  | "statusPending"
  | "statusConfirmed"
  | "statusRejected"
  | "statusCancelled"
  | "statusCompleted"
  | "statusExpired"
  | "publicToursTitle"
  | "publicToursEmpty"
  | "publicNextDates"
  | "publicNoDates"
  | "publicParty"
  | "publicRequest"
  | "publicRequesting"
  | "publicRequested"
  | "publicSignIn"
  | "publicMeeting"
  | "publicRoute"
  | "publicPerPerson"
  | "publicPerGroup"
  | "publicPayOnDay";

export const guideWorkCopy: Record<Locale, Record<GuideWorkKey, string>> = {
  en: {
    portalKicker: "Guide portal",
    notApprovedTitle: "Your guide page isn’t live yet",
    notApprovedBody: "Tours, dates and requests open once your application is approved.",
    openApplication: "Go to your application",
    loadError: "Couldn’t load this. Try again.",
    saving: "Saving…",
    homeTitle: "Your days",
    homeBody: "What’s coming up, what’s waiting for an answer, and what travellers can ask for.",
    homePending: "Waiting for you",
    homeUpcoming: "Confirmed",
    homeTours: "Published tours",
    homeNextTitle: "Coming up",
    homeNothingNext: "Nothing confirmed yet. Publish a tour and open some dates.",
    homeYourPage: "Your page and documents",
    homeGoRequests: "Answer requests",
    homeGoTours: "Build a tour",
    homeGoCalendar: "Set your days",
    toursTitle: "Tours",
    toursBody: "Each tour is a walk or a day you already run: where you meet, where you go, what it costs.",
    toursEmpty: "No tours yet. Start with the one you run most often.",
    tourNew: "New tour",
    tourEdit: "Edit",
    tourCancelEdit: "Close",
    tourTitle: "Title",
    tourDescription: "What happens on the day",
    tourDuration: "Length (minutes)",
    tourMaxParty: "Largest group",
    tourMinAge: "Youngest age (optional)",
    tourPrice: "Price (USD)",
    tourPriceUnit: "Charged per",
    tourPerPerson: "Person",
    tourPerGroup: "Group",
    tourHostFree: "Local hosts run free walks. Travellers can tip you on the day.",
    tourPaidOnDay: "Travellers pay you on the day. Mshwar never handles the money.",
    tourLanguages: "Languages on this tour",
    tourMeetingName: "Meeting point",
    tourMeetingAddress: "Address or directions",
    tourMeetingLat: "Latitude",
    tourMeetingLng: "Longitude",
    tourMeetingDestination: "Nearest destination",
    tourRoute: "Route",
    tourRouteHint: "Places from the catalogue, in the order you visit them.",
    tourRouteAdd: "Add stop",
    tourRoutePlaceholder: "Search a place by name, e.g. Byblos Citadel",
    tourRouteRemove: "Remove stop",
    tourRouteUp: "Move earlier",
    tourRouteDown: "Move later",
    tourRouteEmpty: "No stops yet. A tour can be just a meeting point.",
    tourIncluded: "What’s included",
    tourBring: "What to bring",
    tourCancellation: "If a traveller can’t make it",
    tourSave: "Save tour",
    tourSaved: "Saved.",
    tourPhoto: "Photo",
    tourPhotoHint: "One clear photo from the walk. A tour needs one to go live.",
    tourPhotoUpload: "Upload a photo",
    tourPhotoCount: "{n} photos",
    tourPublish: "Publish",
    tourPublished: "Live",
    tourDraft: "Draft",
    tourPaused: "Paused",
    tourPublishBlocked: "Before this can go live:",
    tourOpenDates: "Open dates from my calendar",
    tourDatesOpened: "{n} new dates open.",
    tourDatesCapped: "{n} left closed — they’d go over your daily limit.",
    tourUpcoming: "{n} open dates",
    tourMinutes: "{n} min",
    tourFree: "Free",
    calendarTitle: "When you guide",
    calendarBody: "Set a weekly rhythm once. Mshwar turns it into dates travellers can ask for.",
    weekday0: "Monday",
    weekday1: "Tuesday",
    weekday2: "Wednesday",
    weekday3: "Thursday",
    weekday4: "Friday",
    weekday5: "Saturday",
    weekday6: "Sunday",
    calendarAddStart: "Add a start",
    calendarRemoveStart: "Remove start",
    calendarNoStarts: "Not guiding",
    calendarNotice: "Notice you need (hours)",
    calendarNoticeHint: "Nobody can ask for a start sooner than this.",
    calendarCap: "Most tours in one day",
    calendarCapHint: "Counts every tour you run, so your day never double-books.",
    calendarDaysOff: "Days off",
    calendarAddDayOff: "Add a day off",
    calendarReason: "Note (only you see it)",
    calendarSave: "Save calendar",
    calendarSaved: "Saved. Open dates on a tour to use it.",
    calendarOpenTitle: "Open dates",
    calendarOpenBody: "Apply your rhythm to the next four weeks of a tour. Dates already open stay as they are.",
    requestsTitle: "Requests",
    requestsBody: "Travellers ask; you confirm or decline. Either way they hear from you, with your note.",
    requestsEmpty: "No requests here.",
    requestsPending: "Waiting",
    requestsConfirmed: "Confirmed",
    requestsAll: "All",
    requestParty: "{n} people",
    requestNote: "Note to the traveller",
    requestNoteConfirm: "See you at the meeting point.",
    requestNoteDecline: "I can’t run this date.",
    requestConfirm: "Confirm",
    requestDecline: "Decline",
    requestCollect: "Collect {amount} on the day",
    requestFree: "Free walk",
    statusPending: "Waiting for you",
    statusConfirmed: "Confirmed",
    statusRejected: "Declined",
    statusCancelled: "Cancelled",
    statusCompleted: "Completed",
    statusExpired: "Expired",
    publicToursTitle: "Tours",
    publicToursEmpty: "No tours published yet.",
    publicNextDates: "Next dates",
    publicNoDates: "No open dates right now.",
    publicParty: "Group size",
    publicRequest: "Ask for this date",
    publicRequesting: "Sending…",
    publicRequested: "Request sent. {name} will confirm — you pay on the day.",
    publicSignIn: "Sign in to ask for a date",
    publicMeeting: "Meeting point",
    publicRoute: "Route",
    publicPerPerson: "per person",
    publicPerGroup: "per group",
    publicPayOnDay: "Pay the guide on the day",
  },
  ar: {
    portalKicker: "بوابة المرشد",
    notApprovedTitle: "صفحتك كمرشد ليست منشورة بعد",
    notApprovedBody: "تُفتح الجولات والمواعيد والطلبات بعد الموافقة على طلبك.",
    openApplication: "اذهب إلى طلبك",
    loadError: "تعذّر التحميل. حاول مجددًا.",
    saving: "جارٍ الحفظ…",
    homeTitle: "أيامك",
    homeBody: "ما هو قادم، وما ينتظر ردّك، وما يمكن للمسافرين طلبه.",
    homePending: "بانتظارك",
    homeUpcoming: "مؤكّدة",
    homeTours: "جولات منشورة",
    homeNextTitle: "القادم",
    homeNothingNext: "لا شيء مؤكّد بعد. انشر جولة وافتح بعض المواعيد.",
    homeYourPage: "صفحتك ووثائقك",
    homeGoRequests: "الرد على الطلبات",
    homeGoTours: "أنشئ جولة",
    homeGoCalendar: "حدّد أيامك",
    toursTitle: "الجولات",
    toursBody: "كل جولة هي مشوار أو يوم تقوم به أصلًا: أين تلتقون، وإلى أين تذهبون، وكم يكلّف.",
    toursEmpty: "لا جولات بعد. ابدأ بالجولة التي تقوم بها أكثر من غيرها.",
    tourNew: "جولة جديدة",
    tourEdit: "تعديل",
    tourCancelEdit: "إغلاق",
    tourTitle: "العنوان",
    tourDescription: "ماذا يحدث في ذلك اليوم",
    tourDuration: "المدة (بالدقائق)",
    tourMaxParty: "أكبر مجموعة",
    tourMinAge: "أصغر عمر (اختياري)",
    tourPrice: "السعر (دولار)",
    tourPriceUnit: "يُحتسب لكل",
    tourPerPerson: "شخص",
    tourPerGroup: "مجموعة",
    tourHostFree: "المضيفون المحليون يقدّمون جولات مجانية. يمكن للمسافرين إعطاؤك إكرامية في اليوم نفسه.",
    tourPaidOnDay: "يدفع لك المسافرون في يوم الجولة. مشوار لا يتعامل مع المال أبدًا.",
    tourLanguages: "لغات هذه الجولة",
    tourMeetingName: "نقطة اللقاء",
    tourMeetingAddress: "العنوان أو الإرشادات",
    tourMeetingLat: "خط العرض",
    tourMeetingLng: "خط الطول",
    tourMeetingDestination: "أقرب وجهة",
    tourRoute: "المسار",
    tourRouteHint: "أماكن من الدليل، بالترتيب الذي تزورها فيه.",
    tourRouteAdd: "أضف محطة",
    tourRoutePlaceholder: "ابحث عن مكان بالاسم، مثل قلعة جبيل",
    tourRouteRemove: "احذف المحطة",
    tourRouteUp: "قدّمها",
    tourRouteDown: "أخّرها",
    tourRouteEmpty: "لا محطات بعد. يمكن أن تكون الجولة نقطة لقاء فقط.",
    tourIncluded: "ما هو مشمول",
    tourBring: "ماذا تحضر",
    tourCancellation: "إن لم يتمكّن المسافر من الحضور",
    tourSave: "احفظ الجولة",
    tourSaved: "تم الحفظ.",
    tourPhoto: "صورة",
    tourPhotoHint: "صورة واضحة واحدة من الجولة. تحتاج الجولة إلى صورة لتُنشر.",
    tourPhotoUpload: "ارفع صورة",
    tourPhotoCount: "{n} صور",
    tourPublish: "انشر",
    tourPublished: "منشورة",
    tourDraft: "مسودة",
    tourPaused: "متوقفة",
    tourPublishBlocked: "قبل أن تُنشر:",
    tourOpenDates: "افتح مواعيد من تقويمي",
    tourDatesOpened: "فُتح {n} موعدًا جديدًا.",
    tourDatesCapped: "بقي {n} مغلقًا — كانت ستتجاوز حدّك اليومي.",
    tourUpcoming: "{n} مواعيد مفتوحة",
    tourMinutes: "{n} دقيقة",
    tourFree: "مجانية",
    calendarTitle: "متى ترشد",
    calendarBody: "حدّد إيقاعًا أسبوعيًا مرة واحدة، ومشوار يحوّله إلى مواعيد يطلبها المسافرون.",
    weekday0: "الاثنين",
    weekday1: "الثلاثاء",
    weekday2: "الأربعاء",
    weekday3: "الخميس",
    weekday4: "الجمعة",
    weekday5: "السبت",
    weekday6: "الأحد",
    calendarAddStart: "أضف موعد انطلاق",
    calendarRemoveStart: "احذف موعد الانطلاق",
    calendarNoStarts: "لا جولات",
    calendarNotice: "المهلة التي تحتاجها (بالساعات)",
    calendarNoticeHint: "لا يمكن لأحد أن يطلب موعدًا أقرب من ذلك.",
    calendarCap: "أقصى عدد جولات في اليوم",
    calendarCapHint: "يُحتسب كل جولاتك، فلا يتضارب يومك أبدًا.",
    calendarDaysOff: "أيام العطلة",
    calendarAddDayOff: "أضف يوم عطلة",
    calendarReason: "ملاحظة (تراها أنت فقط)",
    calendarSave: "احفظ التقويم",
    calendarSaved: "تم الحفظ. افتح المواعيد على جولة لاستخدامه.",
    calendarOpenTitle: "افتح المواعيد",
    calendarOpenBody: "طبّق إيقاعك على الأسابيع الأربعة القادمة لجولة. المواعيد المفتوحة تبقى كما هي.",
    requestsTitle: "الطلبات",
    requestsBody: "يطلب المسافرون، وأنت تؤكّد أو ترفض. في الحالتين يصلهم ردّك مع ملاحظتك.",
    requestsEmpty: "لا طلبات هنا.",
    requestsPending: "بالانتظار",
    requestsConfirmed: "مؤكّدة",
    requestsAll: "الكل",
    requestParty: "{n} أشخاص",
    requestNote: "ملاحظة للمسافر",
    requestNoteConfirm: "أراك عند نقطة اللقاء.",
    requestNoteDecline: "لا أستطيع القيام بالجولة في هذا الموعد.",
    requestConfirm: "أكّد",
    requestDecline: "ارفض",
    requestCollect: "حصّل {amount} في يوم الجولة",
    requestFree: "جولة مجانية",
    statusPending: "بانتظارك",
    statusConfirmed: "مؤكّد",
    statusRejected: "مرفوض",
    statusCancelled: "ملغى",
    statusCompleted: "مكتمل",
    statusExpired: "منتهي",
    publicToursTitle: "الجولات",
    publicToursEmpty: "لا جولات منشورة بعد.",
    publicNextDates: "المواعيد القادمة",
    publicNoDates: "لا مواعيد مفتوحة حاليًا.",
    publicParty: "عدد الأشخاص",
    publicRequest: "اطلب هذا الموعد",
    publicRequesting: "جارٍ الإرسال…",
    publicRequested: "أُرسل الطلب. سيؤكّد {name} — والدفع في يوم الجولة.",
    publicSignIn: "سجّل الدخول لطلب موعد",
    publicMeeting: "نقطة اللقاء",
    publicRoute: "المسار",
    publicPerPerson: "للشخص",
    publicPerGroup: "للمجموعة",
    publicPayOnDay: "ادفع للمرشد في يوم الجولة",
  },
  fr: {
    portalKicker: "Espace guide",
    notApprovedTitle: "Votre page de guide n’est pas encore en ligne",
    notApprovedBody: "Circuits, dates et demandes s’ouvrent une fois votre candidature approuvée.",
    openApplication: "Voir ma candidature",
    loadError: "Chargement impossible. Réessayez.",
    saving: "Enregistrement…",
    homeTitle: "Vos journées",
    homeBody: "Ce qui arrive, ce qui attend votre réponse, et ce que les voyageurs peuvent demander.",
    homePending: "En attente de vous",
    homeUpcoming: "Confirmées",
    homeTours: "Circuits publiés",
    homeNextTitle: "À venir",
    homeNothingNext: "Rien de confirmé pour l’instant. Publiez un circuit et ouvrez des dates.",
    homeYourPage: "Votre page et vos documents",
    homeGoRequests: "Répondre aux demandes",
    homeGoTours: "Créer un circuit",
    homeGoCalendar: "Régler vos jours",
    toursTitle: "Circuits",
    toursBody:
      "Chaque circuit est une balade ou une journée que vous faites déjà : où l’on se retrouve, où l’on va, combien ça coûte.",
    toursEmpty: "Aucun circuit pour l’instant. Commencez par celui que vous faites le plus souvent.",
    tourNew: "Nouveau circuit",
    tourEdit: "Modifier",
    tourCancelEdit: "Fermer",
    tourTitle: "Titre",
    tourDescription: "Déroulé de la journée",
    tourDuration: "Durée (minutes)",
    tourMaxParty: "Groupe maximum",
    tourMinAge: "Âge minimum (facultatif)",
    tourPrice: "Prix (USD)",
    tourPriceUnit: "Facturé par",
    tourPerPerson: "Personne",
    tourPerGroup: "Groupe",
    tourHostFree:
      "Les hôtes locaux proposent des balades gratuites. Les voyageurs peuvent laisser un pourboire sur place.",
    tourPaidOnDay: "Les voyageurs vous paient le jour même. Mshwar ne manipule jamais l’argent.",
    tourLanguages: "Langues de ce circuit",
    tourMeetingName: "Point de rendez-vous",
    tourMeetingAddress: "Adresse ou indications",
    tourMeetingLat: "Latitude",
    tourMeetingLng: "Longitude",
    tourMeetingDestination: "Destination la plus proche",
    tourRoute: "Itinéraire",
    tourRouteHint: "Des lieux du catalogue, dans l’ordre de la visite.",
    tourRouteAdd: "Ajouter une étape",
    tourRoutePlaceholder: "Cherchez un lieu par son nom, ex. Citadelle de Byblos",
    tourRouteRemove: "Retirer l’étape",
    tourRouteUp: "Avancer",
    tourRouteDown: "Reculer",
    tourRouteEmpty: "Aucune étape. Un circuit peut n’être qu’un point de rendez-vous.",
    tourIncluded: "Ce qui est inclus",
    tourBring: "À apporter",
    tourCancellation: "Si un voyageur ne peut pas venir",
    tourSave: "Enregistrer le circuit",
    tourSaved: "Enregistré.",
    tourPhoto: "Photo",
    tourPhotoHint: "Une photo nette de la balade. Il en faut une pour publier.",
    tourPhotoUpload: "Ajouter une photo",
    tourPhotoCount: "{n} photos",
    tourPublish: "Publier",
    tourPublished: "En ligne",
    tourDraft: "Brouillon",
    tourPaused: "En pause",
    tourPublishBlocked: "Avant la mise en ligne :",
    tourOpenDates: "Ouvrir des dates depuis mon agenda",
    tourDatesOpened: "{n} nouvelles dates ouvertes.",
    tourDatesCapped: "{n} laissées fermées — elles dépasseraient votre limite quotidienne.",
    tourUpcoming: "{n} dates ouvertes",
    tourMinutes: "{n} min",
    tourFree: "Gratuit",
    calendarTitle: "Quand vous guidez",
    calendarBody:
      "Réglez un rythme hebdomadaire une fois ; Mshwar le transforme en dates que les voyageurs peuvent demander.",
    weekday0: "Lundi",
    weekday1: "Mardi",
    weekday2: "Mercredi",
    weekday3: "Jeudi",
    weekday4: "Vendredi",
    weekday5: "Samedi",
    weekday6: "Dimanche",
    calendarAddStart: "Ajouter un départ",
    calendarRemoveStart: "Retirer le départ",
    calendarNoStarts: "Pas de sortie",
    calendarNotice: "Délai de prévenance (heures)",
    calendarNoticeHint: "Personne ne peut demander un départ plus tôt que cela.",
    calendarCap: "Circuits maximum par jour",
    calendarCapHint: "Compte tous vos circuits, pour que votre journée ne soit jamais réservée deux fois.",
    calendarDaysOff: "Jours de repos",
    calendarAddDayOff: "Ajouter un jour de repos",
    calendarReason: "Note (visible par vous seul)",
    calendarSave: "Enregistrer l’agenda",
    calendarSaved: "Enregistré. Ouvrez des dates sur un circuit pour l’appliquer.",
    calendarOpenTitle: "Ouvrir des dates",
    calendarOpenBody:
      "Appliquez votre rythme aux quatre prochaines semaines d’un circuit. Les dates déjà ouvertes restent inchangées.",
    requestsTitle: "Demandes",
    requestsBody:
      "Les voyageurs demandent ; vous confirmez ou refusez. Dans les deux cas, ils reçoivent votre réponse et votre note.",
    requestsEmpty: "Aucune demande ici.",
    requestsPending: "En attente",
    requestsConfirmed: "Confirmées",
    requestsAll: "Toutes",
    requestParty: "{n} personnes",
    requestNote: "Note au voyageur",
    requestNoteConfirm: "À bientôt au point de rendez-vous.",
    requestNoteDecline: "Je ne peux pas assurer cette date.",
    requestConfirm: "Confirmer",
    requestDecline: "Refuser",
    requestCollect: "Encaisser {amount} le jour même",
    requestFree: "Balade gratuite",
    statusPending: "En attente de vous",
    statusConfirmed: "Confirmée",
    statusRejected: "Refusée",
    statusCancelled: "Annulée",
    statusCompleted: "Terminée",
    statusExpired: "Expirée",
    publicToursTitle: "Circuits",
    publicToursEmpty: "Aucun circuit publié pour l’instant.",
    publicNextDates: "Prochaines dates",
    publicNoDates: "Aucune date ouverte pour le moment.",
    publicParty: "Taille du groupe",
    publicRequest: "Demander cette date",
    publicRequesting: "Envoi…",
    publicRequested: "Demande envoyée. {name} va confirmer — vous payez le jour même.",
    publicSignIn: "Connectez-vous pour demander une date",
    publicMeeting: "Point de rendez-vous",
    publicRoute: "Itinéraire",
    publicPerPerson: "par personne",
    publicPerGroup: "par groupe",
    publicPayOnDay: "Payez le guide le jour même",
  },
};

export type GuideWorkCopy = Record<GuideWorkKey, string>;

export function useGuideWorkCopy(): GuideWorkCopy {
  const { locale } = useLocale();
  return guideWorkCopy[locale];
}
