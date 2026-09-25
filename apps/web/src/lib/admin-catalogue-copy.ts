import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/** Copy for the staff screens that grow the planner: demand, language, leads, sourced prices, coverage. */
export type AdminCatalogueKey =
  | "loadError"
  | "period"
  | "lastDays"
  | "destinationLabel"
  | "anyDestination"
  | "anywhere"
  | "statusLabel"
  | "reasonLabel"
  | "plTitle"
  | "plBody"
  | "gapsTitle"
  | "gapsBody"
  | "gapsEmpty"
  | "colStep"
  | "colTimes"
  | "missesTitle"
  | "missesBody"
  | "missesEmpty"
  | "missSeen"
  | "missConcept"
  | "chooseConcept"
  | "phraseLocale"
  | "missTeach"
  | "missDismiss"
  | "ms_open"
  | "ms_resolved"
  | "ms_dismissed"
  | "phrasesTitle"
  | "phrasesBody"
  | "phrasesEmpty"
  | "phraseLabel"
  | "phraseAdd"
  | "phraseRetire"
  | "phraseRetired"
  | "loc_en"
  | "loc_ar"
  | "loc_arLB"
  | "loc_arabizi"
  | "loc_fr"
  | "loc_mixed"
  | "cgTitle"
  | "cgBody"
  | "leadsTitle"
  | "leadsBody"
  | "leadsEmpty"
  | "ls_new"
  | "ls_checking"
  | "ls_published"
  | "ls_rejected"
  | "ls_duplicate"
  | "kindOfPlace"
  | "anyKind"
  | "leadDemand"
  | "leadSource"
  | "leadMap"
  | "leadCheck"
  | "leadReject"
  | "leadDuplicate"
  | "leadPublish"
  | "publishDescription"
  | "publishNotes"
  | "publishConfirm"
  | "publishedAs"
  | "pricesTitle"
  | "pricesBody"
  | "pricesEmpty"
  | "priceReviewBy"
  | "priceCheckedOn"
  | "recordTitle"
  | "recordBody"
  | "listingId"
  | "priceType"
  | "pt_fixed"
  | "pt_from"
  | "pt_range"
  | "amount"
  | "maxAmount"
  | "currency"
  | "unit"
  | "unit_person"
  | "unit_group"
  | "sourceUrl"
  | "sourceName"
  | "checkedOn"
  | "reviewBy"
  | "note"
  | "savePrice"
  | "priceSaved"
  | "recheck"
  | "coverageTitle"
  | "coverageBody"
  | "untyped"
  | "kindsCount";

