import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/** Shared copy for verified partners: document names, "What we checked", phone and authenticator. */
export type VerifiedKey =
  | "doc_id"
  | "doc_selfie"
  | "doc_profile_photo"
  | "doc_public_licence"
  | "doc_judicial_record"
  | "doc_vehicle_registration"
  | "doc_insurance"
  | "doc_inspection"
  | "doc_plate_rental"
  | "doc_bdl_registration"
  | "doc_commercial_register"
  | "doc_storefront_photo"
  | "check_id"
  | "check_public_licence"
  | "check_judicial_record"
  | "check_vehicle_registration"
  | "check_insurance"
  | "check_inspection"
  | "check_plate_rental"
  | "check_bdl_registration"
  | "check_commercial_register"
  | "check_storefront_photo"
  | "check_selfie"
  | "check_profile_photo"
  | "checkedOn"
  | "validUntil"
  | "forPlate"
  | "whatWeChecked"
  | "whatWeCheckedBody"
  | "metInPerson"
  | "metOnCall"
  | "recheckedOn"
  | "approvedOn"
  | "level_verified"
  | "level_lapsed"
  | "level_pending"
  | "level_none"
  | "noChecks"
  | "status_draft"
  | "status_submitted"
  | "status_approved"
  | "status_rejected"
  | "status_suspended"
  | "doc_pending"
  | "doc_verified"
  | "doc_rejected"
  | "doc_lapsed"
  | "docLapsesOn"
  | "upload"
  | "replace"
  | "uploading"
  | "file"
  | "photoFile"
  | "reference"
  | "issuer"
  | "issuedOn"
  | "expiresOn"
  | "required"
  | "optional"
  | "docsPrivate"
  | "freshHint"
  | "expiryHint"
  | "securityTitle"
  | "securityBody"
  | "phoneLabel"
  | "phoneHint"
  | "sendCode"
  | "codeSent"
  | "codeLabel"
  | "confirm"
  | "phoneVerified"
  | "changePhone"
  | "totpTitle"
  | "totpBody"
  | "totpStart"
  | "totpScan"
  | "totpOpen"
  | "totpKey"
  | "totpOn"
  | "wrongCode"
  | "stepUpTitle"
  | "stepUpBody"
  | "stepUpAction"
  | "cancel"
  | "saving"
  | "save"
  | "loadError"
  | "tryAgain";

