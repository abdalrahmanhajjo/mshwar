import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/** Copy for the driver and money-changer portals. */
export type PartnerKey =
  | "driveKicker"
  | "driveTitle"
  | "driveBody"
  | "driveNeeds"
  | "driveNeed1"
  | "driveNeed2"
  | "driveNeed3"
  | "driveNeed4"
  | "exchangeKicker"
  | "exchangeTitle"
  | "exchangeBody"
  | "exchangeNeed1"
  | "exchangeNeed2"
  | "exchangeNeed3"
  | "start"
  | "nameLabel"
  | "businessName"
  | "headline"
  | "bio"
  | "languages"
  | "areas"
  | "areasHint"
  | "saveProfile"
  | "saved"
  | "step"
  | "stepSecurity"
  | "stepProfile"
  | "stepVehicles"
  | "stepDocuments"
  | "stepAgreement"
  | "stepSubmit"
  | "stepLicence"
  | "stepBranches"
  | "statusTitle"
  | "statusDraft"
  | "statusSubmitted"
  | "statusApproved"
  | "statusRejected"
  | "statusSuspended"
  | "lapsedWarning"
  | "expiringSoon"
  | "previewTitle"
  | "publicPage"
  | "addVehicle"
  | "editVehicle"
  | "plate"
  | "plateHint"
  | "plateRented"
  | "make"
  | "model"
  | "colour"
  | "year"
  | "seats"
  | "vehicleActive"
  | "saveVehicle"
  | "noVehicles"
  | "vehicleLive"
  | "vehicleNotLive"
  | "vehicleDocuments"
  | "yourDocuments"
  | "branchDocuments"
  | "agreementTitle"
  | "agreementAccept"
  | "agreementButton"
  | "agreementAccepted"
  | "agreementNew"
  | "readAgreement"
  | "hideAgreement"
  | "stillNeeded"
  | "needPhone"
  | "needTotp"
  | "needAreas"
  | "needVehicle"
  | "needAgreement"
  | "needLicence"
  | "needBranch"
  | "needDoc"
  | "submit"
  | "sending"
  | "submitted"
  | "termsTitle"
  | "dayRate"
  | "dayRateHint"
  | "airportPickups"
  | "saveTerms"
  | "inboxTitle"
  | "inboxBody"
  | "inboxNotLive"
  | "inboxEmpty"
  | "kind_ride"
  | "kind_day"
  | "kind_airport"
  | "party"
  | "luggageN"
  | "hoursN"
  | "flight"
  | "quotesSoFar"
  | "quoteVehicle"
  | "quotePrice"
  | "quoteNote"
  | "sendQuote"
  | "updateQuote"
  | "withdrawQuote"
  | "yourQuote"
  | "quoteSent"
  | "expires"
  | "ridesTitle"
  | "ridesEmpty"
  | "upcoming"
  | "past"
  | "state_confirmed"
  | "state_completed"
  | "state_cancelled_by_traveller"
  | "state_cancelled_by_driver"
  | "state_no_show"
  | "traveller"
  | "call"
  | "collect"
  | "finishDone"
  | "finishNoShow"
  | "cancelRide"
  | "cancelReason"
  | "confirmCancel"
  | "reviewTraveller"
  | "rating"
  | "reviewBody"
  | "sendReview"
  | "yourReview"
  | "theirReview"
  | "reviewBlind"
  | "report"
  | "reportKind"
  | "reportDetails"
  | "sendReport"
  | "reportSent"
  | "reportUrgent"
  | "emergency"
  | "cat_safety"
  | "cat_wrong_driver"
  | "cat_wrong_plate"
  | "cat_unsafe_vehicle"
  | "cat_overcharge"
  | "cat_no_show"
  | "cat_conduct"
  | "cat_other"
  | "licenceTitle"
  | "licenceBody"
  | "bdlNumber"
  | "category"
  | "categoryA"
  | "categoryB"
  | "legalName"
  | "saveLicence"
  | "register_unchecked"
  | "register_matched"
  | "register_missing"
  | "register_category_changed"
  | "addBranch"
  | "branchName"
  | "address"
  | "destination"
  | "phone"
  | "pin"
  | "lat"
  | "lng"
  | "hours"
  | "closed"
  | "opens"
  | "closes"
  | "saveBranch"
  | "branchVerified"
  | "branchWaiting"
  | "noBranches"
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun"
  | "ratesTitle"
  | "ratesBody"
  | "ratesNotLive"
  | "ratesPaused"
  | "buy"
  | "sell"
  | "postRates"
  | "ratesPosted"
  | "recentRates"
  | "rate_live"
  | "rate_held"
  | "rate_rejected"
  | "postedAt"
  | "spreadHint"
  | "noLiveBranches";

