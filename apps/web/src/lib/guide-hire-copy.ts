import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/** Copy for hiring a guide from the planner (G3), on both sides of the engagement. */
export type GuideHireKey =
  | "hireKicker"
  | "hireTitle"
  | "hireBody"
  | "hireNoPlan"
  | "hireOpenPlanner"
  | "hireLanguage"
  | "hireAnyLanguage"
  | "hireEmpty"
  | "hireRate"
  | "hireGroup"
  | "hireCovers"
  | "hireAsk"
  | "hireAsking"
  | "hireMessage"
  | "hireDietary"
  | "hireAccessibility"
  | "hireChildren"
  | "hirePhone"
  | "hireSend"
  | "hireClose"
  | "hireRequests"
  | "hireStateRequested"
  | "hireStateAccepted"
  | "hireStateDeclined"
  | "hireStateChanges"
  | "hireStateConfirmed"
  | "hireStateCompleted"
  | "hireStateCancelled"
  | "hireConfirm"
  | "hireAcceptChanges"
  | "hireRejectChanges"
  | "hireCancel"
  | "hireGuidePhone"
  | "hireNoPhone"
  | "hirePayOnDay"
  | "hireReason"
  | "hireVersion"
  | "hireLoadError"
  | "diffTitle"
  | "diffAdded"
  | "diffRemoved"
  | "diffRetimed"
  | "diffMoved"
  | "diffPosition"
  | "diffNote"
  | "diffRate"
  | "diffNothing"
  | "engKicker"
  | "engListTitle"
  | "engListEmpty"
  | "engOpen"
  | "engFrom"
  | "engParty"
  | "engRate"
  | "engItinerary"
  | "engLocked"
  | "engNotes"
  | "engMessage"
  | "engAccept"
  | "engDecline"
  | "engDeclineReason"
  | "engPropose"
  | "engProposeTitle"
  | "engProposeHint"
  | "engStart"
  | "engEnd"
  | "engRemove"
  | "engAddPlace"
  | "engAddSlug"
  | "engProposalNote"
  | "engProposalRate"
  | "engSendProposal"
  | "engTravellerPhone"
  | "engCancel"
  | "engCancelReason"
  | "engBack"
  | "engWaiting"
  | "termsTitle"
  | "termsBody"
  | "termsRate"
  | "termsGroup"
  | "termsSave"
  | "termsSaved"
  | "termsHost"
  | "termsLapsed"
  | "termsLive"
  | "hireGuideLink"
  | "hireReviewGuide";

