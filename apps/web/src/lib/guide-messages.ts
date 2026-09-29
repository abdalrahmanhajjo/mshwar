import { apiRequest } from "@/lib/api/client";
import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/** Messages between a traveller and a guide (guide plan step 5). */
export type GuideMessage = {
  id: string;
  mine: boolean;
  body: string;
  masked: boolean;
  created_at: string;
  read: boolean;
};

export type Conversation = {
  id: string;
  role: "traveller" | "guide";
  guide: { slug: string; display_name: string };
  traveller: { display_name: string };
  last_message_at: string;
  blocked: boolean;
  contact_open: boolean;
  unread: number;
  last: string | null;
  messages: GuideMessage[] | null;
};

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function fetchConversations() {
  return apiRequest<Conversation[]>("/api/v1/guides/conversations");
}

export function fetchConversation(id: string) {
  return apiRequest<Conversation>(`/api/v1/guides/conversations/${id}`);
}

export function startConversation(guideSlug: string, body: string) {
  return apiRequest<Conversation>("/api/v1/guides/conversations", post({ guide_slug: guideSlug, body }));
}

export function sendMessage(id: string, body: string) {
  return apiRequest<Conversation>(`/api/v1/guides/conversations/${id}/messages`, post({ body }));
}

export function closeConversation(id: string, report: boolean, reason: string) {
  return apiRequest<Conversation>(`/api/v1/guides/conversations/${id}/close`, post({ report, reason }));
}

/** The other person in a conversation, as the caller sees them. */
export function otherName(conversation: Conversation): string {
  return conversation.role === "traveller" ? conversation.guide.display_name : conversation.traveller.display_name;
}

export type MessagesKey =
  | "title"
  | "body"
  | "empty"
  | "unread"
  | "placeholder"
  | "send"
  | "maskedNote"
  | "contactClosed"
  | "contactOpen"
  | "block"
  | "report"
  | "reportReason"
  | "reportSend"
  | "blockSend"
  | "blocked"
  | "back"
  | "messageGuide"
  | "firstPlaceholder"
  | "startSend"
  | "loadError"
  | "you"
  | "signIn";

export const messagesCopy: Record<Locale, Record<MessagesKey, string>> = {
  en: {
    title: "Messages",
    body: "Talk with guides before and after you book. Phone numbers, e-mails and links go through once you have a confirmed booking together.",
    empty: "No conversations yet. Message a guide from their page or a tour.",
    unread: "{n} new",
    placeholder: "Write a message…",
    send: "Send",
    maskedNote: "Contact details were hidden. They go through once you have a confirmed booking together.",
    contactClosed: "Phone numbers, e-mails and links are hidden until you have a confirmed booking together.",
    contactOpen: "You have a confirmed booking together, so contact details go through.",
    block: "Block",
    report: "Report",
    reportReason: "What happened?",
    reportSend: "Report and block",
    blockSend: "Block this conversation",
    blocked: "This conversation is closed.",
    back: "All messages",
    messageGuide: "Message the guide",
    firstPlaceholder: "Ask about dates, the route, access or anything else…",
    startSend: "Send message",
    loadError: "We couldn't load your messages. Please try again.",
    you: "You",
    signIn: "Sign in to message the guide",
  },
  ar: {
    title: "الرسائل",
    body: "تحدّث مع المرشدين قبل الحجز وبعده. تظهر أرقام الهواتف والبريد والروابط بعد أن يصبح لديكما حجز مؤكَّد.",
    empty: "لا محادثات بعد. راسل مرشداً من صفحته أو من صفحة جولة.",
    unread: "{n} جديدة",
    placeholder: "اكتب رسالة…",
    send: "إرسال",
    maskedNote: "أُخفيت بيانات التواصل. تظهر بعد أن يصبح لديكما حجز مؤكَّد.",
    contactClosed: "تبقى أرقام الهواتف والبريد والروابط مخفية حتى يصبح لديكما حجز مؤكَّد.",
    contactOpen: "لديكما حجز مؤكَّد، لذلك تظهر بيانات التواصل.",
    block: "حظر",
    report: "إبلاغ",
    reportReason: "ماذا حدث؟",
    reportSend: "إبلاغ وحظر",
    blockSend: "حظر هذه المحادثة",
    blocked: "هذه المحادثة مغلقة.",
    back: "كل الرسائل",
    messageGuide: "راسل المرشد",
    firstPlaceholder: "اسأل عن المواعيد، المسار، سهولة الوصول أو أي شيء آخر…",
    startSend: "أرسل الرسالة",
    loadError: "تعذّر تحميل رسائلك. حاول مجدداً.",
    you: "أنت",
    signIn: "سجّل الدخول لمراسلة المرشد",
  },
  fr: {
    title: "Messages",
    body: "Échangez avec les guides avant et après la réservation. Numéros, e-mails et liens passent une fois une réservation confirmée entre vous.",
    empty: "Pas encore de conversation. Écrivez à un guide depuis sa page ou une visite.",
    unread: "{n} nouveaux",
    placeholder: "Écrire un message…",
    send: "Envoyer",
    maskedNote: "Des coordonnées ont été masquées. Elles passent une fois une réservation confirmée entre vous.",
    contactClosed: "Numéros, e-mails et liens restent masqués jusqu'à une réservation confirmée entre vous.",
    contactOpen: "Vous avez une réservation confirmée ensemble : les coordonnées passent.",
    block: "Bloquer",
    report: "Signaler",
    reportReason: "Que s'est-il passé ?",
    reportSend: "Signaler et bloquer",
    blockSend: "Bloquer cette conversation",
    blocked: "Cette conversation est fermée.",
    back: "Tous les messages",
    messageGuide: "Écrire au guide",
    firstPlaceholder: "Posez vos questions sur les dates, l'itinéraire, l'accessibilité…",
    startSend: "Envoyer le message",
    loadError: "Impossible de charger vos messages. Réessayez.",
    you: "Vous",
    signIn: "Connectez-vous pour écrire au guide",
  },
};

export function useMessagesCopy() {
  const { locale } = useLocale();
  return messagesCopy[locale];
}
