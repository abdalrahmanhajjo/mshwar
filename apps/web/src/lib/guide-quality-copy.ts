import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/**
 * Copy for quality, levels and ranking (guide plan step 7): review parts and replies, level
 * badges, the guide's own level and ranking page, strikes and the admin moderation screen.
 */
export type GuideQualityKey =
  | "levelTrusted"
  | "levelTop"
  | "levelNew"
  | "partknowledge"
  | "partcommunication"
  | "partvalue"
  | "partroute"
  | "partsOptional"
  | "reply"
  | "replyLabel"
  | "replySend"
  | "replyOnce"
  | "replyFrom"
  | "replyYours"
  | "toursGiven"
  | "repliesIn"
  | "minutes"
  | "hours"
  | "qualityTitle"
  | "qualityBody"
  | "yourLevel"
  | "heldUntil"
  | "nextLevel"
  | "atTop"
  | "gapruns"
  | "gaprating"
  | "gapanswered"
  | "gapmedian"
  | "gapcancel"
  | "thresholdsTitle"
  | "thresholdsTrusted"
  | "thresholdsTop"
  | "rankingTitle"
  | "rankingBody"
  | "rankreview"
  | "rankresponse"
  | "rankreliability"
  | "rankconversion"
  | "rankcompleteness"
  | "rankfreshness"
  | "tipreview"
  | "tipresponse"
  | "tipreliability"
  | "tipconversion"
  | "tipcompleteness"
  | "tipfreshness"
  | "newBoost"
  | "strikesTitle"
  | "strikesBody"
  | "strikesNone"
  | "strikeguide_cancellation"
  | "strikeno_show"
  | "strikesafety"
  | "strikeconduct"
  | "strikeother"
  | "strikeAutomatic"
  | "strikeExpires"
  | "strikeWithdrawn"
  | "pausedUntil"
  | "pausedBadge"
  | "statRuns"
  | "statRating"
  | "statAnswered"
  | "statCancel"
  | "adminTitle"
  | "adminBody"
  | "adminSearch"
  | "adminScore"
  | "adminStrikes"
  | "adminAddStrike"
  | "adminKind"
  | "adminReason"
  | "adminVoid"
  | "adminVoidReason"
  | "adminReviewsTitle"
  | "adminFilter"
  | "filterall"
  | "filterhidden"
  | "filterlow"
  | "filterreplied"
  | "adminHide"
  | "adminShow"
  | "adminRemoveReply"
  | "adminHidden"
  | "adminNotReleased"
  | "adminEmpty"
  | "loadError"
  | "save"
  | "cancel";

export type GuideQualityCopy = Record<GuideQualityKey, string>;

