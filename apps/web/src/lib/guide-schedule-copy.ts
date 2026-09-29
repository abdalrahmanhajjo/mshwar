import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/**
 * Copy for the guide's scheduling tools (guide plan step 2): schedules per tour, the
 * guide's rules (buffer, cut-off, travel time) and blocked time.
 */
export type GuideScheduleKey =
  | "schedulesTitle"
  | "schedulesBody"
  | "schedulesEmpty"
  | "scheduleAdd"
  | "scheduleEdit"
  | "scheduleDelete"
  | "scheduleDeleted"
  | "scheduleSaved"
  | "scheduleDays"
  | "scheduleTimes"
  | "scheduleTimeAdd"
  | "scheduleTimeRemove"
  | "scheduleSeason"
  | "scheduleFrom"
  | "scheduleTo"
  | "scheduleSeats"
  | "scheduleSeatsHint"
  | "scheduleMode"
  | "scheduleShared"
  | "schedulePrivate"
  | "scheduleMinGroup"
  | "scheduleMinGroupHint"
  | "scheduleDeadline"
  | "scheduleSave"
  | "scheduleCancel"
  | "scheduleEveryDay"
  | "scheduleOpen"
  | "scheduleSince"
  | "scheduleUntil"
  | "scheduleSharedSeats"
  | "scheduleSharedGroup"
  | "schedulePrivateShort"
  | "scheduleRunsWith"
  | "scheduleNeedDay"
  | "scheduleNeedTime"
  | "day0"
  | "day1"
  | "day2"
  | "day3"
  | "day4"
  | "day5"
  | "day6"
  | "rulesTitle"
  | "rulesBody"
  | "rulesBuffer"
  | "rulesBufferHint"
  | "rulesCutoff"
  | "rulesCutoffHint"
  | "rulesTravel"
  | "rulesTravelHint"
  | "blocksTitle"
  | "blocksBody"
  | "blocksEmpty"
  | "blockDate"
  | "blockFrom"
  | "blockTo"
  | "blockNote"
  | "blockAdd"
  | "blockRemove"
  | "blockAdded"
  | "blockInvalid"
  | "slotPrivate"
  | "slotMinGroup";

export type GuideScheduleCopy = Record<GuideScheduleKey, string>;

