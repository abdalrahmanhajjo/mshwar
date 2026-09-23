import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/** Copy for place proposals (G4): the guide's contribute screen, the review queue and the credit line. */
export type ContributeKey =
  | "kicker"
  | "title"
  | "body"
  | "allowance"
  | "allowanceHint"
  | "tabNew"
  | "tabCorrection"
  | "name"
  | "description"
  | "category"
  | "destination"
  | "address"
  | "lat"
  | "lng"
  | "minutes"
  | "freeEntry"
  | "target"
  | "newTitle"
  | "newDescription"
  | "closed"
  | "note"
  | "evidence"
  | "evidenceHint"
  | "addEvidence"
  | "submit"
  | "sending"
  | "sent"
  | "photosTitle"
  | "photoOwn"
  | "photoGrant"
  | "photoUpload"
  | "photoCommons"
  | "commonsPage"
  | "commonsImage"
  | "commonsLicense"
  | "commonsAuthor"
  | "commonsAdd"
  | "alt"
  | "mineTitle"
  | "mineEmpty"
  | "statusSubmitted"
  | "statusAccepted"
  | "statusRejected"
  | "statusWithdrawn"
  | "kindNew"
  | "kindCorrection"
  | "withdraw"
  | "viewPlace"
  | "reason"
  | "addPhotos"
  | "loadError"
  | "queueTitle"
  | "queueBody"
  | "queueEmpty"
  | "queueFrom"
  | "queueCurrent"
  | "queueProposed"
  | "queueAccept"
  | "queueReject"
  | "queueReason"
  | "queueLicense"
  | "creditAdded"
  | "creditCorrected"
  | "catAdventure"
  | "catCity"
  | "catCoast"
  | "catCulture"
  | "catFood"
  | "catHeritage"
  | "catNature"
  | "catWellness"
  | "catWorkshop";

