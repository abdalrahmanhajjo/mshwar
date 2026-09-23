import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/** Copy for G6: the guide agreement step, reporting a problem, and the operators' funnel. */
export type GuideTrustKey =
  | "agreementTitle"
  | "agreementBody"
  | "agreementRead"
  | "agreementCheck"
  | "agreementAccept"
  | "agreementAccepted"
  | "agreementNeeded"
  | "reportOpen"
  | "reportTitle"
  | "reportCategory"
  | "reportSafety"
  | "reportNoShow"
  | "reportPayment"
  | "reportConduct"
  | "reportOther"
  | "reportDetails"
  | "reportSend"
  | "reportSent"
  | "reportSentSafety"
  | "reportCancel"
  | "loadError"
  | "funnelTitle"
  | "funnelBody"
  | "funnelPeriod"
  | "funnelDays"
  | "funnelApplications"
  | "funnelStarted"
  | "funnelSubmitted"
  | "funnelApproved"
  | "funnelRejected"
  | "funnelWaiting"
  | "funnelGuides"
  | "funnelLicensed"
  | "funnelHosts"
  | "funnelHireable"
  | "funnelWithTour"
  | "funnelTours"
  | "funnelRequests"
  | "funnelConfirmed"
  | "funnelCompleted"
  | "funnelEngagements"
  | "funnelAsked"
  | "funnelResponse"
  | "funnelDaysCompleted"
  | "funnelProposals"
  | "funnelAccepted"
  | "funnelReviews"
  | "funnelAverage"
  | "funnelReports"
  | "funnelSafety"
  | "funnelRate";