export const guideScheduleCopy: Record<Locale, GuideScheduleCopy> = {
  en: {
    schedulesTitle: "When this tour runs",
    schedulesBody:
      "Add one schedule per rhythm: the days, the start times and, if you like, a season. Starts open 120 days ahead and stay filled every night.",
    schedulesEmpty: "No schedule yet. Add one so travellers can pick a date.",
    scheduleAdd: "Add a schedule",
    scheduleEdit: "Edit",
    scheduleDelete: "Stop",
    scheduleDeleted: "Schedule stopped: {cleared} empty starts removed, {kept} booked starts kept.",
    scheduleSaved: "Saved. {created} starts are open for the next 120 days.",
    scheduleDays: "Days",
    scheduleTimes: "Start times",
    scheduleTimeAdd: "Add time",
    scheduleTimeRemove: "Remove {time}",
    scheduleSeason: "Season (optional)",
    scheduleFrom: "From",
    scheduleTo: "Until",
    scheduleSeats: "Seats per start",
    scheduleSeatsHint: "Leave empty to use the tour's largest group.",
    scheduleMode: "Who joins",
    scheduleShared: "Shared: separate bookings fill the seats",
    schedulePrivate: "Private: one booking takes the whole start",
    scheduleMinGroup: "Minimum guests to run",
    scheduleMinGroupHint:
      "If fewer guests have booked by the deadline, the run is cancelled and everyone is told why. Nothing is owed.",
    scheduleDeadline: "Decide this many hours before",
    scheduleSave: "Save schedule",
    scheduleCancel: "Cancel",
    scheduleEveryDay: "Every day",
    scheduleOpen: "{n} starts open",
    scheduleSince: "from {date}",
    scheduleUntil: "until {date}",
    scheduleSharedSeats: "Shared · {n} seats",
    scheduleSharedGroup: "Shared",
    schedulePrivateShort: "Private",
    scheduleRunsWith: "runs with {n}+ guests",
    scheduleNeedDay: "Choose at least one day.",
    scheduleNeedTime: "Add at least one start time.",
    day0: "Mon",
    day1: "Tue",
    day2: "Wed",
    day3: "Thu",
    day4: "Fri",
    day5: "Sat",
    day6: "Sun",
    rulesTitle: "Your booking rules",
    rulesBody: "Mshwar applies these to every booking, so you are never in two places at once.",
    rulesBuffer: "Buffer between runs (minutes)",
    rulesBufferHint: "Kept free before and after every booked run.",
    rulesCutoff: "Cut-off for the next day",
    rulesCutoffHint: "For example 18:00: bookings for tomorrow close at 18:00 today. Leave empty for none.",
    rulesTravel: "Add driving time between meeting points",
    rulesTravelHint: "A cautious estimate from the distance, so you are never late for the next group.",
    blocksTitle: "Blocked time",
    blocksBody:
      "Time you can't work. Starts inside it are hidden from travellers. A block can't cover a booking you already have.",
    blocksEmpty: "Nothing blocked.",
    blockDate: "Date",
    blockFrom: "From",
    blockTo: "To",
    blockNote: "Note (only you see it)",
    blockAdd: "Block this time",
    blockRemove: "Remove block",
    blockAdded: "Time blocked.",
    blockInvalid: "Choose a date and an end after the start.",
    slotPrivate: "Private",
    slotMinGroup: "Runs with {n}+",
  },
  ar: {
    schedulesTitle: "متى تُقام هذه الجولة",
    schedulesBody:
      "أضف جدولاً لكل إيقاع: الأيام وأوقات الانطلاق، وموسماً إن أردت. تُفتح المواعيد لـ120 يوماً مقبلة وتُجدَّد كل ليلة.",
    schedulesEmpty: "لا جدول بعد. أضف جدولاً ليختار المسافرون موعداً.",
    scheduleAdd: "إضافة جدول",
    scheduleEdit: "تعديل",
    scheduleDelete: "إيقاف",
    scheduleDeleted: "أُوقف الجدول: حُذف {cleared} موعداً فارغاً وبقي {kept} موعداً محجوزاً.",
    scheduleSaved: "تم الحفظ. {created} موعداً مفتوحاً للأيام الـ120 المقبلة.",
    scheduleDays: "الأيام",
    scheduleTimes: "أوقات الانطلاق",
    scheduleTimeAdd: "إضافة وقت",
    scheduleTimeRemove: "إزالة {time}",
    scheduleSeason: "الموسم (اختياري)",
    scheduleFrom: "من",
    scheduleTo: "حتى",
    scheduleSeats: "المقاعد لكل موعد",
    scheduleSeatsHint: "اتركه فارغاً لاعتماد أكبر مجموعة في الجولة.",
    scheduleMode: "من ينضم",
    scheduleShared: "مشتركة: حجوزات منفصلة تملأ المقاعد",
    schedulePrivate: "خاصة: حجز واحد يأخذ الموعد كله",
    scheduleMinGroup: "أقل عدد من الضيوف لإقامتها",
    scheduleMinGroupHint: "إن كان عدد الحاجزين أقل عند المهلة، تُلغى الجولة ويُبلَّغ الجميع بالسبب. لا شيء مستحق.",
    scheduleDeadline: "القرار قبل هذا العدد من الساعات",
    scheduleSave: "حفظ الجدول",
    scheduleCancel: "إلغاء",
    scheduleEveryDay: "كل يوم",
    scheduleOpen: "{n} موعداً مفتوحاً",
    scheduleSince: "من {date}",
    scheduleUntil: "حتى {date}",
    scheduleSharedSeats: "مشتركة · {n} مقاعد",
    scheduleSharedGroup: "مشتركة",
    schedulePrivateShort: "خاصة",
    scheduleRunsWith: "تُقام بـ{n} ضيوف أو أكثر",
    scheduleNeedDay: "اختر يوماً واحداً على الأقل.",
    scheduleNeedTime: "أضف وقت انطلاق واحداً على الأقل.",
    day0: "الإثنين",
    day1: "الثلاثاء",
    day2: "الأربعاء",
    day3: "الخميس",
    day4: "الجمعة",
    day5: "السبت",
    day6: "الأحد",
    rulesTitle: "قواعد الحجز لديك",
    rulesBody: "يطبّقها مشوار على كل حجز، فلا تكون في مكانين في الوقت نفسه.",
    rulesBuffer: "فاصل بين الجولات (بالدقائق)",
    rulesBufferHint: "وقت يبقى فارغاً قبل كل جولة محجوزة وبعدها.",
    rulesCutoff: "موعد الإغلاق لليوم التالي",
    rulesCutoffHint: "مثلاً 18:00: تُغلق حجوزات الغد عند 18:00 اليوم. اتركه فارغاً إن لم ترد إغلاقاً.",
    rulesTravel: "احتساب وقت القيادة بين نقاط اللقاء",
    rulesTravelHint: "تقدير حذر انطلاقاً من المسافة، كي لا تتأخر عن المجموعة التالية.",
    blocksTitle: "الأوقات المحجوبة",
    blocksBody: "وقت لا تستطيع العمل فيه. تُخفى المواعيد ضمنه عن المسافرين. لا يمكن أن يغطي الحجب حجزاً لديك.",
    blocksEmpty: "لا شيء محجوب.",
    blockDate: "التاريخ",
    blockFrom: "من",
    blockTo: "إلى",
    blockNote: "ملاحظة (تراها أنت فقط)",
    blockAdd: "حجب هذا الوقت",
    blockRemove: "إزالة الحجب",
    blockAdded: "تم حجب الوقت.",
    blockInvalid: "اختر تاريخاً ونهايةً بعد البداية.",
    slotPrivate: "خاصة",
    slotMinGroup: "تُقام بـ{n}+",
  },
  fr: {
    schedulesTitle: "Quand cette visite a lieu",
    schedulesBody:
      "Ajoutez un horaire par rythme : les jours, les heures de départ et, si vous voulez, une saison. Les départs s'ouvrent 120 jours à l'avance et sont complétés chaque nuit.",
    schedulesEmpty: "Pas encore d'horaire. Ajoutez-en un pour que les voyageurs choisissent une date.",
    scheduleAdd: "Ajouter un horaire",
    scheduleEdit: "Modifier",
    scheduleDelete: "Arrêter",
    scheduleDeleted: "Horaire arrêté : {cleared} départs vides retirés, {kept} départs réservés conservés.",
    scheduleSaved: "Enregistré. {created} départs ouverts pour les 120 prochains jours.",
    scheduleDays: "Jours",
    scheduleTimes: "Heures de départ",
    scheduleTimeAdd: "Ajouter une heure",
    scheduleTimeRemove: "Retirer {time}",
    scheduleSeason: "Saison (facultatif)",
    scheduleFrom: "Du",
    scheduleTo: "Au",
    scheduleSeats: "Places par départ",
    scheduleSeatsHint: "Laissez vide pour reprendre le plus grand groupe de la visite.",
    scheduleMode: "Qui participe",
    scheduleShared: "Partagé : des réservations distinctes remplissent les places",
    schedulePrivate: "Privé : une réservation prend tout le départ",
    scheduleMinGroup: "Nombre minimum de participants",
    scheduleMinGroupHint:
      "S'il y a moins de participants à l'échéance, la sortie est annulée et chacun est prévenu du motif. Rien n'est dû.",
    scheduleDeadline: "Décider ce nombre d'heures avant",
    scheduleSave: "Enregistrer l'horaire",
    scheduleCancel: "Annuler",
    scheduleEveryDay: "Tous les jours",
    scheduleOpen: "{n} départs ouverts",
    scheduleSince: "à partir du {date}",
    scheduleUntil: "jusqu'au {date}",
    scheduleSharedSeats: "Partagé · {n} places",
    scheduleSharedGroup: "Partagé",
    schedulePrivateShort: "Privé",
    scheduleRunsWith: "a lieu dès {n} participants",
    scheduleNeedDay: "Choisissez au moins un jour.",
    scheduleNeedTime: "Ajoutez au moins une heure de départ.",
    day0: "Lun",
    day1: "Mar",
    day2: "Mer",
    day3: "Jeu",
    day4: "Ven",
    day5: "Sam",
    day6: "Dim",
    rulesTitle: "Vos règles de réservation",
    rulesBody: "Mshwar les applique à chaque réservation : vous n'êtes jamais à deux endroits à la fois.",
    rulesBuffer: "Battement entre les sorties (minutes)",
    rulesBufferHint: "Temps gardé libre avant et après chaque sortie réservée.",
    rulesCutoff: "Clôture pour le lendemain",
    rulesCutoffHint: "Par exemple 18:00 : les réservations pour demain ferment aujourd'hui à 18:00. Vide : aucune.",
    rulesTravel: "Ajouter le trajet entre les points de rendez-vous",
    rulesTravelHint:
      "Une estimation prudente à partir de la distance, pour ne jamais faire attendre le groupe suivant.",
    blocksTitle: "Temps bloqué",
    blocksBody:
      "Le temps où vous ne pouvez pas travailler. Les départs qui y tombent sont masqués. Un blocage ne peut pas couvrir une réservation existante.",
    blocksEmpty: "Rien de bloqué.",
    blockDate: "Date",
    blockFrom: "De",
    blockTo: "À",
    blockNote: "Note (visible par vous seul)",
    blockAdd: "Bloquer ce créneau",
    blockRemove: "Retirer le blocage",
    blockAdded: "Créneau bloqué.",
    blockInvalid: "Choisissez une date et une fin après le début.",
    slotPrivate: "Privé",
    slotMinGroup: "Dès {n} participants",
  },
};

export function useGuideScheduleCopy(): GuideScheduleCopy {
  const { locale } = useLocale();
  return guideScheduleCopy[locale];
}