export const contributeCopy: Record<Locale, Record<ContributeKey, string>> = {
  en: {
    kicker: "Guide portal",
    title: "Add and correct places",
    body: "You know places the catalogue doesn’t, and notice when a listing is wrong. Every proposal needs a source; a reviewer checks it before anything changes.",
    allowance: "{remaining} of {cap} proposals left today",
    allowanceHint: "Each accepted proposal raises your daily limit.",
    tabNew: "A new place",
    tabCorrection: "A correction",
    name: "Name",
    description: "What it is and why people go",
    category: "Category",
    destination: "Nearest destination",
    address: "Address or directions",
    lat: "Latitude",
    lng: "Longitude",
    minutes: "Suggested visit (minutes)",
    freeEntry: "Entry is free",
    target: "Place to correct (its handle)",
    newTitle: "Correct name",
    newDescription: "Correct description",
    closed: "It has closed for good",
    note: "Note for the reviewer",
    evidence: "Sources that show this is right",
    evidenceHint: "At least one link: an official page, a news article, a map listing.",
    addEvidence: "Add a link",
    submit: "Send for review",
    sending: "Sending…",
    sent: "Sent. Add photos below if you have them.",
    photosTitle: "Photos",
    photoOwn: "A photo you took",
    photoGrant: "I took this photo and let Mshwar publish it with credit to me.",
    photoUpload: "Upload",
    photoCommons: "A photo from Wikimedia Commons",
    commonsPage: "File page (commons.wikimedia.org/wiki/File:…)",
    commonsImage: "Image address (upload.wikimedia.org/…)",
    commonsLicense: "Licence, as Commons shows it",
    commonsAuthor: "Author",
    commonsAdd: "Add photo",
    alt: "What the photo shows",
    mineTitle: "Your proposals",
    mineEmpty: "Nothing proposed yet.",
    statusSubmitted: "Waiting for review",
    statusAccepted: "Accepted",
    statusRejected: "Not accepted",
    statusWithdrawn: "Withdrawn",
    kindNew: "New place",
    kindCorrection: "Correction",
    withdraw: "Withdraw",
    viewPlace: "See the place",
    reason: "Reviewer: {reason}",
    addPhotos: "Add photos",
    loadError: "Couldn’t load this. Try again.",
    queueTitle: "Place proposals",
    queueBody:
      "New places and corrections from guides. Check the sources before accepting; accepted photos go live with their licence.",
    queueEmpty: "Nothing waiting.",
    queueFrom: "From {name} · {accepted} accepted, {rejected} not",
    queueCurrent: "Now",
    queueProposed: "Proposed",
    queueAccept: "Accept",
    queueReject: "Reject",
    queueReason: "Note to the guide (required to reject)",
    queueLicense: "{license} · {author}",
    creditAdded: "Added by {name}",
    creditCorrected: "Updated with help from {name}",
    catAdventure: "Adventure",
    catCity: "City",
    catCoast: "Coast",
    catCulture: "Culture",
    catFood: "Food",
    catHeritage: "Heritage",
    catNature: "Nature",
    catWellness: "Wellness",
    catWorkshop: "Workshop",
  },
  ar: {
    kicker: "بوابة المرشد",
    title: "أضف الأماكن وصحّحها",
    body: "تعرف أماكن لا يعرفها الدليل، وتلاحظ حين يكون عرض ما خاطئًا. يحتاج كل اقتراح إلى مصدر، ويراجعه مراجع قبل أي تغيير.",
    allowance: "تبقّى {remaining} من {cap} اقتراحات اليوم",
    allowanceHint: "كل اقتراح مقبول يرفع حدّك اليومي.",
    tabNew: "مكان جديد",
    tabCorrection: "تصحيح",
    name: "الاسم",
    description: "ما هو ولماذا يزوره الناس",
    category: "الفئة",
    destination: "أقرب وجهة",
    address: "العنوان أو الإرشادات",
    lat: "خط العرض",
    lng: "خط الطول",
    minutes: "مدة الزيارة المقترحة (بالدقائق)",
    freeEntry: "الدخول مجاني",
    target: "المكان المراد تصحيحه (معرّفه)",
    newTitle: "الاسم الصحيح",
    newDescription: "الوصف الصحيح",
    closed: "أُغلق نهائيًا",
    note: "ملاحظة للمراجع",
    evidence: "مصادر تُثبت صحة ذلك",
    evidenceHint: "رابط واحد على الأقل: صفحة رسمية، أو مقال، أو إدراج على خريطة.",
    addEvidence: "أضف رابطًا",
    submit: "أرسل للمراجعة",
    sending: "جارٍ الإرسال…",
    sent: "أُرسل. أضف صورًا أدناه إن وُجدت.",
    photosTitle: "الصور",
    photoOwn: "صورة التقطتها",
    photoGrant: "التقطتُ هذه الصورة وأسمح لمشوار بنشرها مع ذكر اسمي.",
    photoUpload: "ارفع",
    photoCommons: "صورة من ويكيميديا كومنز",
    commonsPage: "صفحة الملف (commons.wikimedia.org/wiki/File:…)",
    commonsImage: "عنوان الصورة (upload.wikimedia.org/…)",
    commonsLicense: "الترخيص كما يظهر في كومنز",
    commonsAuthor: "المؤلف",
    commonsAdd: "أضف الصورة",
    alt: "ما الذي تُظهره الصورة",
    mineTitle: "اقتراحاتك",
    mineEmpty: "لا اقتراحات بعد.",
    statusSubmitted: "بانتظار المراجعة",
    statusAccepted: "مقبول",
    statusRejected: "غير مقبول",
    statusWithdrawn: "مسحوب",
    kindNew: "مكان جديد",
    kindCorrection: "تصحيح",
    withdraw: "اسحب",
    viewPlace: "اعرض المكان",
    reason: "المراجع: {reason}",
    addPhotos: "أضف صورًا",
    loadError: "تعذّر التحميل. حاول مجددًا.",
    queueTitle: "اقتراحات الأماكن",
    queueBody: "أماكن جديدة وتصحيحات من المرشدين. تحقّق من المصادر قبل القبول؛ تُنشر الصور المقبولة مع ترخيصها.",
    queueEmpty: "لا شيء بالانتظار.",
    queueFrom: "من {name} · {accepted} مقبولة، {rejected} غير مقبولة",
    queueCurrent: "الآن",
    queueProposed: "المقترح",
    queueAccept: "اقبل",
    queueReject: "ارفض",
    queueReason: "ملاحظة للمرشد (مطلوبة للرفض)",
    queueLicense: "{license} · {author}",
    creditAdded: "أضافه {name}",
    creditCorrected: "حُدِّث بمساعدة {name}",
    catAdventure: "مغامرة",
    catCity: "مدينة",
    catCoast: "ساحل",
    catCulture: "ثقافة",
    catFood: "طعام",
    catHeritage: "تراث",
    catNature: "طبيعة",
    catWellness: "عافية",
    catWorkshop: "ورشة",
  },
  fr: {
    kicker: "Espace guide",
    title: "Ajouter et corriger des lieux",
    body: "Vous connaissez des lieux absents du catalogue et repérez les erreurs. Chaque proposition demande une source ; un relecteur vérifie avant tout changement.",
    allowance: "Encore {remaining} proposition(s) sur {cap} aujourd’hui",
    allowanceHint: "Chaque proposition acceptée augmente votre limite quotidienne.",
    tabNew: "Un nouveau lieu",
    tabCorrection: "Une correction",
    name: "Nom",
    description: "Ce que c’est et pourquoi y aller",
    category: "Catégorie",
    destination: "Destination la plus proche",
    address: "Adresse ou indications",
    lat: "Latitude",
    lng: "Longitude",
    minutes: "Durée de visite conseillée (minutes)",
    freeEntry: "L’entrée est gratuite",
    target: "Lieu à corriger (identifiant)",
    newTitle: "Nom correct",
    newDescription: "Description correcte",
    closed: "Il a fermé définitivement",
    note: "Note pour le relecteur",
    evidence: "Sources qui le prouvent",
    evidenceHint: "Au moins un lien : page officielle, article, fiche sur une carte.",
    addEvidence: "Ajouter un lien",
    submit: "Envoyer pour relecture",
    sending: "Envoi…",
    sent: "Envoyé. Ajoutez des photos ci-dessous si vous en avez.",
    photosTitle: "Photos",
    photoOwn: "Une photo que vous avez prise",
    photoGrant: "J’ai pris cette photo et j’autorise Mshwar à la publier avec mon nom.",
    photoUpload: "Envoyer",
    photoCommons: "Une photo de Wikimedia Commons",
    commonsPage: "Page du fichier (commons.wikimedia.org/wiki/File:…)",
    commonsImage: "Adresse de l’image (upload.wikimedia.org/…)",
    commonsLicense: "Licence, telle qu’affichée sur Commons",
    commonsAuthor: "Auteur",
    commonsAdd: "Ajouter la photo",
    alt: "Ce que montre la photo",
    mineTitle: "Vos propositions",
    mineEmpty: "Aucune proposition pour l’instant.",
    statusSubmitted: "En attente de relecture",
    statusAccepted: "Acceptée",
    statusRejected: "Refusée",
    statusWithdrawn: "Retirée",
    kindNew: "Nouveau lieu",
    kindCorrection: "Correction",
    withdraw: "Retirer",
    viewPlace: "Voir le lieu",
    reason: "Relecteur : {reason}",
    addPhotos: "Ajouter des photos",
    loadError: "Chargement impossible. Réessayez.",
    queueTitle: "Propositions de lieux",
    queueBody:
      "Nouveaux lieux et corrections proposés par des guides. Vérifiez les sources avant d’accepter ; les photos acceptées sont publiées avec leur licence.",
    queueEmpty: "Rien en attente.",
    queueFrom: "De {name} · {accepted} acceptée(s), {rejected} refusée(s)",
    queueCurrent: "Actuel",
    queueProposed: "Proposé",
    queueAccept: "Accepter",
    queueReject: "Refuser",
    queueReason: "Note au guide (obligatoire pour refuser)",
    queueLicense: "{license} · {author}",
    creditAdded: "Ajouté par {name}",
    creditCorrected: "Mis à jour avec l’aide de {name}",
    catAdventure: "Aventure",
    catCity: "Ville",
    catCoast: "Côte",
    catCulture: "Culture",
    catFood: "Gastronomie",
    catHeritage: "Patrimoine",
    catNature: "Nature",
    catWellness: "Bien-être",
    catWorkshop: "Atelier",
  },
};

export type ContributeCopy = Record<ContributeKey, string>;

export function useContributeCopy(): ContributeCopy {
  const { locale } = useLocale();
  return contributeCopy[locale];
}