export const guideTrustCopy: Record<Locale, Record<GuideTrustKey, string>> = {
  en: {
    agreementTitle: "Guide agreement and code of conduct",
    agreementBody:
      "Read it before you send your application. It covers payment on the day, cancellations, safety and how reviews work.",
    agreementRead: "Read the agreement",
    agreementCheck: "I have read and accept the guide agreement and code of conduct (version {version}).",
    agreementAccept: "Accept",
    agreementAccepted: "Accepted (version {version}).",
    agreementNeeded: "Accept the agreement to send your application.",
    reportOpen: "Report a problem",
    reportTitle: "What went wrong?",
    reportCategory: "Kind of problem",
    reportSafety: "Safety",
    reportNoShow: "Didn’t show up",
    reportPayment: "Payment",
    reportConduct: "Behaviour",
    reportOther: "Something else",
    reportDetails: "What happened",
    reportSend: "Send report",
    reportSent: "Thank you. Our team has your report and will contact you.",
    reportSentSafety:
      "Thank you. Safety reports go straight to a person on our team. If anyone is in danger now, call 112.",
    reportCancel: "Close",
    loadError: "Couldn’t load this. Try again.",
    funnelTitle: "Guide funnel",
    funnelBody: "From applications to completed days, over the chosen period.",
    funnelPeriod: "Period",
    funnelDays: "Last {n} days",
    funnelApplications: "Applications",
    funnelStarted: "Started",
    funnelSubmitted: "Submitted",
    funnelApproved: "Approved",
    funnelRejected: "Rejected",
    funnelWaiting: "Waiting now",
    funnelGuides: "Guides",
    funnelLicensed: "Licensed",
    funnelHosts: "Local hosts",
    funnelHireable: "Can be hired",
    funnelWithTour: "With a live tour",
    funnelTours: "Tours live",
    funnelRequests: "Tour requests",
    funnelConfirmed: "Confirmed",
    funnelCompleted: "Completed",
    funnelEngagements: "Hired days",
    funnelAsked: "Asked",
    funnelResponse: "Median answer time: {hours} h",
    funnelDaysCompleted: "Days run",
    funnelProposals: "Place proposals",
    funnelAccepted: "Accepted",
    funnelReviews: "Reviews",
    funnelAverage: "Average for guides: {avg}",
    funnelReports: "Open reports",
    funnelSafety: "Safety reports",
    funnelRate: "{rate}% of the step before",
  },
  ar: {
    agreementTitle: "اتفاقية المرشد ومدوّنة السلوك",
    agreementBody: "اقرأها قبل إرسال طلبك. تتناول الدفع في يوم الجولة والإلغاء والسلامة وكيفية عمل التقييمات.",
    agreementRead: "اقرأ الاتفاقية",
    agreementCheck: "قرأتُ اتفاقية المرشد ومدوّنة السلوك وأوافق عليهما (النسخة {version}).",
    agreementAccept: "أوافق",
    agreementAccepted: "تمت الموافقة (النسخة {version}).",
    agreementNeeded: "وافق على الاتفاقية لإرسال طلبك.",
    reportOpen: "أبلغ عن مشكلة",
    reportTitle: "ما الذي حدث؟",
    reportCategory: "نوع المشكلة",
    reportSafety: "السلامة",
    reportNoShow: "لم يحضر",
    reportPayment: "الدفع",
    reportConduct: "السلوك",
    reportOther: "أمر آخر",
    reportDetails: "ما الذي حدث",
    reportSend: "أرسل البلاغ",
    reportSent: "شكرًا. وصل بلاغك إلى فريقنا وسنتواصل معك.",
    reportSentSafety: "شكرًا. تصل بلاغات السلامة مباشرة إلى أحد أفراد فريقنا. إن كان أحد في خطر الآن، اتصل بالرقم 112.",
    reportCancel: "إغلاق",
    loadError: "تعذّر التحميل. حاول مجددًا.",
    funnelTitle: "مسار المرشدين",
    funnelBody: "من الطلبات إلى الأيام المكتملة، خلال الفترة المختارة.",
    funnelPeriod: "الفترة",
    funnelDays: "آخر {n} يومًا",
    funnelApplications: "الطلبات",
    funnelStarted: "بُدئت",
    funnelSubmitted: "أُرسلت",
    funnelApproved: "مقبولة",
    funnelRejected: "مرفوضة",
    funnelWaiting: "بانتظار المراجعة الآن",
    funnelGuides: "المرشدون",
    funnelLicensed: "مرخّصون",
    funnelHosts: "مضيفون محليون",
    funnelHireable: "قابلون للاستئجار",
    funnelWithTour: "لديهم جولة منشورة",
    funnelTours: "جولات منشورة",
    funnelRequests: "طلبات الجولات",
    funnelConfirmed: "مؤكَّدة",
    funnelCompleted: "مكتملة",
    funnelEngagements: "أيام الاستئجار",
    funnelAsked: "طُلبت",
    funnelResponse: "متوسط وقت الرد: {hours} ساعة",
    funnelDaysCompleted: "أيام أُنجزت",
    funnelProposals: "اقتراحات الأماكن",
    funnelAccepted: "مقبولة",
    funnelReviews: "التقييمات",
    funnelAverage: "متوسط تقييم المرشدين: {avg}",
    funnelReports: "بلاغات مفتوحة",
    funnelSafety: "بلاغات السلامة",
    funnelRate: "{rate}% من الخطوة السابقة",
  },
  fr: {
    agreementTitle: "Accord guide et code de conduite",
    agreementBody:
      "Lisez-le avant d’envoyer votre candidature. Il couvre le paiement sur place, les annulations, la sécurité et les avis.",
    agreementRead: "Lire l’accord",
    agreementCheck: "J’ai lu et j’accepte l’accord guide et le code de conduite (version {version}).",
    agreementAccept: "Accepter",
    agreementAccepted: "Accepté (version {version}).",
    agreementNeeded: "Acceptez l’accord pour envoyer votre candidature.",
    reportOpen: "Signaler un problème",
    reportTitle: "Que s’est-il passé ?",
    reportCategory: "Type de problème",
    reportSafety: "Sécurité",
    reportNoShow: "Absence",
    reportPayment: "Paiement",
    reportConduct: "Comportement",
    reportOther: "Autre chose",
    reportDetails: "Ce qui s’est passé",
    reportSend: "Envoyer le signalement",
    reportSent: "Merci. Notre équipe a reçu votre signalement et vous contactera.",
    reportSentSafety:
      "Merci. Les signalements de sécurité vont directement à une personne de l’équipe. Si quelqu’un est en danger maintenant, appelez le 112.",
    reportCancel: "Fermer",
    loadError: "Chargement impossible. Réessayez.",
    funnelTitle: "Parcours des guides",
    funnelBody: "Des candidatures aux journées terminées, sur la période choisie.",
    funnelPeriod: "Période",
    funnelDays: "{n} derniers jours",
    funnelApplications: "Candidatures",
    funnelStarted: "Commencées",
    funnelSubmitted: "Envoyées",
    funnelApproved: "Approuvées",
    funnelRejected: "Refusées",
    funnelWaiting: "En attente",
    funnelGuides: "Guides",
    funnelLicensed: "Agréés",
    funnelHosts: "Hôtes locaux",
    funnelHireable: "Engageables",
    funnelWithTour: "Avec un circuit en ligne",
    funnelTours: "Circuits en ligne",
    funnelRequests: "Demandes de circuits",
    funnelConfirmed: "Confirmées",
    funnelCompleted: "Terminées",
    funnelEngagements: "Journées engagées",
    funnelAsked: "Demandées",
    funnelResponse: "Délai médian de réponse : {hours} h",
    funnelDaysCompleted: "Journées menées",
    funnelProposals: "Propositions de lieux",
    funnelAccepted: "Acceptées",
    funnelReviews: "Avis",
    funnelAverage: "Moyenne des guides : {avg}",
    funnelReports: "Signalements ouverts",
    funnelSafety: "Signalements de sécurité",
    funnelRate: "{rate} % de l’étape précédente",
  },
};

export type GuideTrustCopy = Record<GuideTrustKey, string>;

export function useGuideTrustCopy(): GuideTrustCopy {
  const { locale } = useLocale();
  return guideTrustCopy[locale];
}