export const partnerCopy: Record<Locale, Record<PartnerKey, string>> = {
  en: {
    driveKicker: "Drive with Mshwar",
    driveTitle: "Drive travellers around Lebanon",
    driveBody:
      "Travellers ask for a ride, a day with a driver or an airport pickup; you send a fixed price; they pay you in the car. Only licensed red-plate drivers are listed.",
    driveNeeds: "What you need",
    driveNeed1: "A public driving licence and a red public plate",
    driveNeed2: "Your vehicle's registration, passenger insurance and inspection",
    driveNeed3: "A judicial record issued in the last three months",
    driveNeed4: "A phone and an authenticator app",
    exchangeKicker: "Money changers on Mshwar",
    exchangeTitle: "List your exchange",
    exchangeBody:
      "Travellers look for a licensed changer near them. We list institutions on Banque du Liban's list, with every branch checked. Mshwar never exchanges money.",
    exchangeNeed1: "Your BDL registration number and category (A or B)",
    exchangeNeed2: "A commercial register extract",
    exchangeNeed3: "A photo of each branch's shop front",
    start: "Start my application",
    nameLabel: "Name travellers will see",
    businessName: "Name of the exchange travellers will see",
    headline: "One line about you",
    bio: "About you",
    languages: "Languages you speak",
    areas: "Areas you drive in",
    areasHint: "Travellers asking for a ride that starts in these areas will see your price.",
    saveProfile: "Save profile",
    saved: "Saved.",
    step: "Step {n}",
    stepSecurity: "Secure your account",
    stepProfile: "Your profile",
    stepVehicles: "Your vehicles",
    stepDocuments: "Documents",
    stepAgreement: "Agreement",
    stepSubmit: "Send for review",
    stepLicence: "Your BDL licence",
    stepBranches: "Your branches",
    statusTitle: "Your application",
    statusDraft: "Finish each step, then send it to our reviewers.",
    statusSubmitted:
      "With our reviewers. We check every document with its issuer and will arrange a short video call. We aim to answer within 48 hours.",
    statusApproved: "You are approved. Travellers see you while every document is in date.",
    statusRejected: "Our reviewers asked for changes: {reason}",
    statusSuspended: "Your account is suspended: {reason}",
    lapsedWarning: "A document has run out, so travellers cannot see you. Upload the new one below.",
    expiringSoon: "{doc} runs out on {date}. Upload the new one before then.",
    previewTitle: "What travellers see",
    publicPage: "Open my public page",
    addVehicle: "Add a vehicle",
    editVehicle: "Edit",
    plate: "Red public plate",
    plateHint: "As on the plate, for example P 123456.",
    plateRented: "I rent this red plate",
    make: "Make",
    model: "Model",
    colour: "Colour",
    year: "Year",
    seats: "Passenger seats",
    vehicleActive: "In use",
    saveVehicle: "Save vehicle",
    noVehicles: "Add the vehicle you drive, with its red plate.",
    vehicleLive: "Verified",
    vehicleNotLive: "Documents to check",
    vehicleDocuments: "Documents for {plate}",
    yourDocuments: "Your documents",
    branchDocuments: "Shop front for {branch}",
    agreementTitle: "Read and accept the agreement",
    agreementAccept: "I have read and accept the agreement and code of conduct",
    agreementButton: "Accept",
    agreementAccepted: "Accepted (version {version}).",
    agreementNew: "There is a new version to accept.",
    readAgreement: "Read the agreement",
    hideAgreement: "Hide the agreement",
    stillNeeded: "Still needed",
    needPhone: "Verify your phone",
    needTotp: "Turn on the authenticator app",
    needAreas: "Choose the areas you drive in",
    needVehicle: "Add your vehicle",
    needAgreement: "Accept the agreement",
    needLicence: "Add your BDL licence",
    needBranch: "Add a branch",
    needDoc: "Upload: {doc}",
    submit: "Send for review",
    sending: "Sending…",
    submitted: "Sent. We will be in touch.",
    termsTitle: "Day hire and airport pickups",
    dayRate: "Day rate (USD)",
    dayRateHint: "Shown on your page as a guide. Every request still gets its own fixed price.",
    airportPickups: "I do airport pickups",
    saveTerms: "Save",
    inboxTitle: "Ride requests",
    inboxBody:
      "Open requests in your areas that one of your verified vehicles can take. Send a fixed price; the traveller chooses.",
    inboxNotLive: "Requests appear here once your account is approved and every document is in date.",
    inboxEmpty: "No open requests in your areas right now.",
    kind_ride: "Ride",
    kind_day: "Day with a driver",
    kind_airport: "Airport pickup",
    party: "{n} people",
    luggageN: "{n} bags",
    hoursN: "{n} hours",
    flight: "Flight {flight}",
    quotesSoFar: "{n} prices sent so far",
    quoteVehicle: "Vehicle",
    quotePrice: "Your fixed price (USD)",
    quoteNote: "Note for the traveller",
    sendQuote: "Send price",
    updateQuote: "Update price",
    withdrawQuote: "Withdraw",
    yourQuote: "Your price: {price}",
    quoteSent: "Price sent. The traveller will see it with your checks.",
    expires: "Open until {time}",
    ridesTitle: "My rides",
    ridesEmpty: "No booked rides yet.",
    upcoming: "Coming up",
    past: "Past",
    state_confirmed: "Booked",
    state_completed: "Done",
    state_cancelled_by_traveller: "Cancelled by the traveller",
    state_cancelled_by_driver: "Cancelled by you",
    state_no_show: "Traveller did not come",
    traveller: "Traveller: {name}",
    call: "Call {phone}",
    collect: "Collect {price} in the car",
    finishDone: "Mark done",
    finishNoShow: "Traveller did not come",
    cancelRide: "Cancel ride",
    cancelReason: "Why you must cancel (the traveller sees this)",
    confirmCancel: "Cancel the ride",
    reviewTraveller: "Review the traveller",
    rating: "Rating",
    reviewBody: "A few words (optional)",
    sendReview: "Send review",
    yourReview: "Your review: {n}/5",
    theirReview: "Their review of you: {n}/5",
    reviewBlind: "Their review shows once you have both written, or after 14 days.",
    report: "Report a problem",
    reportKind: "Kind of problem",
    reportDetails: "What happened",
    sendReport: "Send report",
    reportSent: "Thank you. Our team will look at it.",
    reportUrgent: "This reached a person on our team straight away.",
    emergency: "In an emergency call 112 (police), 140 (Red Cross) or 125 (civil defence) first.",
    cat_safety: "Safety",
    cat_wrong_driver: "A different driver came",
    cat_wrong_plate: "The plate did not match",
    cat_unsafe_vehicle: "Unsafe vehicle",
    cat_overcharge: "Asked for more than the price",
    cat_no_show: "No-show",
    cat_conduct: "Behaviour",
    cat_other: "Something else",
    licenceTitle: "Banque du Liban registration",
    licenceBody:
      "As it appears on BDL's list of registered exchange institutions. We match it against the list BDL publishes, every month.",
    bdlNumber: "Registration number",
    category: "Category",
    categoryA: "Category A",
    categoryB: "Category B",
    legalName: "Legal name as registered",
    saveLicence: "Save registration",
    register_unchecked: "Not matched against the BDL list yet.",
    register_matched: "On BDL's list (checked {date}).",
    register_missing: "Not on BDL's latest list, so travellers cannot see you. Contact us.",
    register_category_changed: "BDL's list shows another category. Correct it or contact us.",
    addBranch: "Add a branch",
    branchName: "Branch name",
    address: "Address",
    destination: "Destination",
    phone: "Branch phone",
    pin: "Pin on the map",
    lat: "Latitude",
    lng: "Longitude",
    hours: "Opening hours",
    closed: "Closed",
    opens: "Opens",
    closes: "Closes",
    saveBranch: "Save branch",
    branchVerified: "Checked",
    branchWaiting: "Waiting for our visit",
    noBranches: "Add the branch travellers will come to.",
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
    ratesTitle: "Today’s rates",
    ratesBody:
      "Your rate shows as posted by you, with the time, and travellers are told to confirm it at the counter. It disappears after 12 hours. A rate far from other verified changers' is held for review.",
    ratesNotLive: "Rates can be posted once the branch is checked and your account is approved.",
    ratesPaused: "Rate posting is paused until {date} after upheld reports.",
    buy: "We buy 1 {base} for (LBP)",
    sell: "We sell 1 {base} for (LBP)",
    postRates: "Post rates",
    ratesPosted: "Posted.",
    recentRates: "Recently posted",
    rate_live: "Showing",
    rate_held: "Held for review",
    rate_rejected: "Not shown",
    postedAt: "Posted {time}",
    spreadHint: "Buy must be no higher than sell, and within 10% of it.",
    noLiveBranches: "No branch is live yet.",
  },
  ar: {
    driveKicker: "قُد مع مشوار",
    driveTitle: "انقل المسافرين في أنحاء لبنان",
    driveBody:
      "يطلب المسافرون رحلة أو يومًا مع سائق أو استقبالًا من المطار؛ ترسل سعرًا ثابتًا؛ ويدفعون لك في السيارة. لا يُدرج إلا السائقون المرخّصون ذوو اللوحات الحمراء.",
    driveNeeds: "ما تحتاج إليه",
    driveNeed1: "رخصة سوق عمومية ولوحة عمومية حمراء",
    driveNeed2: "دفتر تسجيل المركبة وتأمين الركّاب والمعاينة",
    driveNeed3: "سجل عدلي صادر خلال الأشهر الثلاثة الأخيرة",
    driveNeed4: "هاتف وتطبيق مصادقة",
    exchangeKicker: "الصرّافون على مشوار",
    exchangeTitle: "أدرج مكتب الصرافة",
    exchangeBody:
      "يبحث المسافرون عن صرّاف مرخّص قريب منهم. ندرج المؤسسات الموجودة على لائحة مصرف لبنان، مع التحقّق من كل فرع. لا يصرف مشوار العملات أبدًا.",
    exchangeNeed1: "رقم تسجيلك لدى مصرف لبنان وفئتك (أ أو ب)",
    exchangeNeed2: "إفادة السجل التجاري",
    exchangeNeed3: "صورة لواجهة كل فرع",
    start: "ابدأ طلبي",
    nameLabel: "الاسم الذي يراه المسافرون",
    businessName: "اسم مكتب الصرافة الذي يراه المسافرون",
    headline: "سطر واحد عنك",
    bio: "نبذة عنك",
    languages: "اللغات التي تتحدّثها",
    areas: "المناطق التي تعمل فيها",
    areasHint: "سيرى سعرك المسافرون الذين يطلبون رحلة تبدأ في هذه المناطق.",
    saveProfile: "احفظ الملف",
    saved: "تم الحفظ.",
    step: "الخطوة {n}",
    stepSecurity: "أمّن حسابك",
    stepProfile: "ملفّك",
    stepVehicles: "مركباتك",
    stepDocuments: "المستندات",
    stepAgreement: "الاتفاقية",
    stepSubmit: "أرسل للمراجعة",
    stepLicence: "ترخيصك لدى مصرف لبنان",
    stepBranches: "فروعك",
    statusTitle: "طلبك",
    statusDraft: "أكمل كل خطوة ثم أرسله إلى المراجعين.",
    statusSubmitted:
      "لدى المراجعين. نتحقّق من كل مستند لدى الجهة المُصدِرة وسنرتّب مكالمة فيديو قصيرة. نسعى إلى الردّ خلال 48 ساعة.",
    statusApproved: "تمت الموافقة عليك. يراك المسافرون ما دامت كل مستنداتك سارية.",
    statusRejected: "طلب المراجعون تعديلات: {reason}",
    statusSuspended: "حسابك موقوف: {reason}",
    lapsedWarning: "انتهت صلاحية مستند، لذلك لا يراك المسافرون. ارفع المستند الجديد أدناه.",
    expiringSoon: "تنتهي صلاحية {doc} في {date}. ارفع الجديد قبل ذلك.",
    previewTitle: "ما يراه المسافرون",
    publicPage: "افتح صفحتي العامة",
    addVehicle: "أضِف مركبة",
    editVehicle: "تعديل",
    plate: "اللوحة العمومية الحمراء",
    plateHint: "كما على اللوحة، مثل P 123456.",
    plateRented: "أستأجر هذه اللوحة الحمراء",
    make: "الصنع",
    model: "الطراز",
    colour: "اللون",
    year: "السنة",
    seats: "مقاعد الركّاب",
    vehicleActive: "قيد الاستخدام",
    saveVehicle: "احفظ المركبة",
    noVehicles: "أضِف المركبة التي تقودها مع لوحتها الحمراء.",
    vehicleLive: "موثّقة",
    vehicleNotLive: "مستندات قيد التحقّق",
    vehicleDocuments: "مستندات {plate}",
    yourDocuments: "مستنداتك",
    branchDocuments: "واجهة {branch}",
    agreementTitle: "اقرأ الاتفاقية ووافق عليها",
    agreementAccept: "قرأت الاتفاقية وقواعد السلوك وأوافق عليها",
    agreementButton: "أوافق",
    agreementAccepted: "تمت الموافقة (النسخة {version}).",
    agreementNew: "توجد نسخة جديدة للموافقة عليها.",
    readAgreement: "اقرأ الاتفاقية",
    hideAgreement: "أخفِ الاتفاقية",
    stillNeeded: "ما زال مطلوبًا",
    needPhone: "تحقّق من هاتفك",
    needTotp: "فعّل تطبيق المصادقة",
    needAreas: "اختر المناطق التي تعمل فيها",
    needVehicle: "أضِف مركبتك",
    needAgreement: "وافق على الاتفاقية",
    needLicence: "أضِف ترخيصك لدى مصرف لبنان",
    needBranch: "أضِف فرعًا",
    needDoc: "ارفع: {doc}",
    submit: "أرسل للمراجعة",
    sending: "جارٍ الإرسال…",
    submitted: "تم الإرسال. سنتواصل معك.",
    termsTitle: "التأجير اليومي واستقبال المطار",
    dayRate: "أجر اليوم (دولار)",
    dayRateHint: "يظهر على صفحتك كمؤشر. يبقى لكل طلب سعره الثابت.",
    airportPickups: "أقوم بالاستقبال من المطار",
    saveTerms: "حفظ",
    inboxTitle: "طلبات الرحلات",
    inboxBody: "طلبات مفتوحة في مناطقك يمكن لإحدى مركباتك الموثّقة تلبيتها. أرسل سعرًا ثابتًا؛ والمسافر يختار.",
    inboxNotLive: "تظهر الطلبات هنا بعد الموافقة على حسابك وسريان كل مستنداتك.",
    inboxEmpty: "لا طلبات مفتوحة في مناطقك الآن.",
    kind_ride: "رحلة",
    kind_day: "يوم مع سائق",
    kind_airport: "استقبال من المطار",
    party: "{n} أشخاص",
    luggageN: "{n} حقائب",
    hoursN: "{n} ساعات",
    flight: "الرحلة {flight}",
    quotesSoFar: "{n} أسعار أُرسلت حتى الآن",
    quoteVehicle: "المركبة",
    quotePrice: "سعرك الثابت (دولار)",
    quoteNote: "ملاحظة للمسافر",
    sendQuote: "أرسل السعر",
    updateQuote: "حدّث السعر",
    withdrawQuote: "اسحب",
    yourQuote: "سعرك: {price}",
    quoteSent: "أُرسل السعر. سيراه المسافر مع ما تم التحقّق منه.",
    expires: "مفتوح حتى {time}",
    ridesTitle: "رحلاتي",
    ridesEmpty: "لا رحلات محجوزة بعد.",
    upcoming: "القادمة",
    past: "السابقة",
    state_confirmed: "محجوزة",
    state_completed: "منتهية",
    state_cancelled_by_traveller: "ألغاها المسافر",
    state_cancelled_by_driver: "ألغيتها",
    state_no_show: "لم يحضر المسافر",
    traveller: "المسافر: {name}",
    call: "اتصل بـ {phone}",
    collect: "استلم {price} في السيارة",
    finishDone: "سجّلها منتهية",
    finishNoShow: "لم يحضر المسافر",
    cancelRide: "ألغِ الرحلة",
    cancelReason: "سبب الإلغاء (يراه المسافر)",
    confirmCancel: "ألغِ الرحلة",
    reviewTraveller: "قيّم المسافر",
    rating: "التقييم",
    reviewBody: "بضع كلمات (اختياري)",
    sendReview: "أرسل التقييم",
    yourReview: "تقييمك: {n}/5",
    theirReview: "تقييمه لك: {n}/5",
    reviewBlind: "يظهر تقييمه بعد أن يكتب كلاكما، أو بعد 14 يومًا.",
    report: "أبلغ عن مشكلة",
    reportKind: "نوع المشكلة",
    reportDetails: "ماذا حدث",
    sendReport: "أرسل البلاغ",
    reportSent: "شكرًا. سيطّلع فريقنا عليه.",
    reportUrgent: "وصل هذا إلى شخص في فريقنا فورًا.",
    emergency: "في حالة الطوارئ اتصل أولًا بـ 112 (الشرطة) أو 140 (الصليب الأحمر) أو 125 (الدفاع المدني).",
    cat_safety: "السلامة",
    cat_wrong_driver: "حضر سائق آخر",
    cat_wrong_plate: "اللوحة غير مطابقة",
    cat_unsafe_vehicle: "مركبة غير آمنة",
    cat_overcharge: "طُلب أكثر من السعر",
    cat_no_show: "عدم حضور",
    cat_conduct: "السلوك",
    cat_other: "أمر آخر",
    licenceTitle: "التسجيل لدى مصرف لبنان",
    licenceBody:
      "كما يظهر في لائحة مؤسسات الصرافة المسجّلة لدى مصرف لبنان. نطابقه مع اللائحة التي ينشرها المصرف كل شهر.",
    bdlNumber: "رقم التسجيل",
    category: "الفئة",
    categoryA: "الفئة أ",
    categoryB: "الفئة ب",
    legalName: "الاسم القانوني كما هو مسجّل",
    saveLicence: "احفظ التسجيل",
    register_unchecked: "لم تتم المطابقة مع لائحة مصرف لبنان بعد.",
    register_matched: "مدرج على لائحة مصرف لبنان (تحقّق في {date}).",
    register_missing: "غير مدرج على أحدث لائحة لمصرف لبنان، لذلك لا يراك المسافرون. تواصل معنا.",
    register_category_changed: "تُظهر لائحة مصرف لبنان فئة أخرى. صحّحها أو تواصل معنا.",
    addBranch: "أضِف فرعًا",
    branchName: "اسم الفرع",
    address: "العنوان",
    destination: "الوجهة",
    phone: "هاتف الفرع",
    pin: "الموقع على الخريطة",
    lat: "خط العرض",
    lng: "خط الطول",
    hours: "ساعات العمل",
    closed: "مغلق",
    opens: "يفتح",
    closes: "يغلق",
    saveBranch: "احفظ الفرع",
    branchVerified: "تم التحقّق",
    branchWaiting: "بانتظار زيارتنا",
    noBranches: "أضِف الفرع الذي سيقصده المسافرون.",
    mon: "الاثنين",
    tue: "الثلاثاء",
    wed: "الأربعاء",
    thu: "الخميس",
    fri: "الجمعة",
    sat: "السبت",
    sun: "الأحد",
    ratesTitle: "أسعار اليوم",
    ratesBody:
      "يظهر سعرك على أنه منشور منك مع الوقت، ويُنصح المسافرون بتأكيده عند الشبّاك. يختفي بعد 12 ساعة. السعر البعيد عن أسعار الصرّافين الموثّقين الآخرين يُعلَّق للمراجعة.",
    ratesNotLive: "يمكن نشر الأسعار بعد التحقّق من الفرع والموافقة على حسابك.",
    ratesPaused: "نشر الأسعار موقوف حتى {date} بعد بلاغات مثبتة.",
    buy: "نشتري 1 {base} مقابل (ل.ل.)",
    sell: "نبيع 1 {base} مقابل (ل.ل.)",
    postRates: "انشر الأسعار",
    ratesPosted: "تم النشر.",
    recentRates: "المنشور مؤخرًا",
    rate_live: "ظاهر",
    rate_held: "معلّق للمراجعة",
    rate_rejected: "غير ظاهر",
    postedAt: "نُشر {time}",
    spreadHint: "يجب ألا يتجاوز سعر الشراء سعر المبيع، وأن يكون ضمن 10% منه.",
    noLiveBranches: "لا فرع ظاهر بعد.",
  },
  fr: {
    driveKicker: "Conduire avec Mshwar",
    driveTitle: "Conduisez des voyageurs à travers le Liban",
    driveBody:
      "Les voyageurs demandent une course, une journée avec chauffeur ou un transfert aéroport ; vous envoyez un prix fixe ; ils vous paient dans la voiture. Seuls les chauffeurs à plaque rouge sont référencés.",
    driveNeeds: "Ce qu’il vous faut",
    driveNeed1: "Un permis public et une plaque publique rouge",
    driveNeed2: "Carte grise, assurance passagers et contrôle technique",
    driveNeed3: "Un casier judiciaire de moins de trois mois",
    driveNeed4: "Un téléphone et une application d’authentification",
    exchangeKicker: "Les changeurs sur Mshwar",
    exchangeTitle: "Référencez votre bureau de change",
    exchangeBody:
      "Les voyageurs cherchent un changeur agréé près d’eux. Nous référençons les établissements de la liste de la Banque du Liban, chaque agence vérifiée. Mshwar ne change jamais d’argent.",
    exchangeNeed1: "Votre numéro d’enregistrement BDL et votre catégorie (A ou B)",
    exchangeNeed2: "Un extrait du registre du commerce",
    exchangeNeed3: "Une photo de la devanture de chaque agence",
    start: "Commencer ma candidature",
    nameLabel: "Nom affiché aux voyageurs",
    businessName: "Nom du bureau affiché aux voyageurs",
    headline: "Une ligne sur vous",
    bio: "À propos de vous",
    languages: "Langues parlées",
    areas: "Zones où vous conduisez",
    areasHint: "Les voyageurs dont la course part de ces zones verront votre prix.",
    saveProfile: "Enregistrer le profil",
    saved: "Enregistré.",
    step: "Étape {n}",
    stepSecurity: "Sécurisez votre compte",
    stepProfile: "Votre profil",
    stepVehicles: "Vos véhicules",
    stepDocuments: "Documents",
    stepAgreement: "Accord",
    stepSubmit: "Envoyer pour vérification",
    stepLicence: "Votre licence BDL",
    stepBranches: "Vos agences",
    statusTitle: "Votre candidature",
    statusDraft: "Terminez chaque étape puis envoyez-la à nos relecteurs.",
    statusSubmitted:
      "Chez nos relecteurs. Nous vérifions chaque document auprès de l’émetteur et organiserons un court appel vidéo. Réponse visée sous 48 heures.",
    statusApproved: "Vous êtes approuvé. Les voyageurs vous voient tant que vos documents sont valides.",
    statusRejected: "Nos relecteurs demandent des corrections : {reason}",
    statusSuspended: "Votre compte est suspendu : {reason}",
    lapsedWarning: "Un document a expiré : les voyageurs ne vous voient plus. Envoyez le nouveau ci-dessous.",
    expiringSoon: "{doc} expire le {date}. Envoyez le nouveau avant.",
    previewTitle: "Ce que voient les voyageurs",
    publicPage: "Ouvrir ma page publique",
    addVehicle: "Ajouter un véhicule",
    editVehicle: "Modifier",
    plate: "Plaque publique rouge",
    plateHint: "Comme sur la plaque, par exemple P 123456.",
    plateRented: "Je loue cette plaque rouge",
    make: "Marque",
    model: "Modèle",
    colour: "Couleur",
    year: "Année",
    seats: "Places passagers",
    vehicleActive: "En service",
    saveVehicle: "Enregistrer le véhicule",
    noVehicles: "Ajoutez le véhicule que vous conduisez, avec sa plaque rouge.",
    vehicleLive: "Vérifié",
    vehicleNotLive: "Documents à vérifier",
    vehicleDocuments: "Documents pour {plate}",
    yourDocuments: "Vos documents",
    branchDocuments: "Devanture de {branch}",
    agreementTitle: "Lisez et acceptez l’accord",
    agreementAccept: "J’ai lu et j’accepte l’accord et le code de conduite",
    agreementButton: "Accepter",
    agreementAccepted: "Accepté (version {version}).",
    agreementNew: "Une nouvelle version est à accepter.",
    readAgreement: "Lire l’accord",
    hideAgreement: "Masquer l’accord",
    stillNeeded: "Il manque encore",
    needPhone: "Vérifier votre téléphone",
    needTotp: "Activer l’application d’authentification",
    needAreas: "Choisir vos zones",
    needVehicle: "Ajouter votre véhicule",
    needAgreement: "Accepter l’accord",
    needLicence: "Ajouter votre licence BDL",
    needBranch: "Ajouter une agence",
    needDoc: "Envoyer : {doc}",
    submit: "Envoyer pour vérification",
    sending: "Envoi…",
    submitted: "Envoyé. Nous revenons vers vous.",
    termsTitle: "Journée et aéroport",
    dayRate: "Tarif journée (USD)",
    dayRateHint: "Affiché à titre indicatif. Chaque demande reçoit son prix fixe.",
    airportPickups: "Je fais les transferts aéroport",
    saveTerms: "Enregistrer",
    inboxTitle: "Demandes de course",
    inboxBody:
      "Demandes ouvertes dans vos zones qu’un de vos véhicules vérifiés peut prendre. Envoyez un prix fixe ; le voyageur choisit.",
    inboxNotLive: "Les demandes apparaissent ici une fois votre compte approuvé et vos documents valides.",
    inboxEmpty: "Aucune demande ouverte dans vos zones pour l’instant.",
    kind_ride: "Course",
    kind_day: "Journée avec chauffeur",
    kind_airport: "Transfert aéroport",
    party: "{n} personnes",
    luggageN: "{n} bagages",
    hoursN: "{n} heures",
    flight: "Vol {flight}",
    quotesSoFar: "{n} prix envoyés",
    quoteVehicle: "Véhicule",
    quotePrice: "Votre prix fixe (USD)",
    quoteNote: "Note pour le voyageur",
    sendQuote: "Envoyer le prix",
    updateQuote: "Modifier le prix",
    withdrawQuote: "Retirer",
    yourQuote: "Votre prix : {price}",
    quoteSent: "Prix envoyé. Le voyageur le verra avec vos vérifications.",
    expires: "Ouvert jusqu’à {time}",
    ridesTitle: "Mes courses",
    ridesEmpty: "Aucune course réservée pour l’instant.",
    upcoming: "À venir",
    past: "Passées",
    state_confirmed: "Réservée",
    state_completed: "Terminée",
    state_cancelled_by_traveller: "Annulée par le voyageur",
    state_cancelled_by_driver: "Annulée par vous",
    state_no_show: "Voyageur absent",
    traveller: "Voyageur : {name}",
    call: "Appeler {phone}",
    collect: "Encaissez {price} dans la voiture",
    finishDone: "Marquer terminée",
    finishNoShow: "Voyageur absent",
    cancelRide: "Annuler la course",
    cancelReason: "Pourquoi vous annulez (le voyageur le voit)",
    confirmCancel: "Annuler la course",
    reviewTraveller: "Noter le voyageur",
    rating: "Note",
    reviewBody: "Quelques mots (facultatif)",
    sendReview: "Envoyer l’avis",
    yourReview: "Votre avis : {n}/5",
    theirReview: "Son avis sur vous : {n}/5",
    reviewBlind: "Son avis apparaît quand vous avez tous deux écrit, ou après 14 jours.",
    report: "Signaler un problème",
    reportKind: "Type de problème",
    reportDetails: "Ce qui s’est passé",
    sendReport: "Envoyer le signalement",
    reportSent: "Merci. Notre équipe va l’examiner.",
    reportUrgent: "Ce signalement est parvenu immédiatement à une personne.",
    emergency: "En cas d’urgence, appelez d’abord le 112 (police), le 140 (Croix-Rouge) ou le 125 (défense civile).",
    cat_safety: "Sécurité",
    cat_wrong_driver: "Un autre chauffeur est venu",
    cat_wrong_plate: "La plaque ne correspondait pas",
    cat_unsafe_vehicle: "Véhicule dangereux",
    cat_overcharge: "Prix demandé supérieur",
    cat_no_show: "Absence",
    cat_conduct: "Comportement",
    cat_other: "Autre chose",
    licenceTitle: "Enregistrement Banque du Liban",
    licenceBody:
      "Tel qu’il figure sur la liste BDL des établissements de change. Nous le comparons chaque mois à la liste publiée.",
    bdlNumber: "Numéro d’enregistrement",
    category: "Catégorie",
    categoryA: "Catégorie A",
    categoryB: "Catégorie B",
    legalName: "Raison sociale enregistrée",
    saveLicence: "Enregistrer",
    register_unchecked: "Pas encore comparé à la liste BDL.",
    register_matched: "Sur la liste BDL (vérifié le {date}).",
    register_missing: "Absent de la dernière liste BDL : les voyageurs ne vous voient plus. Contactez-nous.",
    register_category_changed: "La liste BDL indique une autre catégorie. Corrigez-la ou contactez-nous.",
    addBranch: "Ajouter une agence",
    branchName: "Nom de l’agence",
    address: "Adresse",
    destination: "Destination",
    phone: "Téléphone de l’agence",
    pin: "Repère sur la carte",
    lat: "Latitude",
    lng: "Longitude",
    hours: "Horaires",
    closed: "Fermé",
    opens: "Ouvre",
    closes: "Ferme",
    saveBranch: "Enregistrer l’agence",
    branchVerified: "Vérifiée",
    branchWaiting: "En attente de notre visite",
    noBranches: "Ajoutez l’agence où viendront les voyageurs.",
    mon: "Lundi",
    tue: "Mardi",
    wed: "Mercredi",
    thu: "Jeudi",
    fri: "Vendredi",
    sat: "Samedi",
    sun: "Dimanche",
    ratesTitle: "Taux du jour",
    ratesBody:
      "Votre taux apparaît comme publié par vous, avec l’heure, et les voyageurs sont invités à le confirmer au guichet. Il disparaît après 12 heures. Un taux très éloigné de ceux des autres est retenu pour vérification.",
    ratesNotLive: "Les taux peuvent être publiés une fois l’agence vérifiée et votre compte approuvé.",
    ratesPaused: "Publication suspendue jusqu’au {date} après des signalements confirmés.",
    buy: "Nous achetons 1 {base} pour (LBP)",
    sell: "Nous vendons 1 {base} pour (LBP)",
    postRates: "Publier les taux",
    ratesPosted: "Publié.",
    recentRates: "Publiés récemment",
    rate_live: "Affiché",
    rate_held: "Retenu",
    rate_rejected: "Non affiché",
    postedAt: "Publié {time}",
    spreadHint: "L’achat ne doit pas dépasser la vente, et rester à moins de 10 %.",
    noLiveBranches: "Aucune agence active pour l’instant.",
  },
};

export type PartnerCopy = Record<PartnerKey, string>;

export function usePartnerCopy(): PartnerCopy {
  const { locale } = useLocale();
  return partnerCopy[locale];
}
