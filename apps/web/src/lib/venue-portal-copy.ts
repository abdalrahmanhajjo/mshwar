import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/** Copy for the business portal's restaurant and stay details, and listing claims. */
export type VenuePortalKey =
  | "detailsTitle"
  | "detailsBody"
  | "kindLabel"
  | "kind_experience"
  | "kind_attraction"
  | "kind_restaurant"
  | "kind_hotel"
  | "licenceNumber"
  | "licenceAuthority"
  | "licenceExpires"
  | "licenceNote"
  | "cuisines"
  | "priceLevel"
  | "priceAny"
  | "reservationPhone"
  | "reservationWhatsapp"
  | "reservationUrl"
  | "stayType"
  | "stay_hotel"
  | "stay_guesthouse"
  | "stay_hostel"
  | "stay_apartment"
  | "stars"
  | "rooms"
  | "checkIn"
  | "checkOut"
  | "priceFrom"
  | "bookingUrl"
  | "acceptsRequests"
  | "amenities"
  | "accessibility"
  | "save"
  | "saved"
  | "checkedStatus"
  | "notChecked"
  | "loadError"
  | "claimsTitle"
  | "claimsBody"
  | "findPlace"
  | "chosen"
  | "change"
  | "claimNote"
  | "sendClaim"
  | "claimSent"
  | "yourClaims"
  | "claim_pending"
  | "claim_approved"
  | "claim_rejected"
  | "noClaims"
  | "noOrg"
  | "placeTypesTitle"
  | "placeTypesBody"
  | "placeTypesHint"
  | "placeTypesMain"
  | "placeTypesChosen"
  | "placeTypesNone"
  | "placeTypesFull"
  | "mealServices"
  | "meal_breakfast"
  | "meal_brunch"
  | "meal_lunch"
  | "meal_dinner"
  | "meal_late"
  | "scheduleNote"
  | "scheduleNoteHint"
  | "placeTypesSave"
  | "placeTypesSaved"
  | "group_food"
  | "group_stay"
  | "group_nature"
  | "group_heritage"
  | "group_entertainment"
  | "group_sport"
  | "group_wellness"
  | "group_shopping"
  | "group_family"
  | "group_events"
  | "group_essentials"
  | "placeTypesRemove"
  | "typicalSpend"
  | "typicalSpendHint"
  | "factsTitle"
  | "factsBody"
  | "factsStale"
  | "factsCheckedOn"
  | "factsUnknown"
  | "factsYes"
  | "factsNo"
  | "factsFood"
  | "factsAccess"
  | "factsPayment"
  | "fact_halal"
  | "fact_vegetarian"
  | "fact_vegan"
  | "fact_gluten_free"
  | "fact_serves_alcohol"
  | "fact_outdoor_seating"
  | "fact_wheelchair_access"
  | "fact_step_free"
  | "fact_accessible_toilet"
  | "fact_parking"
  | "fact_kids_friendly"
  | "fact_stroller_friendly"
  | "fact_accepts_card"
  | "fact_accepts_usd_cash"
  | "fact_accepts_lbp_cash"
  | "factsViews"
  | "view_sea"
  | "view_mountain"
  | "view_city"
  | "view_valley"
  | "view_sunset"
  | "factsMinAge"
  | "factsLanguages"
  | "factsLanguagesHint"
  | "factsDressCode"
  | "factsSave"
  | "factsSaved";

