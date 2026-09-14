import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

export type GroupKey =
  | "title"
  | "share"
  | "participants"
  | "voting"
  | "summary"
  | "lock"
  | "lockedBy"
  | "yes"
  | "no"
  | "join"
  | "joinHint"
  | "displayName"
  | "guestJoin"
  | "revoked"
  | "createLink"
  | "allowGuest"
  | "agreement"
  | "disagreement"
  | "tradeoffs"
  | "openGroup";

export const groupCopy: Record<Locale, Record<GroupKey, string>> = {
  en: {
    title: "Group planning",
    share: "Share this trip",
    participants: "Who has joined",
    voting: "Vote on suggestions",
    summary: "Where the group agrees",
    lock: "Lock trip and close voting",
    lockedBy: "Locked by",
    yes: "Yes",
    no: "No",
    join: "Join this trip",
    joinHint: "The link itself decides whether you can look, vote or edit.",
    displayName: "Display name",
    guestJoin: "Join as guest",
    revoked: "This link is no longer valid.",
    createLink: "Create share link",
    allowGuest: "Allow guests without an account",
    agreement: "Agreement",
    disagreement: "Disagreement",
    tradeoffs: "Trade-offs",
    openGroup: "Open group",
  },
  ar: {
    title: "تخطيط المجموعة",
    share: "شارك هذه الرحلة",
    participants: "من انضم",
    voting: "التصويت على الاقتراحات",
    summary: "أين تتفق المجموعة",
    lock: "قفل الرحلة وإغلاق التصويت",
    lockedBy: "قفلها",
    yes: "نعم",
    no: "لا",
    join: "انضم إلى هذه الرحلة",
    joinHint: "الرابط يحدد إن كان بإمكانك المشاهدة أو التصويت أو التعديل.",
    displayName: "الاسم الظاهر",
    guestJoin: "انضم كضيف",
    revoked: "هذا الرابط لم يعد صالحاً.",
    createLink: "إنشاء رابط مشاركة",
    allowGuest: "السماح للضيوف دون حساب",
    agreement: "اتفاق",
    disagreement: "اختلاف",
    tradeoffs: "مقايضات",
    openGroup: "فتح المجموعة",
  },
  fr: {
    title: "Planification de groupe",
    share: "Partager ce voyage",
    participants: "Qui a rejoint",
    voting: "Voter sur les suggestions",
    summary: "Là où le groupe s’accorde",
    lock: "Verrouiller et fermer les votes",
    lockedBy: "Verrouillé par",
    yes: "Oui",
    no: "Non",
    join: "Rejoindre ce voyage",
    joinHint: "Le lien décide si vous pouvez voir, voter ou modifier.",
    displayName: "Nom affiché",
    guestJoin: "Rejoindre en invité",
    revoked: "Ce lien n’est plus valable.",
    createLink: "Créer un lien",
    allowGuest: "Autoriser les invités sans compte",
    agreement: "Accord",
    disagreement: "Désaccord",
    tradeoffs: "Compromis",
    openGroup: "Ouvrir le groupe",
  },
};

export function useGroupCopy() {
  const { locale } = useLocale();
  return groupCopy[locale];
}