export const guideQualityCopy: Record<Locale, GuideQualityCopy> = {
  en: {
    levelTrusted: "Trusted guide",
    levelTop: "Top guide",
    levelNew: "New guide",
    partknowledge: "Knowledge",
    partcommunication: "Communication",
    partvalue: "Value",
    partroute: "Route",
    partsOptional: "Rate the details (optional)",
    reply: "Reply",
    replyLabel: "Your public reply",
    replySend: "Post reply",
    replyOnce: "You can reply once, and everyone can read it.",
    replyFrom: "Reply from {name}",
    replyYours: "Your reply",
    toursGiven: "{n} tours given",
    repliesIn: "Usually replies within {time}",
    minutes: "{n} min",
    hours: "{n} h",
    qualityTitle: "Level and ranking",
    qualityBody:
      'Your level and how "Recommended" ranks your tours, worked out every night from your last 12 months. The rules are the same for every guide.',
    yourLevel: "Your level",
    heldUntil: "Your numbers dipped below this level. You keep it until {date}; here is what to fix.",
    nextLevel: "To reach {level}",
    atTop: "You are at the top level. Keep it up.",
    gapruns: "Completed tours: {have} of {need}",
    gaprating: "Rating: {have} (needs {need})",
    gapanswered: "Requests answered within 24 h: {have} (needs {need})",
    gapmedian: "Typical reply: {have} min (needs under {need})",
    gapcancel: "Your cancellations: {have} (at most {need})",
    thresholdsTitle: "The thresholds",
    thresholdsTrusted:
      "Trusted: at least 5 completed tours, rating 4.6 or more, 90% of requests answered within 24 hours, at most 5% cancelled by you.",
    thresholdsTop:
      "Top guide: at least 25 completed tours, rating 4.8 or more, typical reply under 2 hours, at most 2% cancelled by you.",
    rankingTitle: 'How "Recommended" sees you',
    rankingBody: "Filters (date, language, place) come first; this score orders what is left.",
    rankreview: "Reviews",
    rankresponse: "Reply speed",
    rankreliability: "Reliability",
    rankconversion: "Requests accepted",
    rankcompleteness: "Profile and tours",
    rankfreshness: "Recent tours",
    tipreview:
      "Ask happy guests to leave a review; the score uses a fair average, so a few reviews count a little and many count a lot.",
    tipresponse: "Answer requests quickly, ideally within a few hours.",
    tipreliability: "Avoid cancelling confirmed bookings; block time in your calendar instead.",
    tipconversion: "Accept the requests you can run, or suggest another time.",
    tipcompleteness: "Add a longer bio, approved photos, a meeting point and dates in the next 30 days.",
    tipfreshness: "Run tours regularly: recent completed tours count here.",
    newBoost: "New-guide boost included for your first 60 days.",
    strikesTitle: "Strikes",
    strikesBody:
      "Cancelling a confirmed booking less than 72 hours before the start is a strike. So are no-shows, safety or conduct problems that Mshwar has checked. One strike is a warning, two pause new bookings for 14 days, three suspend the account. Strikes expire after 12 months.",
    strikesNone: "No strikes. Thank you.",
    strikeguide_cancellation: "Late cancellation",
    strikeno_show: "No-show",
    strikesafety: "Safety",
    strikeconduct: "Conduct",
    strikeother: "Other",
    strikeAutomatic: "recorded automatically",
    strikeExpires: "expires {date}",
    strikeWithdrawn: "withdrawn",
    pausedUntil: "New bookings are paused until {date}. Your existing bookings stand.",
    pausedBadge: "Paused until {date}",
    statRuns: "Completed tours",
    statRating: "Rating",
    statAnswered: "Answered within 24 h",
    statCancel: "Cancelled by you",
    adminTitle: "Guide quality",
    adminBody:
      "Levels, scores and strikes for every guide, and moderation of guide reviews. Strikes need a checked reason.",
    adminSearch: "Search guides",
    adminScore: "Score",
    adminStrikes: "Live strikes",
    adminAddStrike: "Add strike",
    adminKind: "Kind",
    adminReason: "Reason",
    adminVoid: "Withdraw",
    adminVoidReason: "Why withdraw it?",
    adminReviewsTitle: "Guide reviews",
    adminFilter: "Show",
    filterall: "All",
    filterhidden: "Hidden",
    filterlow: "Low ratings (1–2)",
    filterreplied: "With a reply",
    adminHide: "Hide",
    adminShow: "Show",
    adminRemoveReply: "Remove reply",
    adminHidden: "Hidden: {reason}",
    adminNotReleased: "Not published yet",
    adminEmpty: "Nothing here.",
    loadError: "We couldn't load this. Please try again.",
    save: "Save",
    cancel: "Cancel",
  },
  ar: {
    levelTrusted: "مرشد موثوق",
    levelTop: "مرشد متميّز",
    levelNew: "مرشد جديد",
    partknowledge: "المعرفة",
    partcommunication: "التواصل",
    partvalue: "القيمة",
    partroute: "المسار",
    partsOptional: "قيّم التفاصيل (اختياري)",
    reply: "ردّ",
    replyLabel: "ردّك العلني",
    replySend: "انشر الردّ",
    replyOnce: "يمكنك الردّ مرة واحدة، ويراه الجميع.",
    replyFrom: "ردّ من {name}",
    replyYours: "ردّك",
    toursGiven: "{n} جولات أُنجزت",
    repliesIn: "يردّ عادةً خلال {time}",
    minutes: "{n} د",
    hours: "{n} س",
    qualityTitle: "المستوى والترتيب",
    qualityBody: 'مستواك وكيف يرتّب "المقترَح" جولاتك، يُحسبان كل ليلة من آخر 12 شهراً. القواعد نفسها لكل المرشدين.',
    yourLevel: "مستواك",
    heldUntil: "انخفضت أرقامك دون هذا المستوى. تحتفظ به حتى {date}؛ إليك ما يجب تحسينه.",
    nextLevel: "للوصول إلى {level}",
    atTop: "أنت في أعلى مستوى. واصل.",
    gapruns: "الجولات المنجزة: {have} من {need}",
    gaprating: "التقييم: {have} (المطلوب {need})",
    gapanswered: "الطلبات المُجابة خلال 24 ساعة: {have} (المطلوب {need})",
    gapmedian: "الردّ المعتاد: {have} د (المطلوب أقل من {need})",
    gapcancel: "إلغاءاتك: {have} (بحد أقصى {need})",
    thresholdsTitle: "الشروط",
    thresholdsTrusted:
      "موثوق: 5 جولات منجزة على الأقل، تقييم 4.6 أو أكثر، الردّ على 90% من الطلبات خلال 24 ساعة، وإلغاء 5% كحد أقصى من جهتك.",
    thresholdsTop:
      "متميّز: 25 جولة منجزة على الأقل، تقييم 4.8 أو أكثر، ردّ معتاد خلال أقل من ساعتين، وإلغاء 2% كحد أقصى من جهتك.",
    rankingTitle: 'كيف يراك "المقترَح"',
    rankingBody: "تُطبَّق الفلاتر (التاريخ، اللغة، المكان) أولاً، ثم يرتّب هذا الرقم ما تبقّى.",
    rankreview: "التقييمات",
    rankresponse: "سرعة الردّ",
    rankreliability: "الالتزام",
    rankconversion: "الطلبات المقبولة",
    rankcompleteness: "الملف والجولات",
    rankfreshness: "جولات حديثة",
    tipreview:
      "اطلب من الضيوف الراضين ترك تقييم؛ يعتمد الرقم على متوسط عادل، فالتقييمات القليلة تُحتسب قليلاً والكثيرة كثيراً.",
    tipresponse: "أجب عن الطلبات بسرعة، ويُفضَّل خلال ساعات قليلة.",
    tipreliability: "تجنّب إلغاء الحجوزات المؤكَّدة؛ احجب الوقت في تقويمك بدلاً من ذلك.",
    tipconversion: "اقبل الطلبات التي تستطيع تنفيذها، أو اقترح وقتاً آخر.",
    tipcompleteness: "أضف نبذة أطول وصوراً معتمدة ونقطة لقاء ومواعيد خلال الثلاثين يوماً القادمة.",
    tipfreshness: "نفّذ جولات بانتظام: تُحتسب هنا الجولات المنجزة مؤخراً.",
    newBoost: "يشمل دفعة المرشد الجديد خلال أول 60 يوماً.",
    strikesTitle: "المخالفات",
    strikesBody:
      "إلغاء حجز مؤكَّد قبل أقل من 72 ساعة من الانطلاق مخالفة، وكذلك عدم الحضور أو مشاكل السلامة أو السلوك التي تحقّق منها مشوار. مخالفة واحدة تنبيه، واثنتان توقفان الحجوزات الجديدة 14 يوماً، وثلاث تعلّق الحساب. تنتهي المخالفات بعد 12 شهراً.",
    strikesNone: "لا مخالفات. شكراً لك.",
    strikeguide_cancellation: "إلغاء متأخر",
    strikeno_show: "عدم حضور",
    strikesafety: "السلامة",
    strikeconduct: "السلوك",
    strikeother: "أخرى",
    strikeAutomatic: "سُجّلت تلقائياً",
    strikeExpires: "تنتهي {date}",
    strikeWithdrawn: "سُحبت",
    pausedUntil: "الحجوزات الجديدة متوقفة حتى {date}. تبقى حجوزاتك القائمة.",
    pausedBadge: "متوقف حتى {date}",
    statRuns: "الجولات المنجزة",
    statRating: "التقييم",
    statAnswered: "الردّ خلال 24 ساعة",
    statCancel: "ألغيتَها أنت",
    adminTitle: "جودة المرشدين",
    adminBody:
      "المستويات والأرقام والمخالفات لكل مرشد، ومراجعة تقييمات المرشدين. تحتاج المخالفات إلى سبب تم التحقق منه.",
    adminSearch: "ابحث عن مرشد",
    adminScore: "الرقم",
    adminStrikes: "مخالفات قائمة",
    adminAddStrike: "أضف مخالفة",
    adminKind: "النوع",
    adminReason: "السبب",
    adminVoid: "اسحب",
    adminVoidReason: "لماذا تسحبها؟",
    adminReviewsTitle: "تقييمات المرشدين",
    adminFilter: "اعرض",
    filterall: "الكل",
    filterhidden: "المخفية",
    filterlow: "تقييمات منخفضة (1–2)",
    filterreplied: "مع ردّ",
    adminHide: "أخفِ",
    adminShow: "أظهِر",
    adminRemoveReply: "احذف الردّ",
    adminHidden: "مخفي: {reason}",
    adminNotReleased: "لم يُنشر بعد",
    adminEmpty: "لا شيء هنا.",
    loadError: "تعذّر التحميل. حاول مجدداً.",
    save: "حفظ",
    cancel: "إلغاء",
  },
  fr: {
    levelTrusted: "Guide de confiance",
    levelTop: "Guide d'excellence",
    levelNew: "Nouveau guide",
    partknowledge: "Connaissances",
    partcommunication: "Communication",
    partvalue: "Rapport qualité-prix",
    partroute: "Itinéraire",
    partsOptional: "Notez les détails (facultatif)",
    reply: "Répondre",
    replyLabel: "Votre réponse publique",
    replySend: "Publier la réponse",
    replyOnce: "Vous pouvez répondre une fois, et tout le monde peut la lire.",
    replyFrom: "Réponse de {name}",
    replyYours: "Votre réponse",
    toursGiven: "{n} visites menées",
    repliesIn: "Répond en général en {time}",
    minutes: "{n} min",
    hours: "{n} h",
    qualityTitle: "Niveau et classement",
    qualityBody:
      "Votre niveau et la façon dont « Recommandé » classe vos visites, recalculés chaque nuit sur vos 12 derniers mois. Les règles sont les mêmes pour tous les guides.",
    yourLevel: "Votre niveau",
    heldUntil: "Vos chiffres sont passés sous ce niveau. Vous le gardez jusqu'au {date} ; voici quoi améliorer.",
    nextLevel: "Pour atteindre {level}",
    atTop: "Vous êtes au niveau le plus haut. Continuez ainsi.",
    gapruns: "Visites menées : {have} sur {need}",
    gaprating: "Note : {have} (il faut {need})",
    gapanswered: "Demandes traitées en 24 h : {have} (il faut {need})",
    gapmedian: "Réponse typique : {have} min (il faut moins de {need})",
    gapcancel: "Vos annulations : {have} (au plus {need})",
    thresholdsTitle: "Les seuils",
    thresholdsTrusted:
      "Confiance : au moins 5 visites menées, note de 4,6 ou plus, 90 % des demandes traitées en 24 heures, au plus 5 % annulées par vous.",
    thresholdsTop:
      "Excellence : au moins 25 visites menées, note de 4,8 ou plus, réponse typique en moins de 2 heures, au plus 2 % annulées par vous.",
    rankingTitle: "Comment « Recommandé » vous voit",
    rankingBody: "Les filtres (date, langue, lieu) passent d'abord ; ce score ordonne le reste.",
    rankreview: "Avis",
    rankresponse: "Rapidité de réponse",
    rankreliability: "Fiabilité",
    rankconversion: "Demandes acceptées",
    rankcompleteness: "Profil et visites",
    rankfreshness: "Visites récentes",
    tipreview:
      "Invitez les clients satisfaits à laisser un avis ; le score utilise une moyenne équitable, donc quelques avis comptent peu et beaucoup comptent beaucoup.",
    tipresponse: "Répondez vite aux demandes, idéalement en quelques heures.",
    tipreliability: "Évitez d'annuler des réservations confirmées ; bloquez plutôt le temps dans votre agenda.",
    tipconversion: "Acceptez les demandes que vous pouvez assurer, ou proposez un autre horaire.",
    tipcompleteness:
      "Ajoutez une bio plus longue, des photos approuvées, un point de rendez-vous et des dates dans les 30 prochains jours.",
    tipfreshness: "Menez des visites régulièrement : les visites récentes comptent ici.",
    newBoost: "Coup de pouce « nouveau guide » inclus pendant vos 60 premiers jours.",
    strikesTitle: "Avertissements",
    strikesBody:
      "Annuler une réservation confirmée moins de 72 heures avant le départ est un avertissement, tout comme une absence, un problème de sécurité ou de conduite vérifié par Mshwar. Un avertissement prévient, deux suspendent les nouvelles réservations 14 jours, trois suspendent le compte. Ils expirent après 12 mois.",
    strikesNone: "Aucun avertissement. Merci.",
    strikeguide_cancellation: "Annulation tardive",
    strikeno_show: "Absence",
    strikesafety: "Sécurité",
    strikeconduct: "Conduite",
    strikeother: "Autre",
    strikeAutomatic: "enregistré automatiquement",
    strikeExpires: "expire le {date}",
    strikeWithdrawn: "retiré",
    pausedUntil: "Les nouvelles réservations sont suspendues jusqu'au {date}. Vos réservations existantes restent.",
    pausedBadge: "En pause jusqu'au {date}",
    statRuns: "Visites menées",
    statRating: "Note",
    statAnswered: "Traitées en 24 h",
    statCancel: "Annulées par vous",
    adminTitle: "Qualité des guides",
    adminBody:
      "Niveaux, scores et avertissements de chaque guide, et modération des avis. Un avertissement demande une raison vérifiée.",
    adminSearch: "Chercher un guide",
    adminScore: "Score",
    adminStrikes: "Avertissements actifs",
    adminAddStrike: "Ajouter un avertissement",
    adminKind: "Type",
    adminReason: "Raison",
    adminVoid: "Retirer",
    adminVoidReason: "Pourquoi le retirer ?",
    adminReviewsTitle: "Avis sur les guides",
    adminFilter: "Afficher",
    filterall: "Tous",
    filterhidden: "Masqués",
    filterlow: "Notes basses (1–2)",
    filterreplied: "Avec réponse",
    adminHide: "Masquer",
    adminShow: "Afficher",
    adminRemoveReply: "Retirer la réponse",
    adminHidden: "Masqué : {reason}",
    adminNotReleased: "Pas encore publié",
    adminEmpty: "Rien ici.",
    loadError: "Chargement impossible. Réessayez.",
    save: "Enregistrer",
    cancel: "Annuler",
  },
};

export function useGuideQualityCopy(): GuideQualityCopy {
  const { locale } = useLocale();
  return guideQualityCopy[locale];
}