export const venuePortalCopy: Record<Locale, Record<VenuePortalKey, string>> = {
  en: {
    detailsTitle: "Restaurant or place to stay",
    detailsBody:
      "Add your tourism licence so travellers can see it was checked. Our team confirms it with the issuer before the badge shows.",
    kindLabel: "This listing is",
    kind_experience: "An experience",
    kind_attraction: "A place to visit",
    kind_restaurant: "A restaurant",
    kind_hotel: "A place to stay",
    licenceNumber: "Licence number",
    licenceAuthority: "Issued by",
    licenceExpires: "Licence expires",
    licenceNote: "Changing the licence number removes the check until we confirm it again.",
    cuisines: "Cuisines (comma separated)",
    priceLevel: "Price level",
    priceAny: "Not set",
    reservationPhone: "Reservation phone",
    reservationWhatsapp: "WhatsApp number",
    reservationUrl: "Online reservation link (https)",
    stayType: "Type of stay",
    stay_hotel: "Hotel",
    stay_guesthouse: "Guesthouse",
    stay_hostel: "Hostel",
    stay_apartment: "Apartment",
    stars: "Stars (official rating)",
    rooms: "Rooms",
    checkIn: "Check-in from",
    checkOut: "Check-out by",
    priceFrom: "Nightly price from (USD)",
    bookingUrl: "Booking link (https)",
    acceptsRequests: "Travellers can ask to stay through Mshwar",
    amenities: "Amenities (comma separated)",
    accessibility: "Accessibility (comma separated)",
    save: "Save details",
    saved: "Saved.",
    checkedStatus: "Checked {date}; re-check by {due}",
    notChecked: "Not checked yet. Once your licence number is in, our team will check it.",
    loadError: "Couldn't load. Try again.",
    claimsTitle: "Claim a place Mshwar listed",
    claimsBody:
      "If our team listed your restaurant or place to stay, claim it to manage it here. We check your licence before handing it over.",
    findPlace: "Find your place by name",
    chosen: "Chosen: {place}",
    change: "Change",
    claimNote: "How we can confirm it's yours (licence number, your role)",
    sendClaim: "Send claim",
    claimSent: "Claim sent. We'll check it and let you know.",
    yourClaims: "Your claims",
    claim_pending: "Waiting",
    claim_approved: "Approved",
    claim_rejected: "Rejected",
    noClaims: "No claims yet.",
    noOrg: "Choose a business first.",
    placeTypesTitle: "What kind of place is this?",
    placeTypesBody:
      "Travellers plan days step by step – “breakfast at a sweets shop, then bowling”. Choose what your place is so the planner can offer it for the right step.",
    placeTypesHint: "Choose up to six. The first one you choose is the main one.",
    placeTypesMain: "Main",
    placeTypesChosen: "Chosen",
    placeTypesNone: "Choose at least one kind of place.",
    placeTypesFull: "You have chosen six. Remove one to choose another.",
    mealServices: "Meals you serve",
    meal_breakfast: "Breakfast",
    meal_brunch: "Brunch",
    meal_lunch: "Lunch",
    meal_dinner: "Dinner",
    meal_late: "Late night",
    scheduleNote: "Note about times",
    scheduleNoteHint:
      "Times change (films, shows)? Say how travellers can check – we never show a time we do not have.",
    placeTypesSave: "Save kinds of place",
    placeTypesSaved: "Saved. The trip planner can now offer this place for these steps.",
    group_food: "Food and drink",
    group_stay: "Places to stay",
    group_nature: "Nature",
    group_heritage: "Heritage and culture",
    group_entertainment: "Entertainment",
    group_sport: "Sport and adventure",
    group_wellness: "Wellness",
    group_shopping: "Shopping",
    group_family: "Family",
    group_events: "Events",
    group_essentials: "Essentials",
    placeTypesRemove: "Remove {name}",
    typicalSpend: "Typical spend per person (USD)",
    typicalSpendHint:
      "What one person usually spends on a meal here. The trip planner prices meals with it; without it a meal shows “price on request”.",
    factsTitle: "What travellers can count on",
    factsBody:
      "Travellers filter their day on these. Answer only what you are sure of: “Not sure” is better than a guess, and a “No” keeps the wrong travellers away.",
    factsStale:
      "These answers are over a year old, so the planner no longer uses them. Check them and save to confirm.",
    factsCheckedOn: "Last confirmed {date}",
    factsUnknown: "Not sure",
    factsYes: "Yes",
    factsNo: "No",
    factsFood: "Food and drink",
    factsAccess: "Access and families",
    factsPayment: "Payment",
    fact_halal: "Halal",
    fact_vegetarian: "Vegetarian dishes",
    fact_vegan: "Vegan dishes",
    fact_gluten_free: "Gluten-free dishes",
    fact_serves_alcohol: "Serves alcohol",
    fact_outdoor_seating: "Outdoor seating",
    fact_wheelchair_access: "Wheelchair access",
    fact_step_free: "Step-free entrance",
    fact_accessible_toilet: "Accessible toilet",
    fact_parking: "Parking",
    fact_kids_friendly: "Good for children",
    fact_stroller_friendly: "Pushchair-friendly",
    fact_accepts_card: "Cards accepted",
    fact_accepts_usd_cash: "US dollars cash",
    fact_accepts_lbp_cash: "Lebanese pounds cash",
    factsViews: "Views",
    view_sea: "Sea",
    view_mountain: "Mountain",
    view_city: "City",
    view_valley: "Valley",
    view_sunset: "Sunset",
    factsMinAge: "Minimum age",
    factsLanguages: "Languages spoken",
    factsLanguagesHint: "Separate with commas, e.g. Arabic, English, French.",
    factsDressCode: "Dress code",
    factsSave: "Save facts",
    factsSaved: "Saved. Travellers who need these can now find this place.",
  },
  ar: {
    detailsTitle: "مطعم أو مكان إقامة",
    detailsBody:
      "أضف ترخيصك السياحي ليرى المسافرون أنه جرى التحقّق منه. يتأكّد فريقنا منه لدى الجهة المُصدِرة قبل ظهور الشارة.",
    kindLabel: "هذا الإدراج",
    kind_experience: "تجربة",
    kind_attraction: "مكان للزيارة",
    kind_restaurant: "مطعم",
    kind_hotel: "مكان إقامة",
    licenceNumber: "رقم الترخيص",
    licenceAuthority: "الجهة المُصدِرة",
    licenceExpires: "تاريخ انتهاء الترخيص",
    licenceNote: "تغيير رقم الترخيص يُزيل التحقّق إلى أن نؤكّده مجددًا.",
    cuisines: "المطابخ (مفصولة بفواصل)",
    priceLevel: "مستوى السعر",
    priceAny: "غير محدّد",
    reservationPhone: "هاتف الحجز",
    reservationWhatsapp: "رقم واتساب",
    reservationUrl: "رابط الحجز عبر الإنترنت (https)",
    stayType: "نوع الإقامة",
    stay_hotel: "فندق",
    stay_guesthouse: "بيت ضيافة",
    stay_hostel: "نُزُل",
    stay_apartment: "شقة",
    stars: "النجوم (التصنيف الرسمي)",
    rooms: "الغرف",
    checkIn: "الوصول من",
    checkOut: "المغادرة قبل",
    priceFrom: "سعر الليلة ابتداءً من (دولار)",
    bookingUrl: "رابط الحجز (https)",
    acceptsRequests: "يمكن للمسافرين طلب الإقامة عبر مشوار",
    amenities: "المرافق (مفصولة بفواصل)",
    accessibility: "إمكانية الوصول (مفصولة بفواصل)",
    save: "احفظ التفاصيل",
    saved: "تم الحفظ.",
    checkedStatus: "تحقّقنا في {date}؛ إعادة التحقّق قبل {due}",
    notChecked: "لم يُتحقّق منه بعد. بعد إدخال رقم ترخيصك سيتحقّق منه فريقنا.",
    loadError: "تعذّر التحميل. حاول مجددًا.",
    claimsTitle: "طالب بمكان أدرجه مشوار",
    claimsBody: "إذا أدرج فريقنا مطعمك أو مكان إقامتك فطالب به لإدارته من هنا. نتحقّق من ترخيصك قبل تسليمه.",
    findPlace: "ابحث عن مكانك باسمه",
    chosen: "المختار: {place}",
    change: "غيّر",
    claimNote: "كيف نتأكّد أنه لك (رقم الترخيص، دورك)",
    sendClaim: "أرسل الطلب",
    claimSent: "أُرسل الطلب. سنتحقّق منه ونُعلمك.",
    yourClaims: "طلباتك",
    claim_pending: "بانتظار المراجعة",
    claim_approved: "موافق عليه",
    claim_rejected: "مرفوض",
    noClaims: "لا طلبات بعد.",
    noOrg: "اختر مؤسسة أولًا.",
    placeTypesTitle: "ما نوع هذا المكان؟",
    placeTypesBody:
      "يخطّط المسافرون يومهم خطوة بخطوة – «ترويقة عند محل حلويات، ثم بولينغ». اختر نوع مكانك ليقترحه المخطِّط في الخطوة المناسبة.",
    placeTypesHint: "اختر حتى ستة أنواع. أول نوع تختاره هو النوع الرئيسي.",
    placeTypesMain: "رئيسي",
    placeTypesChosen: "المختار",
    placeTypesNone: "اختر نوعًا واحدًا على الأقل.",
    placeTypesFull: "اخترت ستة أنواع. أزل واحدًا لتختار غيره.",
    mealServices: "الوجبات التي تقدّمها",
    meal_breakfast: "فطور",
    meal_brunch: "برانش",
    meal_lunch: "غداء",
    meal_dinner: "عشاء",
    meal_late: "آخر الليل",
    scheduleNote: "ملاحظة عن المواعيد",
    scheduleNoteHint:
      "هل تتغيّر المواعيد (أفلام، عروض)؟ اذكر كيف يتحقّق المسافرون منها – لا نعرض أبدًا موعدًا لا نملكه.",
    placeTypesSave: "احفظ أنواع المكان",
    placeTypesSaved: "تم الحفظ. يمكن لمخطِّط الرحلات الآن اقتراح هذا المكان في هذه الخطوات.",
    group_food: "طعام وشراب",
    group_stay: "أماكن الإقامة",
    group_nature: "طبيعة",
    group_heritage: "تراث وثقافة",
    group_entertainment: "ترفيه",
    group_sport: "رياضة ومغامرة",
    group_wellness: "عافية واسترخاء",
    group_shopping: "تسوّق",
    group_family: "للعائلة",
    group_events: "فعاليات",
    group_essentials: "خدمات أساسية",
    placeTypesRemove: "أزل {name}",
    typicalSpend: "متوسط إنفاق الشخص (بالدولار)",
    typicalSpendHint:
      "ما ينفقه الشخص عادةً على وجبة هنا. يسعّر مخطِّط الرحلات الوجبات به؛ ومن دونه تظهر الوجبة «السعر عند الطلب».",
    factsTitle: "ما يمكن للمسافرين الاعتماد عليه",
    factsBody:
      "يفلتر المسافرون يومهم على هذه المعلومات. أجب فقط عمّا أنت متأكد منه: «لست متأكدًا» أفضل من التخمين، و«لا» تُبعد من لا يناسبه المكان.",
    factsStale: "مرّ أكثر من عام على هذه الإجابات، لذا لم يعد المخطِّط يستخدمها. راجعها واحفظها لتأكيدها.",
    factsCheckedOn: "آخر تأكيد {date}",
    factsUnknown: "لست متأكدًا",
    factsYes: "نعم",
    factsNo: "لا",
    factsFood: "الطعام والشراب",
    factsAccess: "سهولة الوصول والعائلات",
    factsPayment: "الدفع",
    fact_halal: "حلال",
    fact_vegetarian: "أطباق نباتية",
    fact_vegan: "أطباق نباتية صرفة",
    fact_gluten_free: "أطباق خالية من الغلوتين",
    fact_serves_alcohol: "يقدّم الكحول",
    fact_outdoor_seating: "جلسات خارجية",
    fact_wheelchair_access: "مناسب للكراسي المتحركة",
    fact_step_free: "مدخل بلا درج",
    fact_accessible_toilet: "حمّام مجهّز لذوي الإعاقة",
    fact_parking: "موقف سيارات",
    fact_kids_friendly: "مناسب للأطفال",
    fact_stroller_friendly: "مناسب لعربات الأطفال",
    fact_accepts_card: "يقبل البطاقات",
    fact_accepts_usd_cash: "نقدًا بالدولار",
    fact_accepts_lbp_cash: "نقدًا بالليرة اللبنانية",
    factsViews: "الإطلالات",
    view_sea: "البحر",
    view_mountain: "الجبل",
    view_city: "المدينة",
    view_valley: "الوادي",
    view_sunset: "الغروب",
    factsMinAge: "الحد الأدنى للعمر",
    factsLanguages: "اللغات المحكية",
    factsLanguagesHint: "افصل بينها بفواصل، مثل: العربية، الإنجليزية، الفرنسية.",
    factsDressCode: "قواعد اللباس",
    factsSave: "حفظ المعلومات",
    factsSaved: "تم الحفظ. يمكن الآن للمسافرين الذين يحتاجون هذه المعلومات إيجاد هذا المكان.",
  },
  fr: {
    detailsTitle: "Restaurant ou hébergement",
    detailsBody:
      "Ajoutez votre licence touristique pour que les voyageurs voient qu’elle a été vérifiée. Notre équipe la confirme auprès de l’émetteur avant d’afficher le badge.",
    kindLabel: "Cette fiche est",
    kind_experience: "Une expérience",
    kind_attraction: "Un lieu à visiter",
    kind_restaurant: "Un restaurant",
    kind_hotel: "Un hébergement",
    licenceNumber: "Numéro de licence",
    licenceAuthority: "Délivrée par",
    licenceExpires: "Expiration de la licence",
    licenceNote: "Modifier le numéro retire la vérification jusqu’à nouvelle confirmation.",
    cuisines: "Cuisines (séparées par des virgules)",
    priceLevel: "Niveau de prix",
    priceAny: "Non précisé",
    reservationPhone: "Téléphone de réservation",
    reservationWhatsapp: "Numéro WhatsApp",
    reservationUrl: "Lien de réservation (https)",
    stayType: "Type d’hébergement",
    stay_hotel: "Hôtel",
    stay_guesthouse: "Maison d’hôtes",
    stay_hostel: "Auberge",
    stay_apartment: "Appartement",
    stars: "Étoiles (classement officiel)",
    rooms: "Chambres",
    checkIn: "Arrivée à partir de",
    checkOut: "Départ avant",
    priceFrom: "Prix par nuit à partir de (USD)",
    bookingUrl: "Lien de réservation (https)",
    acceptsRequests: "Les voyageurs peuvent demander un séjour via Mshwar",
    amenities: "Équipements (séparés par des virgules)",
    accessibility: "Accessibilité (séparée par des virgules)",
    save: "Enregistrer",
    saved: "Enregistré.",
    checkedStatus: "Vérifié le {date} ; à revérifier avant le {due}",
    notChecked: "Pas encore vérifié. Dès que votre numéro de licence est saisi, notre équipe le vérifie.",
    loadError: "Chargement impossible. Réessayez.",
    claimsTitle: "Revendiquer un lieu référencé par Mshwar",
    claimsBody:
      "Si notre équipe a référencé votre restaurant ou hébergement, revendiquez-le pour le gérer ici. Nous vérifions votre licence avant.",
    findPlace: "Cherchez votre lieu par son nom",
    chosen: "Choisi : {place}",
    change: "Changer",
    claimNote: "Comment confirmer qu’il est à vous (licence, votre rôle)",
    sendClaim: "Envoyer",
    claimSent: "Demande envoyée. Nous la vérifions et vous tenons informé.",
    yourClaims: "Vos revendications",
    claim_pending: "En attente",
    claim_approved: "Approuvée",
    claim_rejected: "Refusée",
    noClaims: "Aucune revendication.",
    noOrg: "Choisissez d’abord un établissement.",
    placeTypesTitle: "Quel type de lieu est-ce ?",
    placeTypesBody:
      "Les voyageurs planifient leur journée étape par étape – « petit-déjeuner dans une pâtisserie, puis bowling ». Indiquez ce qu’est votre lieu pour que le planificateur le propose à la bonne étape.",
    placeTypesHint: "Choisissez jusqu’à six types. Le premier choisi est le type principal.",
    placeTypesMain: "Principal",
    placeTypesChosen: "Choisis",
    placeTypesNone: "Choisissez au moins un type de lieu.",
    placeTypesFull: "Vous en avez choisi six. Retirez-en un pour en choisir un autre.",
    mealServices: "Repas servis",
    meal_breakfast: "Petit-déjeuner",
    meal_brunch: "Brunch",
    meal_lunch: "Déjeuner",
    meal_dinner: "Dîner",
    meal_late: "Tard le soir",
    scheduleNote: "Note sur les horaires",
    scheduleNoteHint:
      "Les horaires changent (films, spectacles) ? Indiquez comment les vérifier – nous n’affichons jamais un horaire que nous n’avons pas.",
    placeTypesSave: "Enregistrer les types de lieu",
    placeTypesSaved: "Enregistré. Le planificateur peut désormais proposer ce lieu pour ces étapes.",
    group_food: "Manger et boire",
    group_stay: "Hébergements",
    group_nature: "Nature",
    group_heritage: "Patrimoine et culture",
    group_entertainment: "Divertissement",
    group_sport: "Sport et aventure",
    group_wellness: "Bien-être",
    group_shopping: "Shopping",
    group_family: "Famille",
    group_events: "Événements",
    group_essentials: "Services essentiels",
    placeTypesRemove: "Retirer {name}",
    typicalSpend: "Dépense habituelle par personne (USD)",
    typicalSpendHint:
      "Ce qu’une personne dépense habituellement pour un repas ici. Le planificateur s’en sert pour chiffrer les repas ; sans elle, le repas affiche « prix sur demande ».",
    factsTitle: "Ce que les voyageurs peuvent attendre",
    factsBody:
      "Les voyageurs filtrent leur journée selon ces informations. Ne répondez que si vous êtes sûr : « Je ne sais pas » vaut mieux qu’une supposition, et un « Non » évite les mauvaises surprises.",
    factsStale:
      "Ces réponses datent de plus d’un an : le planificateur ne les utilise plus. Vérifiez-les et enregistrez pour les confirmer.",
    factsCheckedOn: "Dernière confirmation le {date}",
    factsUnknown: "Je ne sais pas",
    factsYes: "Oui",
    factsNo: "Non",
    factsFood: "Nourriture et boissons",
    factsAccess: "Accès et familles",
    factsPayment: "Paiement",
    fact_halal: "Halal",
    fact_vegetarian: "Plats végétariens",
    fact_vegan: "Plats végans",
    fact_gluten_free: "Plats sans gluten",
    fact_serves_alcohol: "Sert de l’alcool",
    fact_outdoor_seating: "Places en extérieur",
    fact_wheelchair_access: "Accès fauteuil roulant",
    fact_step_free: "Entrée sans marche",
    fact_accessible_toilet: "Toilettes accessibles",
    fact_parking: "Parking",
    fact_kids_friendly: "Adapté aux enfants",
    fact_stroller_friendly: "Accessible en poussette",
    fact_accepts_card: "Cartes acceptées",
    fact_accepts_usd_cash: "Espèces en dollars",
    fact_accepts_lbp_cash: "Espèces en livres libanaises",
    factsViews: "Vues",
    view_sea: "Mer",
    view_mountain: "Montagne",
    view_city: "Ville",
    view_valley: "Vallée",
    view_sunset: "Coucher de soleil",
    factsMinAge: "Âge minimum",
    factsLanguages: "Langues parlées",
    factsLanguagesHint: "Séparez par des virgules, par ex. arabe, anglais, français.",
    factsDressCode: "Code vestimentaire",
    factsSave: "Enregistrer",
    factsSaved: "Enregistré. Les voyageurs qui en ont besoin peuvent désormais trouver ce lieu.",
  },
};

export type VenuePortalCopy = Record<VenuePortalKey, string>;

export function useVenuePortalCopy(): VenuePortalCopy {
  const { locale } = useLocale();
  return venuePortalCopy[locale];
}
