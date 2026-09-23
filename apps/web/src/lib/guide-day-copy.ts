import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/** Copy for running the day (G5): the day sheet, start and finish, and two-sided reviews. */
export type GuideDayKey =
  | "kicker"
  | "print"
  | "offline"
  | "savedOffline"
  | "meeting"
  | "openMap"
  | "stops"
  | "leg"
  | "group"
  | "people"
  | "collect"
  | "free"
  | "phone"
  | "noPhone"
  | "pending"
  | "dietary"
  | "accessibility"
  | "children"
  | "note"
  | "bring"
  | "reputation"
  | "newTraveller"
  | "stateScheduled"
  | "stateStarted"
  | "stateCompleted"
  | "start"
  | "complete"
  | "completeHint"
  | "daysTitle"
  | "daysEmpty"
  | "openSheet"
  | "kindTour"
  | "kindHire"
  | "loadError"
  | "reviewsKicker"
  | "reviewsTitle"
  | "reviewsBody"
  | "toWrite"
  | "toWriteEmpty"
  | "aboutYou"
  | "aboutYouEmpty"
  | "waiting"
  | "ratingLabel"
  | "reviewBody"
  | "send"
  | "sent"
  | "sentReleased"
  | "travellerTitle"
  | "travellerBody"
  | "aboutYouTraveller"
  | "publicTitle"
  | "publicSummary"
  | "publicEmpty"
  | "reviewGuide";

