import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

export type ReviewKey =
  | "title"
  | "verified"
  | "write"
  | "submit"
  | "report"
  | "response"
  | "respond"
  | "lowSample"
  | "distribution"
  | "food"
  | "service"
  | "value";

export const reviewCopy: Record<Locale, Record<ReviewKey, string>> = {
  en: {
    title: "Traveller reviews",
    verified: "Verified stay",
    write: "Write a review",
    submit: "Submit review",
    report: "Report",
    response: "Business response",
    respond: "Reply once",
    lowSample: "Too few reviews to show a reliable average.",
    distribution: "Rating distribution",
    food: "Food",
    service: "Service",
    value: "Value",
  },
  ar: {
    title: "تقييمات المسافرين",
    verified: "إقامة موثّقة",
    write: "اكتب تقييماً",
    submit: "إرسال التقييم",
    report: "إبلاغ",
    response: "رد المؤسسة",
    respond: "رد واحد",
    lowSample: "عدد التقييمات قليل لإظهار متوسط موثوق.",
    distribution: "توزيع التقييمات",
    food: "الطعام",
    service: "الخدمة",
    value: "القيمة",
  },
  fr: {
    title: "Avis voyageurs",
    verified: "Séjour vérifié",
    write: "Écrire un avis",
    submit: "Envoyer l’avis",
    report: "Signaler",
    response: "Réponse de l’établissement",
    respond: "Répondre une fois",
    lowSample: "Pas assez d’avis pour une moyenne fiable.",
    distribution: "Répartition des notes",
    food: "Cuisine",
    service: "Service",
    value: "Rapport qualité-prix",
  },
};

export function useReviewCopy() {
  const { locale } = useLocale();
  return reviewCopy[locale];
}