export const adminCatalogueCopy: Record<Locale, Record<AdminCatalogueKey, string>> = {
  en: {
    loadError: "We could not load this. Try again.",
    period: "Period",
    lastDays: "Last {days} days",
    destinationLabel: "Destination",
    anyDestination: "Any destination",
    anywhere: "Anywhere",
    statusLabel: "Status",
    reasonLabel: "Reason",
    plTitle: "Planner language and demand",
    plBody:
      "What travellers asked for that no trusted place could fill, and the words the planner did not understand. Counts and redacted words only: nothing here identifies a traveller.",
    gapsTitle: "Asked for, not found",
    gapsBody: "The kinds of step travellers wanted most that the day could not fill: what to check or recruit next.",
    gapsEmpty: "Every step asked for in this period was filled.",
    colStep: "Step",
    colTimes: "Times",
    missesTitle: "Words the planner could not read",
    missesBody:
      "Only from travellers who allowed it, with names, numbers and contacts removed. Teach a phrase when it clearly means one of the planner’s concepts; dismiss the rest.",
    missesEmpty: "Nothing to review.",
    missSeen: "{count}× · last {date}",
    missConcept: "It means",
    chooseConcept: "Choose a concept",
    phraseLocale: "Language",
    missTeach: "Teach this phrase",
    missDismiss: "Dismiss",
    ms_open: "To review",
    ms_resolved: "Taught",
    ms_dismissed: "Dismissed",
    phrasesTitle: "Approved phrases",
    phrasesBody: "Words the planner now reads as one of its concepts, in any language travellers use.",
    phrasesEmpty: "No phrases yet.",
    phraseLabel: "Phrase",
    phraseAdd: "Add phrase",
    phraseRetire: "Retire",
    phraseRetired: "Retired",
    loc_en: "English",
    loc_ar: "Arabic",
    loc_arLB: "Lebanese Arabic",
    loc_arabizi: "Arabizi",
    loc_fr: "French",
    loc_mixed: "Mixed",
    cgTitle: "Growing the catalogue",
    cgBody:
      "Places we have heard of but not checked, prices to check again against their source, and how many places of each kind the planner can use.",
    leadsTitle: "Leads to check",
    leadsBody:
      "From open data or official lists. A lead is never shown to travellers: it becomes a listing only after a visit or a call. Leads travellers asked for come first.",
    leadsEmpty: "No leads here.",
    ls_new: "New",
    ls_checking: "Being checked",
    ls_published: "Published",
    ls_rejected: "Rejected",
    ls_duplicate: "Duplicate",
    kindOfPlace: "Kind of place",
    anyKind: "Any kind",
    leadDemand: "Asked for {count}× and not found",
    leadSource: "Source: {source} {id}",
    leadMap: "Open on the map",
    leadCheck: "Start checking",
    leadReject: "Reject",
    leadDuplicate: "Duplicate",
    leadPublish: "Publish after the check",
    publishDescription: "Description for travellers",
    publishNotes: "What you checked, and how (visit or call)",
    publishConfirm: "Publish listing",
    publishedAs: "Published as {slug}. Its price stays on request until a published price is recorded.",
    pricesTitle: "Published prices to check again",
    pricesBody:
      "Each price was copied from its official source on a date. When it lapses, the planner stops using it and says “price on request”.",
    pricesEmpty: "No prices due.",
    priceReviewBy: "Check again by {date}",
    priceCheckedOn: "checked {date}",
    recordTitle: "Record a published price",
    recordBody: "Only a price the place or an authority published, with the link. Never an estimate.",
    listingId: "Listing ID",
    priceType: "Price",
    pt_fixed: "Fixed",
    pt_from: "From",
    pt_range: "Range",
    amount: "Amount",
    maxAmount: "Up to",
    currency: "Currency",
    unit: "Per",
    unit_person: "Person",
    unit_group: "Group",
    sourceUrl: "Link to the published price (https)",
    sourceName: "Published by",
    checkedOn: "Checked on",
    reviewBy: "Check again by",
    note: "Note",
    savePrice: "Save price",
    priceSaved: "Saved with its source.",
    recheck: "Record again",
    coverageTitle: "Kinds of place the planner can use",
    coverageBody:
      "Trusted places by kind in each destination, and those without a kind yet (the planner cannot offer them for a step).",
    untyped: "Without a kind",
    kindsCount: "{count} kinds",
  },
  ar: {
    loadError: "تعذّر التحميل. حاول مجددًا.",
    period: "الفترة",
    lastDays: "آخر {days} يومًا",
    destinationLabel: "الوجهة",
    anyDestination: "أي وجهة",
    anywhere: "أي مكان",
    statusLabel: "الحالة",
    reasonLabel: "السبب",
    plTitle: "لغة المخطِّط والطلب",
    plBody:
      "ما طلبه المسافرون ولم يجد له مكانًا موثوقًا، والكلمات التي لم يفهمها المخطِّط. أعداد وكلمات منقّحة فقط: لا شيء هنا يحدّد هوية أي مسافر.",
    gapsTitle: "طُلب ولم يُوجد",
    gapsBody:
      "أنواع الخطوات التي أرادها المسافرون أكثر ولم يتمكّن اليوم من تلبيتها: ما يجب التحقق منه أو استقطابه تاليًا.",
    gapsEmpty: "كل الخطوات المطلوبة في هذه الفترة لُبّيت.",
    colStep: "الخطوة",
    colTimes: "المرات",
    missesTitle: "كلمات لم يفهمها المخطِّط",
    missesBody:
      "فقط من المسافرين الذين سمحوا بذلك، بعد حذف الأسماء والأرقام ووسائل الاتصال. علّم المخطِّط عبارة حين تعني بوضوح أحد مفاهيمه، وتجاهل الباقي.",
    missesEmpty: "لا شيء للمراجعة.",
    missSeen: "{count} مرة · آخرها {date}",
    missConcept: "المعنى",
    chooseConcept: "اختر مفهومًا",
    phraseLocale: "اللغة",
    missTeach: "علّم هذه العبارة",
    missDismiss: "تجاهل",
    ms_open: "للمراجعة",
    ms_resolved: "تم تعليمها",
    ms_dismissed: "متجاهَلة",
    phrasesTitle: "العبارات المعتمدة",
    phrasesBody: "كلمات يقرأها المخطِّط الآن كأحد مفاهيمه، بأي لغة يستخدمها المسافرون.",
    phrasesEmpty: "لا عبارات بعد.",
    phraseLabel: "العبارة",
    phraseAdd: "أضف عبارة",
    phraseRetire: "أوقف",
    phraseRetired: "موقوفة",
    loc_en: "الإنجليزية",
    loc_ar: "العربية",
    loc_arLB: "اللبنانية",
    loc_arabizi: "العربيزي",
    loc_fr: "الفرنسية",
    loc_mixed: "مختلطة",
    cgTitle: "توسيع الدليل",
    cgBody:
      "أماكن سمعنا بها ولم نتحقق منها، وأسعار يجب مراجعتها مع مصدرها، وعدد الأماكن من كل نوع التي يمكن للمخطِّط استخدامها.",
    leadsTitle: "أماكن للتحقق منها",
    leadsBody:
      "من بيانات مفتوحة أو قوائم رسمية. لا يظهر أي منها للمسافرين: يصبح المكان مدرجًا فقط بعد زيارة أو اتصال. تأتي أولًا الأماكن التي طلبها المسافرون.",
    leadsEmpty: "لا أماكن هنا.",
    ls_new: "جديد",
    ls_checking: "قيد التحقق",
    ls_published: "منشور",
    ls_rejected: "مرفوض",
    ls_duplicate: "مكرّر",
    kindOfPlace: "نوع المكان",
    anyKind: "أي نوع",
    leadDemand: "طُلب {count} مرة ولم يُوجد",
    leadSource: "المصدر: {source} {id}",
    leadMap: "افتح على الخريطة",
    leadCheck: "ابدأ التحقق",
    leadReject: "ارفض",
    leadDuplicate: "مكرّر",
    leadPublish: "انشر بعد التحقق",
    publishDescription: "وصف للمسافرين",
    publishNotes: "ما الذي تحققت منه وكيف (زيارة أو اتصال)",
    publishConfirm: "انشر المكان",
    publishedAs: "نُشر باسم {slug}. يبقى سعره عند الطلب حتى يُسجَّل سعر منشور.",
    pricesTitle: "أسعار منشورة يجب مراجعتها",
    pricesBody:
      "نُسخ كل سعر من مصدره الرسمي في تاريخ محدّد. عند انتهاء صلاحيته يتوقف المخطِّط عن استخدامه ويعرض «السعر عند الطلب».",
    pricesEmpty: "لا أسعار مستحقة للمراجعة.",
    priceReviewBy: "راجع قبل {date}",
    priceCheckedOn: "تم التحقق {date}",
    recordTitle: "سجّل سعرًا منشورًا",
    recordBody: "فقط سعر نشره المكان أو جهة رسمية، مع الرابط. لا تقديرات أبدًا.",
    listingId: "معرّف المكان",
    priceType: "السعر",
    pt_fixed: "ثابت",
    pt_from: "ابتداءً من",
    pt_range: "نطاق",
    amount: "المبلغ",
    maxAmount: "حتى",
    currency: "العملة",
    unit: "لكل",
    unit_person: "شخص",
    unit_group: "مجموعة",
    sourceUrl: "رابط السعر المنشور (https)",
    sourceName: "نشره",
    checkedOn: "تاريخ التحقق",
    reviewBy: "راجع قبل",
    note: "ملاحظة",
    savePrice: "احفظ السعر",
    priceSaved: "حُفظ مع مصدره.",
    recheck: "سجّل من جديد",
    coverageTitle: "أنواع الأماكن التي يستخدمها المخطِّط",
    coverageBody:
      "الأماكن الموثوقة حسب النوع في كل وجهة، وتلك التي لا نوع لها بعد (لا يمكن للمخطِّط اقتراحها لأي خطوة).",
    untyped: "بلا نوع",
    kindsCount: "{count} أنواع",
  },
  fr: {
    loadError: "Chargement impossible. Réessayez.",
    period: "Période",
    lastDays: "{days} derniers jours",
    destinationLabel: "Destination",
    anyDestination: "Toutes les destinations",
    anywhere: "Partout",
    statusLabel: "Statut",
    reasonLabel: "Motif",
    plTitle: "Langage du planificateur et demande",
    plBody:
      "Ce que les voyageurs ont demandé sans lieu de confiance pour y répondre, et les mots que le planificateur n’a pas compris. Uniquement des comptes et des mots expurgés : rien ici n’identifie un voyageur.",
    gapsTitle: "Demandé, introuvable",
    gapsBody:
      "Les étapes les plus demandées que la journée n’a pas pu remplir : ce qu’il faut vérifier ou recruter ensuite.",
    gapsEmpty: "Toutes les étapes demandées sur cette période ont été remplies.",
    colStep: "Étape",
    colTimes: "Fois",
    missesTitle: "Mots que le planificateur n’a pas compris",
    missesBody:
      "Uniquement des voyageurs qui l’ont autorisé, sans noms, numéros ni contacts. Apprenez une expression quand elle désigne clairement un concept du planificateur ; écartez le reste.",
    missesEmpty: "Rien à examiner.",
    missSeen: "{count} fois · dernière le {date}",
    missConcept: "Cela signifie",
    chooseConcept: "Choisir un concept",
    phraseLocale: "Langue",
    missTeach: "Apprendre cette expression",
    missDismiss: "Écarter",
    ms_open: "À examiner",
    ms_resolved: "Apprises",
    ms_dismissed: "Écartées",
    phrasesTitle: "Expressions approuvées",
    phrasesBody:
      "Des mots que le planificateur lit désormais comme l’un de ses concepts, dans toutes les langues des voyageurs.",
    phrasesEmpty: "Aucune expression pour l’instant.",
    phraseLabel: "Expression",
    phraseAdd: "Ajouter",
    phraseRetire: "Retirer",
    phraseRetired: "Retirée",
    loc_en: "Anglais",
    loc_ar: "Arabe",
    loc_arLB: "Arabe libanais",
    loc_arabizi: "Arabizi",
    loc_fr: "Français",
    loc_mixed: "Mixte",
    cgTitle: "Enrichir le catalogue",
    cgBody:
      "Les lieux dont nous avons entendu parler sans les vérifier, les prix à revérifier auprès de leur source, et le nombre de lieux de chaque type utilisables par le planificateur.",
    leadsTitle: "Pistes à vérifier",
    leadsBody:
      "Issues de données ouvertes ou de listes officielles. Une piste n’est jamais montrée aux voyageurs : elle ne devient une fiche qu’après une visite ou un appel. Les pistes demandées par les voyageurs passent en premier.",
    leadsEmpty: "Aucune piste ici.",
    ls_new: "Nouvelle",
    ls_checking: "En vérification",
    ls_published: "Publiée",
    ls_rejected: "Refusée",
    ls_duplicate: "Doublon",
    kindOfPlace: "Type de lieu",
    anyKind: "Tous les types",
    leadDemand: "Demandé {count} fois sans résultat",
    leadSource: "Source : {source} {id}",
    leadMap: "Voir sur la carte",
    leadCheck: "Commencer la vérification",
    leadReject: "Refuser",
    leadDuplicate: "Doublon",
    leadPublish: "Publier après vérification",
    publishDescription: "Description pour les voyageurs",
    publishNotes: "Ce que vous avez vérifié, et comment (visite ou appel)",
    publishConfirm: "Publier la fiche",
    publishedAs: "Publiée sous {slug}. Son prix reste sur demande jusqu’à l’enregistrement d’un prix publié.",
    pricesTitle: "Prix publiés à revérifier",
    pricesBody:
      "Chaque prix a été relevé à sa source officielle à une date donnée. À son expiration, le planificateur cesse de l’utiliser et affiche « prix sur demande ».",
    pricesEmpty: "Aucun prix à revérifier.",
    priceReviewBy: "À revérifier avant le {date}",
    priceCheckedOn: "vérifié le {date}",
    recordTitle: "Enregistrer un prix publié",
    recordBody: "Uniquement un prix publié par le lieu ou une autorité, avec le lien. Jamais une estimation.",
    listingId: "Identifiant de la fiche",
    priceType: "Prix",
    pt_fixed: "Fixe",
    pt_from: "À partir de",
    pt_range: "Fourchette",
    amount: "Montant",
    maxAmount: "Jusqu’à",
    currency: "Devise",
    unit: "Par",
    unit_person: "Personne",
    unit_group: "Groupe",
    sourceUrl: "Lien vers le prix publié (https)",
    sourceName: "Publié par",
    checkedOn: "Vérifié le",
    reviewBy: "À revérifier avant le",
    note: "Note",
    savePrice: "Enregistrer le prix",
    priceSaved: "Enregistré avec sa source.",
    recheck: "Enregistrer à nouveau",
    coverageTitle: "Types de lieux utilisables par le planificateur",
    coverageBody:
      "Les lieux de confiance par type dans chaque destination, et ceux encore sans type (le planificateur ne peut pas les proposer).",
    untyped: "Sans type",
    kindsCount: "{count} types",
  },
};

export type AdminCatalogueCopy = Record<AdminCatalogueKey, string>;

export function useAdminCatalogueCopy(): AdminCatalogueCopy {
  const { locale } = useLocale();
  return adminCatalogueCopy[locale];
}