export const guideHireCopy: Record<Locale, Record<GuideHireKey, string>> = {
  en: {
    hireKicker: "Hire a guide",
    hireTitle: "A guide for this day",
    hireBody:
      "Licensed guides who cover these places and are free that day. You agree the day together and pay the guide on the day.",
    hireNoPlan: "Save a plan first — a guide is hired for a planned day.",
    hireOpenPlanner: "Open the planner",
    hireLanguage: "Language",
    hireAnyLanguage: "Any language",
    hireEmpty: "No licensed guide is free for this day yet. Try another date or language.",
    hireRate: "{amount} a day",
    hireGroup: "Up to {n} people",
    hireCovers: "Covers {regions}",
    hireAsk: "Ask {name}",
    hireAsking: "Sending…",
    hireMessage: "Anything the guide should know",
    hireDietary: "Food needs",
    hireAccessibility: "Access needs",
    hireChildren: "Children in the group",
    hirePhone: "Your phone (shared once you both agree)",
    hireSend: "Send request",
    hireClose: "Close",
    hireRequests: "Your requests",
    hireStateRequested: "Waiting for the guide",
    hireStateAccepted: "The guide said yes",
    hireStateDeclined: "Declined",
    hireStateChanges: "Changes suggested",
    hireStateConfirmed: "Confirmed",
    hireStateCompleted: "Completed",
    hireStateCancelled: "Cancelled",
    hireConfirm: "Confirm the day",
    hireAcceptChanges: "Accept the changes",
    hireRejectChanges: "Keep my plan",
    hireCancel: "Cancel",
    hireGuidePhone: "Guide’s phone: {phone}",
    hireNoPhone: "The guide hasn’t added a phone number.",
    hirePayOnDay: "Pay {amount} to the guide on the day. Mshwar never handles the money.",
    hireReason: "Reason: {reason}",
    hireVersion: "Plan version {n}",
    hireLoadError: "Couldn’t load this. Try again.",
    diffTitle: "What would change",
    diffAdded: "Added",
    diffRemoved: "Removed",
    diffRetimed: "New time",
    diffMoved: "Moved",
    diffPosition: "Stop {from} → {to}",
    diffNote: "Guide’s note",
    diffRate: "Day rate: {amount}",
    diffNothing: "The stops stay as planned.",
    engKicker: "Hired day",
    engListTitle: "Days you’ve been asked to guide",
    engListEmpty: "No hire requests yet.",
    engOpen: "Open",
    engFrom: "From {name}",
    engParty: "{n} people",
    engRate: "{amount} for the day",
    engItinerary: "The plan",
    engLocked: "Locked by the traveller",
    engNotes: "About the group",
    engMessage: "Message",
    engAccept: "Accept as planned",
    engDecline: "Decline",
    engDeclineReason: "Why you can’t (the traveller sees this)",
    engPropose: "Propose changes",
    engProposeTitle: "Your version of the day",
    engProposeHint:
      "Change times, drop stops that aren’t locked, or add places. The traveller sees exactly what changed.",
    engStart: "Start",
    engEnd: "End",
    engRemove: "Remove",
    engAddPlace: "Add a place",
    engAddSlug: "Search a place by name, e.g. Byblos Citadel",
    engProposalNote: "Note to the traveller",
    engProposalRate: "Day rate in USD (optional)",
    engSendProposal: "Send proposal",
    engTravellerPhone: "Traveller’s phone: {phone}",
    engCancel: "Cancel this day",
    engCancelReason: "Why (the traveller sees this)",
    engBack: "Back to requests",
    engWaiting: "Waiting for the traveller.",
    termsTitle: "Being hired from the planner",
    termsBody: "Travellers planning a day can ask you to run it. Say what you charge for a day.",
    termsRate: "Day rate (USD)",
    termsGroup: "Largest group",
    termsSave: "Save",
    termsSaved: "Saved.",
    termsHost: "Local hosts aren’t hired from the planner. Travellers find your free walks on your page.",
    termsLapsed: "Your licence has to be verified and in date before travellers can hire you.",
    termsLive: "Travellers can hire you.",
    hireGuideLink: "Hire a guide",
    hireReviewGuide: "Review your guide",
  },
  ar: {
    hireKicker: "استأجر مرشدًا",
    hireTitle: "مرشد لهذا اليوم",
    hireBody:
      "مرشدون مرخّصون يغطّون هذه الأماكن ومتاحون في ذلك اليوم. تتفقان على اليوم معًا وتدفع للمرشد في اليوم نفسه.",
    hireNoPlan: "احفظ خطة أولًا — يُستأجر المرشد ليوم مخطَّط.",
    hireOpenPlanner: "افتح المخطِّط",
    hireLanguage: "اللغة",
    hireAnyLanguage: "أي لغة",
    hireEmpty: "لا يوجد مرشد مرخّص متاح لهذا اليوم بعد. جرّب تاريخًا أو لغة أخرى.",
    hireRate: "{amount} لليوم",
    hireGroup: "حتى {n} أشخاص",
    hireCovers: "يغطّي {regions}",
    hireAsk: "اطلب {name}",
    hireAsking: "جارٍ الإرسال…",
    hireMessage: "ما يجب أن يعرفه المرشد",
    hireDietary: "احتياجات غذائية",
    hireAccessibility: "احتياجات الوصول",
    hireChildren: "أطفال في المجموعة",
    hirePhone: "هاتفك (يُشارك بعد اتفاقكما)",
    hireSend: "أرسل الطلب",
    hireClose: "إغلاق",
    hireRequests: "طلباتك",
    hireStateRequested: "بانتظار المرشد",
    hireStateAccepted: "وافق المرشد",
    hireStateDeclined: "مرفوض",
    hireStateChanges: "تعديلات مقترحة",
    hireStateConfirmed: "مؤكَّد",
    hireStateCompleted: "مكتمل",
    hireStateCancelled: "ملغى",
    hireConfirm: "أكّد اليوم",
    hireAcceptChanges: "اقبل التعديلات",
    hireRejectChanges: "أبقِ خطتي",
    hireCancel: "إلغاء",
    hireGuidePhone: "هاتف المرشد: {phone}",
    hireNoPhone: "لم يضف المرشد رقم هاتف.",
    hirePayOnDay: "ادفع {amount} للمرشد في اليوم نفسه. مشوار لا يتعامل مع المال أبدًا.",
    hireReason: "السبب: {reason}",
    hireVersion: "نسخة الخطة {n}",
    hireLoadError: "تعذّر التحميل. حاول مجددًا.",
    diffTitle: "ما الذي سيتغيّر",
    diffAdded: "مُضاف",
    diffRemoved: "محذوف",
    diffRetimed: "وقت جديد",
    diffMoved: "نُقل",
    diffPosition: "المحطة {from} ← {to}",
    diffNote: "ملاحظة المرشد",
    diffRate: "أجر اليوم: {amount}",
    diffNothing: "تبقى المحطات كما خُطِّط.",
    engKicker: "يوم محجوز",
    engListTitle: "أيام طُلب منك إرشادها",
    engListEmpty: "لا طلبات استئجار بعد.",
    engOpen: "افتح",
    engFrom: "من {name}",
    engParty: "{n} أشخاص",
    engRate: "{amount} لليوم",
    engItinerary: "الخطة",
    engLocked: "مثبّت من المسافر",
    engNotes: "عن المجموعة",
    engMessage: "رسالة",
    engAccept: "اقبل كما خُطِّط",
    engDecline: "ارفض",
    engDeclineReason: "لماذا لا تستطيع (يراها المسافر)",
    engPropose: "اقترح تعديلات",
    engProposeTitle: "نسختك من اليوم",
    engProposeHint: "غيّر الأوقات، أو احذف المحطات غير المثبّتة، أو أضف أماكن. يرى المسافر ما تغيّر بدقّة.",
    engStart: "البداية",
    engEnd: "النهاية",
    engRemove: "احذف",
    engAddPlace: "أضف مكانًا",
    engAddSlug: "ابحث عن مكان بالاسم، مثل قلعة جبيل",
    engProposalNote: "ملاحظة للمسافر",
    engProposalRate: "أجر اليوم بالدولار (اختياري)",
    engSendProposal: "أرسل الاقتراح",
    engTravellerPhone: "هاتف المسافر: {phone}",
    engCancel: "ألغِ هذا اليوم",
    engCancelReason: "السبب (يراه المسافر)",
    engBack: "العودة إلى الطلبات",
    engWaiting: "بانتظار المسافر.",
    termsTitle: "الاستئجار من المخطِّط",
    termsBody: "يمكن للمسافرين الذين يخطّطون ليوم أن يطلبوك لإرشاده. حدّد أجرك لليوم.",
    termsRate: "أجر اليوم (دولار)",
    termsGroup: "أكبر مجموعة",
    termsSave: "احفظ",
    termsSaved: "تم الحفظ.",
    termsHost: "لا يُستأجر المضيفون المحليون من المخطِّط. يجد المسافرون جولاتك المجانية في صفحتك.",
    termsLapsed: "يجب أن تكون رخصتك موثّقة وسارية قبل أن يستأجرك المسافرون.",
    termsLive: "يمكن للمسافرين استئجارك.",
    hireGuideLink: "استأجر مرشدًا",
    hireReviewGuide: "قيّم مرشدك",
  },
  fr: {
    hireKicker: "Engager un guide",
    hireTitle: "Un guide pour cette journée",
    hireBody:
      "Des guides agréés qui couvrent ces lieux et sont libres ce jour-là. Vous convenez de la journée ensemble et payez le guide sur place.",
    hireNoPlan: "Enregistrez d’abord un plan — un guide s’engage pour une journée planifiée.",
    hireOpenPlanner: "Ouvrir le planificateur",
    hireLanguage: "Langue",
    hireAnyLanguage: "Toutes langues",
    hireEmpty: "Aucun guide agréé n’est libre ce jour-là pour l’instant. Essayez une autre date ou langue.",
    hireRate: "{amount} la journée",
    hireGroup: "Jusqu’à {n} personnes",
    hireCovers: "Couvre {regions}",
    hireAsk: "Demander à {name}",
    hireAsking: "Envoi…",
    hireMessage: "Ce que le guide doit savoir",
    hireDietary: "Régimes alimentaires",
    hireAccessibility: "Besoins d’accessibilité",
    hireChildren: "Enfants dans le groupe",
    hirePhone: "Votre téléphone (partagé une fois d’accord)",
    hireSend: "Envoyer la demande",
    hireClose: "Fermer",
    hireRequests: "Vos demandes",
    hireStateRequested: "En attente du guide",
    hireStateAccepted: "Le guide a dit oui",
    hireStateDeclined: "Refusée",
    hireStateChanges: "Changements proposés",
    hireStateConfirmed: "Confirmée",
    hireStateCompleted: "Terminée",
    hireStateCancelled: "Annulée",
    hireConfirm: "Confirmer la journée",
    hireAcceptChanges: "Accepter les changements",
    hireRejectChanges: "Garder mon plan",
    hireCancel: "Annuler",
    hireGuidePhone: "Téléphone du guide : {phone}",
    hireNoPhone: "Le guide n’a pas indiqué de numéro.",
    hirePayOnDay: "Payez {amount} au guide le jour même. Mshwar ne manipule jamais l’argent.",
    hireReason: "Motif : {reason}",
    hireVersion: "Version du plan {n}",
    hireLoadError: "Chargement impossible. Réessayez.",
    diffTitle: "Ce qui changerait",
    diffAdded: "Ajouté",
    diffRemoved: "Retiré",
    diffRetimed: "Nouvel horaire",
    diffMoved: "Déplacé",
    diffPosition: "Étape {from} → {to}",
    diffNote: "Note du guide",
    diffRate: "Tarif de la journée : {amount}",
    diffNothing: "Les étapes restent inchangées.",
    engKicker: "Journée engagée",
    engListTitle: "Journées qu’on vous demande de guider",
    engListEmpty: "Aucune demande pour l’instant.",
    engOpen: "Ouvrir",
    engFrom: "De {name}",
    engParty: "{n} personnes",
    engRate: "{amount} la journée",
    engItinerary: "Le plan",
    engLocked: "Verrouillé par le voyageur",
    engNotes: "À propos du groupe",
    engMessage: "Message",
    engAccept: "Accepter tel quel",
    engDecline: "Refuser",
    engDeclineReason: "Pourquoi vous ne pouvez pas (visible par le voyageur)",
    engPropose: "Proposer des changements",
    engProposeTitle: "Votre version de la journée",
    engProposeHint:
      "Changez les horaires, retirez les étapes non verrouillées ou ajoutez des lieux. Le voyageur voit exactement ce qui change.",
    engStart: "Début",
    engEnd: "Fin",
    engRemove: "Retirer",
    engAddPlace: "Ajouter un lieu",
    engAddSlug: "Cherchez un lieu par son nom, ex. Citadelle de Byblos",
    engProposalNote: "Note au voyageur",
    engProposalRate: "Tarif de la journée en USD (facultatif)",
    engSendProposal: "Envoyer la proposition",
    engTravellerPhone: "Téléphone du voyageur : {phone}",
    engCancel: "Annuler cette journée",
    engCancelReason: "Pourquoi (visible par le voyageur)",
    engBack: "Retour aux demandes",
    engWaiting: "En attente du voyageur.",
    termsTitle: "Être engagé depuis le planificateur",
    termsBody:
      "Les voyageurs qui planifient une journée peuvent vous demander de la guider. Indiquez votre tarif journalier.",
    termsRate: "Tarif journalier (USD)",
    termsGroup: "Groupe maximum",
    termsSave: "Enregistrer",
    termsSaved: "Enregistré.",
    termsHost:
      "Les hôtes locaux ne sont pas engagés depuis le planificateur. Les voyageurs trouvent vos balades gratuites sur votre page.",
    termsLapsed: "Votre licence doit être vérifiée et valide pour être engagé.",
    termsLive: "Les voyageurs peuvent vous engager.",
    hireGuideLink: "Engager un guide",
    hireReviewGuide: "Évaluer votre guide",
  },
};

export type GuideHireCopy = Record<GuideHireKey, string>;

export function useGuideHireCopy(): GuideHireCopy {
  const { locale } = useLocale();
  return guideHireCopy[locale];
}