export const verifiedCopy: Record<Locale, Record<VerifiedKey, string>> = {
  en: {
    doc_id: "ID card or passport",
    doc_selfie: "Live selfie",
    doc_profile_photo: "Profile photo travellers see",
    doc_public_licence: "Public driving licence",
    doc_judicial_record: "Judicial record extract",
    doc_vehicle_registration: "Vehicle registration (red plate)",
    doc_insurance: "Insurance with passenger cover",
    doc_inspection: "Vehicle inspection",
    doc_plate_rental: "Red plate rental contract",
    doc_bdl_registration: "Banque du Liban registration",
    doc_commercial_register: "Commercial register extract",
    doc_storefront_photo: "Shop front photo",
    check_id: "Identity checked",
    check_public_licence: "Public driving licence checked",
    check_judicial_record: "Clean judicial record",
    check_vehicle_registration: "Red-plate registration checked",
    check_insurance: "Passenger insurance checked",
    check_inspection: "Vehicle inspection checked",
    check_plate_rental: "Plate rental checked",
    check_bdl_registration: "On Banque du Liban’s list",
    check_commercial_register: "Commercial register checked",
    check_storefront_photo: "Shop front checked",
    check_selfie: "Face matched to ID",
    check_profile_photo: "Photo matched to ID",
    checkedOn: "Checked {date}",
    validUntil: "valid to {date}",
    forPlate: "for {plate}",
    whatWeChecked: "What we checked",
    whatWeCheckedBody: "A person on the Mshwar team checked each of these against the issuing authority.",
    metInPerson: "Met in person on {date}",
    metOnCall: "Met on a video call on {date}",
    recheckedOn: "Re-checked on {date}",
    approvedOn: "Approved {date}",
    level_verified: "Verified",
    level_lapsed: "A document has run out",
    level_pending: "Being checked",
    level_none: "Not verified",
    noChecks: "Nothing is verified yet.",
    status_draft: "Draft",
    status_submitted: "With our reviewers",
    status_approved: "Approved",
    status_rejected: "Needs changes",
    status_suspended: "Suspended",
    doc_pending: "Waiting for review",
    doc_verified: "Verified",
    doc_rejected: "Rejected",
    doc_lapsed: "Run out",
    docLapsesOn: "Runs out {date}",
    upload: "Upload",
    replace: "Replace",
    uploading: "Uploading…",
    file: "File (photo or PDF)",
    photoFile: "Photo",
    reference: "Number on the document",
    issuer: "Issued by",
    issuedOn: "Issued on",
    expiresOn: "Expires on",
    required: "Required",
    optional: "Only if it applies",
    docsPrivate: "Only our reviewers see these files. Travellers see what was checked and when, never the documents.",
    freshHint: "Must have been issued in the last three months.",
    expiryHint: "Enter the expiry date shown on it.",
    securityTitle: "Secure your account",
    securityBody:
      "Partner accounts need a verified phone and an authenticator app. You will use the app again before changing a plate, an address or your rates.",
    phoneLabel: "Mobile number",
    phoneHint: "With the country code, for example +961 70 123 456.",
    sendCode: "Text me a code",
    codeSent: "We sent a six-digit code to {phone}. It works for 10 minutes.",
    codeLabel: "Code",
    confirm: "Confirm",
    phoneVerified: "Phone verified: {phone}",
    changePhone: "Use another number",
    totpTitle: "Authenticator app",
    totpBody: "Use Google Authenticator, Microsoft Authenticator, 1Password or any app that shows six-digit codes.",
    totpStart: "Set up the app",
    totpScan: "Open this link on your phone, or type the key into the app, then enter the code it shows.",
    totpOpen: "Add to my authenticator",
    totpKey: "Key",
    totpOn: "Two-step sign-in is on.",
    wrongCode: "That code is not right. Check it and try again.",
    stepUpTitle: "Confirm it’s you",
    stepUpBody: "Enter the six-digit code from your authenticator app. It covers the next 15 minutes of changes.",
    stepUpAction: "Confirm and save",
    cancel: "Cancel",
    saving: "Saving…",
    save: "Save",
    loadError: "We couldn’t load this. Try again in a moment.",
    tryAgain: "Try again",
  },
  ar: {
    doc_id: "بطاقة الهوية أو جواز السفر",
    doc_selfie: "صورة ذاتية مباشرة",
    doc_profile_photo: "صورة الملف التي يراها المسافرون",
    doc_public_licence: "رخصة سوق عمومية",
    doc_judicial_record: "سجل عدلي",
    doc_vehicle_registration: "دفتر تسجيل المركبة (لوحة حمراء)",
    doc_insurance: "تأمين يشمل الركّاب",
    doc_inspection: "المعاينة الميكانيكية",
    doc_plate_rental: "عقد استئجار اللوحة الحمراء",
    doc_bdl_registration: "التسجيل لدى مصرف لبنان",
    doc_commercial_register: "إفادة السجل التجاري",
    doc_storefront_photo: "صورة واجهة المحل",
    check_id: "تم التحقّق من الهوية",
    check_public_licence: "تم التحقّق من رخصة السوق العمومية",
    check_judicial_record: "سجل عدلي نظيف",
    check_vehicle_registration: "تم التحقّق من تسجيل اللوحة الحمراء",
    check_insurance: "تم التحقّق من تأمين الركّاب",
    check_inspection: "تم التحقّق من المعاينة الميكانيكية",
    check_plate_rental: "تم التحقّق من عقد استئجار اللوحة",
    check_bdl_registration: "مدرج على لائحة مصرف لبنان",
    check_commercial_register: "تم التحقّق من السجل التجاري",
    check_storefront_photo: "تم التحقّق من واجهة المحل",
    check_selfie: "تمت مطابقة الوجه مع الهوية",
    check_profile_photo: "تمت مطابقة الصورة مع الهوية",
    checkedOn: "تم التحقّق في {date}",
    validUntil: "صالح حتى {date}",
    forPlate: "للوحة {plate}",
    whatWeChecked: "ما تحقّقنا منه",
    whatWeCheckedBody: "تحقّق شخص من فريق مشوار من كلّ ما يلي مقابل الجهة المُصدِرة.",
    metInPerson: "قابلناه شخصيًا في {date}",
    metOnCall: "قابلناه عبر مكالمة فيديو في {date}",
    recheckedOn: "أُعيد التحقّق في {date}",
    approvedOn: "تمت الموافقة في {date}",
    level_verified: "موثّق",
    level_lapsed: "انتهت صلاحية مستند",
    level_pending: "قيد التحقّق",
    level_none: "غير موثّق",
    noChecks: "لم يُتحقّق من شيء بعد.",
    status_draft: "مسودّة",
    status_submitted: "لدى المراجعين",
    status_approved: "مقبول",
    status_rejected: "يحتاج إلى تعديل",
    status_suspended: "موقوف",
    doc_pending: "بانتظار المراجعة",
    doc_verified: "موثّق",
    doc_rejected: "مرفوض",
    doc_lapsed: "منتهي الصلاحية",
    docLapsesOn: "تنتهي صلاحيته في {date}",
    upload: "ارفع",
    replace: "استبدل",
    uploading: "جارٍ الرفع…",
    file: "الملف (صورة أو PDF)",
    photoFile: "صورة",
    reference: "الرقم على المستند",
    issuer: "صادر عن",
    issuedOn: "تاريخ الإصدار",
    expiresOn: "تاريخ الانتهاء",
    required: "مطلوب",
    optional: "عند الاقتضاء فقط",
    docsPrivate: "لا يرى هذه الملفات إلا المراجعون. يرى المسافرون ما تم التحقّق منه ومتى، لا المستندات نفسها.",
    freshHint: "يجب أن يكون صادرًا خلال الأشهر الثلاثة الأخيرة.",
    expiryHint: "أدخل تاريخ الانتهاء المذكور عليه.",
    securityTitle: "أمّن حسابك",
    securityBody:
      "تحتاج حسابات الشركاء إلى هاتف موثّق وتطبيق مصادقة. ستستخدم التطبيق مجددًا قبل تغيير لوحة أو عنوان أو أسعارك.",
    phoneLabel: "رقم الجوال",
    phoneHint: "مع رمز البلد، مثل ‎+961 70 123 456.",
    sendCode: "أرسل لي رمزًا",
    codeSent: "أرسلنا رمزًا من ستة أرقام إلى {phone}. يبقى صالحًا 10 دقائق.",
    codeLabel: "الرمز",
    confirm: "تأكيد",
    phoneVerified: "تم التحقّق من الهاتف: {phone}",
    changePhone: "استخدم رقمًا آخر",
    totpTitle: "تطبيق المصادقة",
    totpBody:
      "استخدم Google Authenticator أو Microsoft Authenticator أو 1Password أو أي تطبيق يعرض رموزًا من ستة أرقام.",
    totpStart: "إعداد التطبيق",
    totpScan: "افتح هذا الرابط على هاتفك أو اكتب المفتاح في التطبيق، ثم أدخل الرمز الذي يظهره.",
    totpOpen: "أضِف إلى تطبيق المصادقة",
    totpKey: "المفتاح",
    totpOn: "التحقّق بخطوتين مُفعّل.",
    wrongCode: "الرمز غير صحيح. تحقّق منه وحاول مجددًا.",
    stepUpTitle: "أكّد هويتك",
    stepUpBody: "أدخل الرمز المؤلّف من ستة أرقام من تطبيق المصادقة. يغطي التغييرات خلال الدقائق الخمس عشرة المقبلة.",
    stepUpAction: "أكّد واحفظ",
    cancel: "إلغاء",
    saving: "جارٍ الحفظ…",
    save: "حفظ",
    loadError: "تعذّر التحميل. حاول بعد قليل.",
    tryAgain: "حاول مجددًا",
  },
  fr: {
    doc_id: "Carte d’identité ou passeport",
    doc_selfie: "Selfie en direct",
    doc_profile_photo: "Photo de profil vue par les voyageurs",
    doc_public_licence: "Permis de conduire public",
    doc_judicial_record: "Extrait de casier judiciaire",
    doc_vehicle_registration: "Carte grise (plaque rouge)",
    doc_insurance: "Assurance couvrant les passagers",
    doc_inspection: "Contrôle technique",
    doc_plate_rental: "Contrat de location de la plaque rouge",
    doc_bdl_registration: "Enregistrement à la Banque du Liban",
    doc_commercial_register: "Extrait du registre du commerce",
    doc_storefront_photo: "Photo de la devanture",
    check_id: "Identité vérifiée",
    check_public_licence: "Permis public vérifié",
    check_judicial_record: "Casier judiciaire vierge",
    check_vehicle_registration: "Immatriculation plaque rouge vérifiée",
    check_insurance: "Assurance passagers vérifiée",
    check_inspection: "Contrôle technique vérifié",
    check_plate_rental: "Location de plaque vérifiée",
    check_bdl_registration: "Sur la liste de la Banque du Liban",
    check_commercial_register: "Registre du commerce vérifié",
    check_storefront_photo: "Devanture vérifiée",
    check_selfie: "Visage comparé à la pièce d’identité",
    check_profile_photo: "Photo comparée à la pièce d’identité",
    checkedOn: "Vérifié le {date}",
    validUntil: "valable jusqu’au {date}",
    forPlate: "pour {plate}",
    whatWeChecked: "Ce que nous avons vérifié",
    whatWeCheckedBody: "Une personne de l’équipe Mshwar a vérifié chaque point auprès de l’autorité émettrice.",
    metInPerson: "Rencontré en personne le {date}",
    metOnCall: "Rencontré en visio le {date}",
    recheckedOn: "Revérifié le {date}",
    approvedOn: "Approuvé le {date}",
    level_verified: "Vérifié",
    level_lapsed: "Un document a expiré",
    level_pending: "En cours de vérification",
    level_none: "Non vérifié",
    noChecks: "Rien n’est encore vérifié.",
    status_draft: "Brouillon",
    status_submitted: "Chez nos relecteurs",
    status_approved: "Approuvé",
    status_rejected: "À corriger",
    status_suspended: "Suspendu",
    doc_pending: "En attente de vérification",
    doc_verified: "Vérifié",
    doc_rejected: "Refusé",
    doc_lapsed: "Expiré",
    docLapsesOn: "Expire le {date}",
    upload: "Envoyer",
    replace: "Remplacer",
    uploading: "Envoi…",
    file: "Fichier (photo ou PDF)",
    photoFile: "Photo",
    reference: "Numéro sur le document",
    issuer: "Délivré par",
    issuedOn: "Délivré le",
    expiresOn: "Expire le",
    required: "Obligatoire",
    optional: "Seulement si concerné",
    docsPrivate:
      "Seuls nos relecteurs voient ces fichiers. Les voyageurs voient ce qui a été vérifié et quand, jamais les documents.",
    freshHint: "Doit dater de moins de trois mois.",
    expiryHint: "Indiquez la date d’expiration inscrite.",
    securityTitle: "Sécurisez votre compte",
    securityBody:
      "Les comptes partenaires exigent un téléphone vérifié et une application d’authentification. Vous l’utiliserez à nouveau avant de changer une plaque, une adresse ou vos taux.",
    phoneLabel: "Numéro de portable",
    phoneHint: "Avec l’indicatif, par exemple +961 70 123 456.",
    sendCode: "M’envoyer un code",
    codeSent: "Nous avons envoyé un code à six chiffres au {phone}. Il est valable 10 minutes.",
    codeLabel: "Code",
    confirm: "Confirmer",
    phoneVerified: "Téléphone vérifié : {phone}",
    changePhone: "Utiliser un autre numéro",
    totpTitle: "Application d’authentification",
    totpBody:
      "Utilisez Google Authenticator, Microsoft Authenticator, 1Password ou toute application à codes à six chiffres.",
    totpStart: "Configurer l’application",
    totpScan: "Ouvrez ce lien sur votre téléphone ou saisissez la clé dans l’application, puis entrez le code affiché.",
    totpOpen: "Ajouter à mon application",
    totpKey: "Clé",
    totpOn: "La double vérification est activée.",
    wrongCode: "Ce code est incorrect. Vérifiez-le et réessayez.",
    stepUpTitle: "Confirmez que c’est vous",
    stepUpBody:
      "Saisissez le code à six chiffres de votre application. Il couvre les 15 prochaines minutes de modifications.",
    stepUpAction: "Confirmer et enregistrer",
    cancel: "Annuler",
    saving: "Enregistrement…",
    save: "Enregistrer",
    loadError: "Chargement impossible. Réessayez dans un instant.",
    tryAgain: "Réessayer",
  },
};

export type VerifiedCopy = Record<VerifiedKey, string>;

export function useVerifiedCopy(): VerifiedCopy {
  const { locale } = useLocale();
  return verifiedCopy[locale];
}
