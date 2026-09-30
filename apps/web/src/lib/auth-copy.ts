import { useLocale } from "@/components/shell/locale-provider";
import type { Locale } from "@/lib/locale";

/** Copy for sign-up, sign-in, email verification and password recovery. */
export type AuthKey =
  | "help"
  | "required"
  | "optional"
  | "haveAccount"
  | "signInLink"
  | "newHere"
  | "createLink"
  | "backToSignIn"
  | "continueToMshwar"
  | "pwShow"
  | "pwHide"
  | "pwRuleLength"
  | "pwRuleMet"
  | "pwRuleUnmet"
  | "pwMatch"
  | "pwNoMatch"
  | "errName"
  | "errEmail"
  | "errPassword"
  | "errConfirm"
  | "errTerms"
  | "errHumanCheck"
  | "errEmailTaken"
  | "errEmailTakenSignIn"
  | "errEmailTakenReset"
  | "errWrongCredentials"
  | "errNetwork"
  | "errNetworkSignIn"
  | "errRateLimited"
  | "errRateLimitedMinutes"
  | "errGeneric"
  | "suTitle"
  | "suBody"
  | "suSubmit"
  | "suPending"
  | "suOptionalHeading"
  | "siTitle"
  | "siBody"
  | "siSubmit"
  | "siPending"
  | "siForgot"
  | "checkTitle"
  | "checkSentTo"
  | "checkBody"
  | "spamTitle"
  | "spamFolder"
  | "spamAddress"
  | "spamAddressGeneric"
  | "spamWait"
  | "resend"
  | "resendIn"
  | "resendPending"
  | "resent"
  | "resentGeneric"
  | "resendFailed"
  | "wrongEmail"
  | "useAnotherAccount"
  | "continueForNow"
  | "verifying"
  | "verifiedTitle"
  | "verifiedBody"
  | "alreadyTitle"
  | "alreadyBody"
  | "linkBadTitle"
  | "linkBadBody"
  | "guestTitle"
  | "guestBody"
  | "fpTitle"
  | "fpBody"
  | "fpSubmit"
  | "fpPending"
  | "fpSentTitle"
  | "fpSentBody"
  | "fpResend"
  | "fpResent"
  | "fpOtherEmail"
  | "rpTitle"
  | "rpBody"
  | "rpNew"
  | "rpConfirm"
  | "rpSubmit"
  | "rpPending"
  | "rpDoneTitle"
  | "rpDoneBody"
  | "rpBadTitle"
  | "rpBadBody"
  | "rpRequest"
  | "visSignupLead"
  | "visSignupAccent"
  | "visSignupBody"
  | "visSigninLead"
  | "visSigninAccent"
  | "visSigninBody"
  | "visVerifyLead"
  | "visVerifyAccent"
  | "visVerifyBody"
  | "visRecoverLead"
  | "visRecoverAccent"
  | "visRecoverBody";