export const guideDayCopy: Record<Locale, Record<GuideDayKey, string>> = {
  en: {
    kicker: "Day sheet",
    print: "Print",
    offline: "No connection. Showing the copy saved on this device at {time}.",
    savedOffline: "Saved on this device for offline use.",
    meeting: "Meeting point",
    openMap: "Open in maps",
    stops: "Stops",
    leg: "{minutes} min · {km} km",
    group: "The group",
    people: "{n} people",
    collect: "Collect {amount}",
    free: "Free",
    phone: "Phone",
    noPhone: "Phone shared once confirmed",
    pending: "Not confirmed yet",
    dietary: "Food",
    accessibility: "Access",
    children: "Children",
    note: "Note",
    bring: "Remind them to bring",
    reputation: "{average}★ from {n} guides",
    newTraveller: "First time with a guide",
    stateScheduled: "Not started",
    stateStarted: "Under way",
    stateCompleted: "Done",
    start: "Start the day",
    complete: "Finish the day",
    completeHint: "Finishing completes the bookings and asks everyone for a review.",
    daysTitle: "Your next days",
    daysEmpty: "No confirmed days in the next two weeks.",
    openSheet: "Day sheet",
    kindTour: "Tour",
    kindHire: "Hired day",
    loadError: "Couldn’t load this. Try again.",
    reviewsKicker: "Reviews",
    reviewsTitle: "Reviews, both ways",
    reviewsBody:
      "After a day, you and each traveller review each other. Neither sees the other’s review until both are written, or fourteen days pass.",
    toWrite: "Still to write",
    toWriteEmpty: "Nothing to write right now.",
    aboutYou: "What people said about you",
    aboutYouEmpty: "No released reviews yet.",
    waiting: "{n} of your reviews are waiting for the other side.",
    ratingLabel: "Rating",
    reviewBody: "A few words",
    send: "Send review",
    sent: "Thanks. It stays private until the other side writes theirs.",
    sentReleased: "Thanks. Both reviews are now visible.",
    travellerTitle: "Review your guide",
    travellerBody: "Your guide is reviewing you too. You’ll both see the reviews once both are in.",
    aboutYouTraveller: "What guides said about you",
    publicTitle: "What travellers say",
    publicSummary: "{average}★ from {n} reviews",
    publicEmpty: "No reviews yet.",
    reviewGuide: "Review your guide",
  },
  ar: {
    kicker: "ورقة اليوم",
    print: "اطبع",
    offline: "لا اتصال. تُعرض النسخة المحفوظة على هذا الجهاز عند {time}.",
    savedOffline: "محفوظة على هذا الجهاز للاستخدام دون اتصال.",
    meeting: "نقطة اللقاء",
    openMap: "افتح في الخرائط",
    stops: "المحطات",
    leg: "{minutes} دقيقة · {km} كم",
    group: "المجموعة",
    people: "{n} أشخاص",
    collect: "حصّل {amount}",
    free: "مجاني",
    phone: "الهاتف",
    noPhone: "يُشارك الهاتف بعد التأكيد",
    pending: "غير مؤكَّد بعد",
    dietary: "الطعام",
    accessibility: "الوصول",
    children: "الأطفال",
    note: "ملاحظة",
    bring: "ذكّرهم بإحضار",
    reputation: "{average}★ من {n} مرشدين",
    newTraveller: "أول مرة مع مرشد",
    stateScheduled: "لم يبدأ",
    stateStarted: "جارٍ",
    stateCompleted: "انتهى",
    start: "ابدأ اليوم",
    complete: "أنهِ اليوم",
    completeHint: "إنهاء اليوم يُكمل الحجوزات ويطلب من الجميع تقييمًا.",
    daysTitle: "أيامك القادمة",
    daysEmpty: "لا أيام مؤكَّدة في الأسبوعين القادمين.",
    openSheet: "ورقة اليوم",
    kindTour: "جولة",
    kindHire: "يوم محجوز",
    loadError: "تعذّر التحميل. حاول مجددًا.",
    reviewsKicker: "التقييمات",
    reviewsTitle: "تقييمات في الاتجاهين",
    reviewsBody:
      "بعد كل يوم، يقيّم كلٌّ منك ومن كل مسافر الآخر. لا يرى أحد تقييم الآخر حتى يكتب الطرفان أو تمرّ أربعة عشر يومًا.",
    toWrite: "لم تُكتب بعد",
    toWriteEmpty: "لا شيء لكتابته الآن.",
    aboutYou: "ما قاله الناس عنك",
    aboutYouEmpty: "لا تقييمات منشورة بعد.",
    waiting: "{n} من تقييماتك بانتظار الطرف الآخر.",
    ratingLabel: "التقييم",
    reviewBody: "بضع كلمات",
    send: "أرسل التقييم",
    sent: "شكرًا. يبقى خاصًا حتى يكتب الطرف الآخر تقييمه.",
    sentReleased: "شكرًا. أصبح التقييمان مرئيين الآن.",
    travellerTitle: "قيّم مرشدك",
    travellerBody: "مرشدك يقيّمك أيضًا. سترون التقييمين بعد اكتمالهما.",
    aboutYouTraveller: "ما قاله المرشدون عنك",
    publicTitle: "ما يقوله المسافرون",
    publicSummary: "{average}★ من {n} تقييمات",
    publicEmpty: "لا تقييمات بعد.",
    reviewGuide: "قيّم مرشدك",
  },
  fr: {
    kicker: "Feuille de route",
    print: "Imprimer",
    offline: "Pas de connexion. Copie enregistrée sur cet appareil à {time}.",
    savedOffline: "Enregistrée sur cet appareil pour usage hors ligne.",
    meeting: "Point de rendez-vous",
    openMap: "Ouvrir dans Plans",
    stops: "Étapes",
    leg: "{minutes} min · {km} km",
    group: "Le groupe",
    people: "{n} personnes",
    collect: "Encaisser {amount}",
    free: "Gratuit",
    phone: "Téléphone",
    noPhone: "Téléphone communiqué après confirmation",
    pending: "Pas encore confirmé",
    dietary: "Alimentation",
    accessibility: "Accessibilité",
    children: "Enfants",
    note: "Note",
    bring: "Pensez à leur rappeler",
    reputation: "{average}★ de {n} guides",
    newTraveller: "Première fois avec un guide",
    stateScheduled: "Pas commencé",
    stateStarted: "En cours",
    stateCompleted: "Terminé",
    start: "Commencer la journée",
    complete: "Terminer la journée",
    completeHint: "Terminer clôt les réservations et demande un avis à chacun.",
    daysTitle: "Vos prochaines journées",
    daysEmpty: "Aucune journée confirmée dans les deux prochaines semaines.",
    openSheet: "Feuille de route",
    kindTour: "Circuit",
    kindHire: "Journée engagée",
    loadError: "Chargement impossible. Réessayez.",
    reviewsKicker: "Avis",
    reviewsTitle: "Avis dans les deux sens",
    reviewsBody:
      "Après une journée, vous et chaque voyageur vous évaluez mutuellement. Personne ne voit l’avis de l’autre avant que les deux soient écrits, ou après quatorze jours.",
    toWrite: "À écrire",
    toWriteEmpty: "Rien à écrire pour le moment.",
    aboutYou: "Ce qu’on a dit de vous",
    aboutYouEmpty: "Aucun avis publié pour l’instant.",
    waiting: "{n} de vos avis attendent l’autre partie.",
    ratingLabel: "Note",
    reviewBody: "Quelques mots",
    send: "Envoyer l’avis",
    sent: "Merci. Il reste privé jusqu’à ce que l’autre partie écrive le sien.",
    sentReleased: "Merci. Les deux avis sont maintenant visibles.",
    travellerTitle: "Évaluez votre guide",
    travellerBody: "Votre guide vous évalue aussi. Vous verrez les deux avis une fois écrits.",
    aboutYouTraveller: "Ce que les guides ont dit de vous",
    publicTitle: "Ce qu’en disent les voyageurs",
    publicSummary: "{average}★ sur {n} avis",
    publicEmpty: "Pas encore d’avis.",
    reviewGuide: "Évaluer votre guide",
  },
};

export type GuideDayCopy = Record<GuideDayKey, string>;

export function useGuideDayCopy(): GuideDayCopy {
  const { locale } = useLocale();
  return guideDayCopy[locale];
}
