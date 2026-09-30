import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/** Copy for sign-in and security settings (security plan SEC-22, SEC-24, SEC-25). */
export type AccountSecurityKey =
  | "title"
  | "body"
  | "sessionsTitle"
  | "sessionsBody"
  | "thisDevice"
  | "lastActive"
  | "unknownDevice"
  | "endSession"
  | "endOthers"
  | "endedOthers"
  | "passwordTitle"
  | "passwordBody"
  | "currentPassword"
  | "newPassword"
  | "confirmPassword"
  | "mismatch"
  | "passwordSave"
  | "passwordDone"
  | "emailTitle"
  | "emailBody"
  | "newEmail"
  | "emailSave"
  | "emailSent"
  | "confirmTitle"
  | "confirming"
  | "confirmed"
  | "confirmFailed"
  | "goSettings"
  | "error";

export const accountSecurityCopy: Record<Locale, Record<AccountSecurityKey, string>> = {
  en: {
    title: "Sign-in and security",
    body: "Your password, your email address, and the devices that are signed in.",
    sessionsTitle: "Where you're signed in",
    sessionsBody: "End any session you don't recognise. Ending a session signs that device out at once.",
    thisDevice: "This device",
    lastActive: "Last active {date}",
    unknownDevice: "Unknown device",
    endSession: "Sign out",
    endOthers: "Sign out everywhere else",
    endedOthers: "Signed out of {n} other sessions.",
    passwordTitle: "Change your password",
    passwordBody:
      "At least 10 characters. Common or leaked passwords are refused. Every other device will be signed out.",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Repeat the new password",
    mismatch: "The two new passwords are different.",
    passwordSave: "Change password",
    passwordDone: "Password changed. {n} other sessions were signed out.",
    emailTitle: "Change your email",
    emailBody:
      "We send a link to the new address. Nothing changes until you open it, and your current address is told.",
    newEmail: "New email address",
    emailSave: "Send confirmation link",
    emailSent: "Check {email} for the confirmation link.",
    confirmTitle: "Confirm your new email",
    confirming: "Confirming…",
    confirmed: "Done. Your account now uses {email}.",
    confirmFailed: "This link is invalid or has expired. Ask for a new one from your settings.",
    goSettings: "Go to settings",
    error: "That didn't work. Please try again.",
  },
  ar: {
    title: "تسجيل الدخول والأمان",
    body: "كلمة المرور، وبريدك الإلكتروني، والأجهزة المسجّل الدخول عليها.",
    sessionsTitle: "أين سجّلت الدخول",
    sessionsBody: "أنهِ أي جلسة لا تعرفها. إنهاء الجلسة يُخرج ذلك الجهاز فوراً.",
    thisDevice: "هذا الجهاز",
    lastActive: "آخر نشاط {date}",
    unknownDevice: "جهاز غير معروف",
    endSession: "تسجيل الخروج",
    endOthers: "تسجيل الخروج من كل مكان آخر",
    endedOthers: "تم تسجيل الخروج من {n} جلسات أخرى.",
    passwordTitle: "تغيير كلمة المرور",
    passwordBody: "10 أحرف على الأقل. تُرفض كلمات المرور الشائعة أو المسرّبة. سيتم تسجيل الخروج من كل الأجهزة الأخرى.",
    currentPassword: "كلمة المرور الحالية",
    newPassword: "كلمة المرور الجديدة",
    confirmPassword: "أعد كتابة كلمة المرور الجديدة",
    mismatch: "كلمتا المرور الجديدتان مختلفتان.",
    passwordSave: "تغيير كلمة المرور",
    passwordDone: "تم تغيير كلمة المرور. تم تسجيل الخروج من {n} جلسات أخرى.",
    emailTitle: "تغيير البريد الإلكتروني",
    emailBody: "نرسل رابطاً إلى العنوان الجديد. لا يتغيّر شيء حتى تفتحه، ونُعلم عنوانك الحالي.",
    newEmail: "البريد الإلكتروني الجديد",
    emailSave: "أرسل رابط التأكيد",
    emailSent: "افحص {email} لرابط التأكيد.",
    confirmTitle: "تأكيد بريدك الإلكتروني الجديد",
    confirming: "جارٍ التأكيد…",
    confirmed: "تم. أصبح حسابك يستخدم {email}.",
    confirmFailed: "هذا الرابط غير صالح أو منتهي. اطلب رابطاً جديداً من الإعدادات.",
    goSettings: "اذهب إلى الإعدادات",
    error: "لم ينجح ذلك. حاول مجدداً.",
  },
  fr: {
    title: "Connexion et sécurité",
    body: "Votre mot de passe, votre adresse e-mail et les appareils connectés.",
    sessionsTitle: "Où vous êtes connecté",
    sessionsBody: "Fermez toute session que vous ne reconnaissez pas. L'appareil est déconnecté aussitôt.",
    thisDevice: "Cet appareil",
    lastActive: "Dernière activité {date}",
    unknownDevice: "Appareil inconnu",
    endSession: "Déconnecter",
    endOthers: "Se déconnecter partout ailleurs",
    endedOthers: "{n} autres sessions déconnectées.",
    passwordTitle: "Changer de mot de passe",
    passwordBody:
      "Au moins 10 caractères. Les mots de passe courants ou divulgués sont refusés. Tous les autres appareils seront déconnectés.",
    currentPassword: "Mot de passe actuel",
    newPassword: "Nouveau mot de passe",
    confirmPassword: "Répétez le nouveau mot de passe",
    mismatch: "Les deux nouveaux mots de passe sont différents.",
    passwordSave: "Changer le mot de passe",
    passwordDone: "Mot de passe changé. {n} autres sessions déconnectées.",
    emailTitle: "Changer d'adresse e-mail",
    emailBody:
      "Nous envoyons un lien à la nouvelle adresse. Rien ne change avant que vous l'ouvriez, et votre adresse actuelle est prévenue.",
    newEmail: "Nouvelle adresse e-mail",
    emailSave: "Envoyer le lien de confirmation",
    emailSent: "Consultez {email} pour le lien de confirmation.",
    confirmTitle: "Confirmez votre nouvelle adresse",
    confirming: "Confirmation…",
    confirmed: "C'est fait. Votre compte utilise maintenant {email}.",
    confirmFailed: "Ce lien est invalide ou a expiré. Demandez-en un nouveau depuis vos paramètres.",
    goSettings: "Aller aux paramètres",
    error: "Cela n'a pas fonctionné. Réessayez.",
  },
};

export function useAccountSecurityCopy() {
  const { locale } = useLocale();
  return accountSecurityCopy[locale];
}