export const authCopy: Record<Locale, Record<AuthKey, string>> = {
  en: {
    help: "Help",
    required: "Required",
    optional: "Optional",
    haveAccount: "Already have an account?",
    signInLink: "Sign in",
    newHere: "New to Mshwar?",
    createLink: "Create account",
    backToSignIn: "Back to sign in",
    continueToMshwar: "Continue to Mshwar",
    pwShow: "Show password",
    pwHide: "Hide password",
    pwRuleLength: "At least 10 characters",
    pwRuleMet: "done",
    pwRuleUnmet: "not yet",
    pwMatch: "Passwords match",
    pwNoMatch: "Passwords do not match",
    errName: "Enter the name you’d like to use.",
    errEmail: "Enter a valid email address, like name@example.com.",
    errPassword: "Use at least 10 characters.",
    errConfirm: "The two passwords don’t match yet.",
    errTerms: "Please accept the Terms of Service and Privacy Policy to continue.",
    errHumanCheck: "Please complete the human check to continue.",
    errEmailTaken: "An account with this email already exists.",
    errEmailTakenSignIn: "Sign in instead",
    errEmailTakenReset: "reset your password",
    errWrongCredentials: "The email or password you entered is incorrect.",
    errNetwork: "We couldn’t reach Mshwar. Check your connection and try again.",
    errNetworkSignIn: "We couldn’t sign you in. Check your connection and try again.",
    errRateLimited: "Too many attempts. Please wait a little and try again.",
    errRateLimitedMinutes: "Too many attempts. Please wait {n} min and try again.",
    errGeneric: "Something went wrong. Please try again.",
    suTitle: "Create your Mshwar account",
    suBody: "Save places, build trips and discover Lebanon your way.",
    suSubmit: "Create account",
    suPending: "Creating your account…",
    suOptionalHeading: "You can change these any time in Settings.",
    siTitle: "Welcome back",
    siBody: "Sign in to pick up your plans and saved places.",
    siSubmit: "Sign in",
    siPending: "Signing you in…",
    siForgot: "Forgot password?",
    checkTitle: "Check your email",
    checkSentTo: "We sent a verification link to",
    checkBody: "Open the email and select the link to verify your account. The link works for 24 hours.",
    spamTitle: "Didn’t get it?",
    spamFolder: "Check your Spam or Junk folder — these emails sometimes land there.",
    spamAddress: "Make sure {email} is the right address.",
    spamAddressGeneric: "Make sure you entered the right address.",
    spamWait: "Give it a minute — delivery can take a little time.",
    resend: "Resend verification email",
    resendIn: "Resend in {n}s",
    resendPending: "Sending…",
    resent: "Verification email sent to {email}.",
    resentGeneric: "If this address still needs verification, a new link has been sent.",
    resendFailed: "We couldn’t resend the email. Please try again.",
    wrongEmail: "Wrong email?",
    useAnotherAccount: "Use another account",
    continueForNow: "Continue to Mshwar for now",
    verifying: "Verifying your email…",
    verifiedTitle: "Email verified",
    verifiedBody: "Your Mshwar account is ready.",
    alreadyTitle: "Your email is already verified",
    alreadyBody: "You’re all set — there’s nothing else to do.",
    linkBadTitle: "This link has expired or was already used",
    linkBadBody: "Verification links work once and expire after 24 hours. You can send yourself a new one.",
    guestTitle: "Verify your email",
    guestBody: "Enter the email you signed up with and we’ll send you a new verification link.",
    fpTitle: "Forgot your password?",
    fpBody: "Enter the email for your Mshwar account and we’ll send you a link to choose a new one.",
    fpSubmit: "Send reset link",
    fpPending: "Sending…",
    fpSentTitle: "Check your email",
    fpSentBody: "If an account exists for this address, a reset link has been sent. It works for 30 minutes.",
    fpResend: "Resend link",
    fpResent: "Sent again — check your inbox.",
    fpOtherEmail: "Use a different email",
    rpTitle: "Choose a new password",
    rpBody: "Once it’s saved, you’ll be signed in on this device.",
    rpNew: "New password",
    rpConfirm: "Confirm new password",
    rpSubmit: "Update password",
    rpPending: "Updating password…",
    rpDoneTitle: "Password updated",
    rpDoneBody: "You’re signed in with your new password.",
    rpBadTitle: "This reset link has expired or was already used",
    rpBadBody: "Reset links work once and expire after 30 minutes.",
    rpRequest: "Request a new link",
    visSignupLead: "Lebanon,",
    visSignupAccent: "at your own pace.",
    visSignupBody: "Save the places you love and shape a day that feels like yours.",
    visSigninLead: "Your next mshwar",
    visSigninAccent: "is waiting.",
    visSigninBody: "Pick up where you left off.",
    visVerifyLead: "Almost",
    visVerifyAccent: "there.",
    visVerifyBody: "Verify your email and your next mshwar can begin.",
    visRecoverLead: "Back on",
    visRecoverAccent: "the road.",
    visRecoverBody: "A new password and you’re on your way again.",
  },
  ar: {
    help: "المساعدة",
    required: "مطلوب",
    optional: "اختياري",
    haveAccount: "لديك حساب؟",
    signInLink: "تسجيل الدخول",
    newHere: "جديد على مشوار؟",
    createLink: "إنشاء حساب",
    backToSignIn: "العودة إلى تسجيل الدخول",
    continueToMshwar: "المتابعة إلى مشوار",
    pwShow: "إظهار كلمة المرور",
    pwHide: "إخفاء كلمة المرور",
    pwRuleLength: "10 أحرف على الأقل",
    pwRuleMet: "تم",
    pwRuleUnmet: "ليس بعد",
    pwMatch: "كلمتا المرور متطابقتان",
    pwNoMatch: "كلمتا المرور غير متطابقتين",
    errName: "أدخل الاسم الذي تريد استخدامه.",
    errEmail: "أدخل بريداً إلكترونياً صالحاً، مثل name@example.com.",
    errPassword: "استخدم 10 أحرف على الأقل.",
    errConfirm: "كلمتا المرور غير متطابقتين بعد.",
    errTerms: "يرجى الموافقة على شروط الخدمة وسياسة الخصوصية للمتابعة.",
    errHumanCheck: "يرجى إكمال التحقق من أنك لست روبوتاً للمتابعة.",
    errEmailTaken: "يوجد حساب بهذا البريد الإلكتروني.",
    errEmailTakenSignIn: "سجّل الدخول بدلاً من ذلك",
    errEmailTakenReset: "أعد تعيين كلمة المرور",
    errWrongCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    errNetwork: "تعذّر الوصول إلى مشوار. تحقّق من الاتصال وحاول مجدداً.",
    errNetworkSignIn: "تعذّر تسجيل دخولك. تحقّق من الاتصال وحاول مجدداً.",
    errRateLimited: "محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.",
    errRateLimitedMinutes: "محاولات كثيرة. انتظر {n} دقيقة ثم حاول مجدداً.",
    errGeneric: "حدث خطأ ما. يرجى المحاولة مجدداً.",
    suTitle: "أنشئ حسابك على مشوار",
    suBody: "احفظ الأماكن، ابنِ رحلاتك، واكتشف لبنان على طريقتك.",
    suSubmit: "إنشاء حساب",
    suPending: "جارٍ إنشاء حسابك…",
    suOptionalHeading: "يمكنك تغيير هذه الخيارات في أي وقت من الإعدادات.",
    siTitle: "أهلاً بعودتك",
    siBody: "سجّل الدخول لتتابع خططك وأماكنك المحفوظة.",
    siSubmit: "تسجيل الدخول",
    siPending: "جارٍ تسجيل الدخول…",
    siForgot: "نسيت كلمة المرور؟",
    checkTitle: "تحقّق من بريدك",
    checkSentTo: "أرسلنا رابط تأكيد إلى",
    checkBody: "افتح الرسالة واضغط على الرابط لتأكيد حسابك. الرابط صالح لمدة 24 ساعة.",
    spamTitle: "لم تصلك الرسالة؟",
    spamFolder: "تحقّق من مجلد الرسائل غير المرغوب فيها (Spam/Junk) — قد تصل إليه أحياناً.",
    spamAddress: "تأكّد أن {email} هو العنوان الصحيح.",
    spamAddressGeneric: "تأكّد من أنك أدخلت العنوان الصحيح.",
    spamWait: "انتظر دقيقة — قد يستغرق الوصول بعض الوقت.",
    resend: "إعادة إرسال رسالة التأكيد",
    resendIn: "إعادة الإرسال بعد {n} ث",
    resendPending: "جارٍ الإرسال…",
    resent: "أُرسلت رسالة التأكيد إلى {email}.",
    resentGeneric: "إن كان هذا العنوان لا يزال بحاجة إلى تأكيد، فقد أُرسل رابط جديد.",
    resendFailed: "تعذّرت إعادة إرسال الرسالة. يرجى المحاولة مجدداً.",
    wrongEmail: "بريد خاطئ؟",
    useAnotherAccount: "استخدم حساباً آخر",
    continueForNow: "تابع إلى مشوار الآن",
    verifying: "جارٍ تأكيد بريدك…",
    verifiedTitle: "تم تأكيد البريد",
    verifiedBody: "حسابك على مشوار جاهز.",
    alreadyTitle: "بريدك مؤكَّد مسبقاً",
    alreadyBody: "كل شيء جاهز — لا حاجة لأي خطوة أخرى.",
    linkBadTitle: "انتهت صلاحية هذا الرابط أو سبق استخدامه",
    linkBadBody: "روابط التأكيد تعمل مرة واحدة وتنتهي بعد 24 ساعة. يمكنك إرسال رابط جديد.",
    guestTitle: "أكّد بريدك الإلكتروني",
    guestBody: "أدخل البريد الذي سجّلت به وسنرسل لك رابط تأكيد جديداً.",
    fpTitle: "نسيت كلمة المرور؟",
    fpBody: "أدخل بريد حسابك على مشوار وسنرسل لك رابطاً لاختيار كلمة مرور جديدة.",
    fpSubmit: "إرسال رابط إعادة التعيين",
    fpPending: "جارٍ الإرسال…",
    fpSentTitle: "تحقّق من بريدك",
    fpSentBody: "إن كان هناك حساب بهذا العنوان، فقد أرسلنا رابط إعادة التعيين. الرابط صالح لمدة 30 دقيقة.",
    fpResend: "إعادة إرسال الرابط",
    fpResent: "أُرسل مجدداً — تحقّق من بريدك.",
    fpOtherEmail: "استخدم بريداً آخر",
    rpTitle: "اختر كلمة مرور جديدة",
    rpBody: "بعد حفظها، ستُسجَّل دخولك على هذا الجهاز.",
    rpNew: "كلمة المرور الجديدة",
    rpConfirm: "تأكيد كلمة المرور الجديدة",
    rpSubmit: "تحديث كلمة المرور",
    rpPending: "جارٍ تحديث كلمة المرور…",
    rpDoneTitle: "تم تحديث كلمة المرور",
    rpDoneBody: "أنت الآن مسجَّل الدخول بكلمة المرور الجديدة.",
    rpBadTitle: "انتهت صلاحية رابط إعادة التعيين أو سبق استخدامه",
    rpBadBody: "روابط إعادة التعيين تعمل مرة واحدة وتنتهي بعد 30 دقيقة.",
    rpRequest: "اطلب رابطاً جديداً",
    visSignupLead: "لبنان،",
    visSignupAccent: "على راحتك.",
    visSignupBody: "احفظ الأماكن التي تحبها وارسم يوماً يشبهك.",
    visSigninLead: "مشوارك التالي",
    visSigninAccent: "بانتظارك.",
    visSigninBody: "تابع من حيث توقفت.",
    visVerifyLead: "اقتربنا",
    visVerifyAccent: "كثيراً.",
    visVerifyBody: "أكّد بريدك ليبدأ مشوارك التالي.",
    visRecoverLead: "عُد إلى",
    visRecoverAccent: "الطريق.",
    visRecoverBody: "كلمة مرور جديدة وتكمل طريقك.",
  },
  fr: {
    help: "Aide",
    required: "Obligatoire",
    optional: "Facultatif",
    haveAccount: "Déjà un compte ?",
    signInLink: "Se connecter",
    newHere: "Nouveau sur Mshwar ?",
    createLink: "Créer un compte",
    backToSignIn: "Retour à la connexion",
    continueToMshwar: "Continuer vers Mshwar",
    pwShow: "Afficher le mot de passe",
    pwHide: "Masquer le mot de passe",
    pwRuleLength: "Au moins 10 caractères",
    pwRuleMet: "fait",
    pwRuleUnmet: "pas encore",
    pwMatch: "Les mots de passe correspondent",
    pwNoMatch: "Les mots de passe ne correspondent pas",
    errName: "Indiquez le nom que vous souhaitez utiliser.",
    errEmail: "Saisissez une adresse e-mail valide, par exemple nom@exemple.com.",
    errPassword: "Utilisez au moins 10 caractères.",
    errConfirm: "Les deux mots de passe ne correspondent pas encore.",
    errTerms: "Acceptez les conditions d’utilisation et la politique de confidentialité pour continuer.",
    errHumanCheck: "Terminez la vérification anti-robot pour continuer.",
    errEmailTaken: "Un compte existe déjà avec cette adresse.",
    errEmailTakenSignIn: "Se connecter plutôt",
    errEmailTakenReset: "réinitialiser le mot de passe",
    errWrongCredentials: "L’e-mail ou le mot de passe saisi est incorrect.",
    errNetwork: "Impossible de joindre Mshwar. Vérifiez votre connexion et réessayez.",
    errNetworkSignIn: "Connexion impossible. Vérifiez votre connexion et réessayez.",
    errRateLimited: "Trop de tentatives. Patientez un peu puis réessayez.",
    errRateLimitedMinutes: "Trop de tentatives. Patientez {n} min puis réessayez.",
    errGeneric: "Une erreur est survenue. Veuillez réessayer.",
    suTitle: "Créez votre compte Mshwar",
    suBody: "Enregistrez des lieux, composez vos voyages et découvrez le Liban à votre façon.",
    suSubmit: "Créer un compte",
    suPending: "Création de votre compte…",
    suOptionalHeading: "Modifiable à tout moment dans les paramètres.",
    siTitle: "Bon retour",
    siBody: "Connectez-vous pour retrouver vos plans et vos lieux enregistrés.",
    siSubmit: "Se connecter",
    siPending: "Connexion…",
    siForgot: "Mot de passe oublié ?",
    checkTitle: "Vérifiez votre boîte mail",
    checkSentTo: "Nous avons envoyé un lien de vérification à",
    checkBody: "Ouvrez l’e-mail et sélectionnez le lien pour vérifier votre compte. Le lien est valable 24 heures.",
    spamTitle: "Rien reçu ?",
    spamFolder: "Regardez dans vos courriers indésirables (Spam) — ces e-mails y arrivent parfois.",
    spamAddress: "Vérifiez que {email} est la bonne adresse.",
    spamAddressGeneric: "Vérifiez que l’adresse saisie est la bonne.",
    spamWait: "Patientez une minute — l’envoi peut prendre un peu de temps.",
    resend: "Renvoyer l’e-mail de vérification",
    resendIn: "Renvoyer dans {n} s",
    resendPending: "Envoi…",
    resent: "E-mail de vérification envoyé à {email}.",
    resentGeneric: "Si cette adresse doit encore être vérifiée, un nouveau lien a été envoyé.",
    resendFailed: "Impossible de renvoyer l’e-mail. Veuillez réessayer.",
    wrongEmail: "Mauvaise adresse ?",
    useAnotherAccount: "Utiliser un autre compte",
    continueForNow: "Continuer vers Mshwar pour l’instant",
    verifying: "Vérification de votre e-mail…",
    verifiedTitle: "E-mail vérifié",
    verifiedBody: "Votre compte Mshwar est prêt.",
    alreadyTitle: "Votre e-mail est déjà vérifié",
    alreadyBody: "Tout est prêt — rien d’autre à faire.",
    linkBadTitle: "Ce lien a expiré ou a déjà été utilisé",
    linkBadBody:
      "Les liens de vérification ne servent qu’une fois et expirent après 24 heures. Envoyez-vous-en un nouveau.",
    guestTitle: "Vérifiez votre e-mail",
    guestBody: "Saisissez l’adresse utilisée à l’inscription et nous vous enverrons un nouveau lien.",
    fpTitle: "Mot de passe oublié ?",
    fpBody: "Saisissez l’adresse de votre compte Mshwar et nous vous enverrons un lien pour en choisir un nouveau.",
    fpSubmit: "Envoyer le lien",
    fpPending: "Envoi…",
    fpSentTitle: "Vérifiez votre boîte mail",
    fpSentBody:
      "Si un compte existe pour cette adresse, un lien de réinitialisation a été envoyé. Il est valable 30 minutes.",
    fpResend: "Renvoyer le lien",
    fpResent: "Renvoyé — vérifiez votre boîte mail.",
    fpOtherEmail: "Utiliser une autre adresse",
    rpTitle: "Choisissez un nouveau mot de passe",
    rpBody: "Une fois enregistré, vous serez connecté sur cet appareil.",
    rpNew: "Nouveau mot de passe",
    rpConfirm: "Confirmer le nouveau mot de passe",
    rpSubmit: "Mettre à jour",
    rpPending: "Mise à jour…",
    rpDoneTitle: "Mot de passe mis à jour",
    rpDoneBody: "Vous êtes connecté avec votre nouveau mot de passe.",
    rpBadTitle: "Ce lien de réinitialisation a expiré ou a déjà été utilisé",
    rpBadBody: "Les liens de réinitialisation ne servent qu’une fois et expirent après 30 minutes.",
    rpRequest: "Demander un nouveau lien",
    visSignupLead: "Le Liban,",
    visSignupAccent: "à votre rythme.",
    visSignupBody: "Enregistrez les lieux que vous aimez et composez une journée qui vous ressemble.",
    visSigninLead: "Votre prochain mshwar",
    visSigninAccent: "vous attend.",
    visSigninBody: "Reprenez là où vous en étiez.",
    visVerifyLead: "Vous y êtes",
    visVerifyAccent: "presque.",
    visVerifyBody: "Vérifiez votre e-mail et votre prochain mshwar peut commencer.",
    visRecoverLead: "De retour",
    visRecoverAccent: "sur la route.",
    visRecoverBody: "Un nouveau mot de passe, et vous repartez.",
  },
};

export function useAuthCopy() {
  const { locale } = useLocale();
  return authCopy[locale];
}
