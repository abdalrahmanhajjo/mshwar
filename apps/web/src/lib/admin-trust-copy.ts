import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/** Copy for the staff screens: partner verification, transport cards, money changers, restaurants and stays. */
export type AdminTrustKey =
  | "loadError"
  | "saved"
  | "back"
  | "open"
  | "all"
  | "yes"
  | "no"
  | "unknown"
  | "remove"
  | "vqTitle"
  | "vqBody"
  | "kindLabel"
  | "kind_driver"
  | "kind_changer"
  | "statusLabel"
  | "st_submitted"
  | "st_approved"
  | "st_lapsed"
  | "st_suspended"
  | "st_rejected"
  | "st_draft"
  | "queueEmpty"
  | "waitingHours"
  | "pendingDocs"
  | "missingN"
  | "documentsTitle"
  | "openDocument"
  | "reference"
  | "issuer"
  | "issuedOn"
  | "expiresOn"
  | "forVehicle"
  | "verifyDoc"
  | "rejectDoc"
  | "rejectReason"
  | "missingTitle"
  | "checksTitle"
  | "check_video_call"
  | "check_visit"
  | "check_recheck"
  | "checkNotes"
  | "outcome_ok"
  | "outcome_concern"
  | "recordCheck"
  | "decisionTitle"
  | "decisionReason"
  | "approve"
  | "rejectApp"
  | "suspend"
  | "approveBlocked"
  | "eventsTitle"
  | "recheckTitle"
  | "recheckBody"
  | "lastMet"
  | "neverMet"
  | "securityLine"
  | "on"
  | "off"
  | "unverifiedPhone"
  | "ttTitle"
  | "ttBody"
  | "destinationLabel"
  | "anyDestination"
  | "tst_submitted"
  | "tst_published"
  | "tst_rejected"
  | "tst_retired"
  | "newCard"
  | "editCard"
  | "noCards"
  | "evidenceTitle"
  | "ev_field_check"
  | "ev_operator"
  | "ev_guide_report"
  | "ev_traveller_report"
  | "flagsTitle"
  | "submittedBy"
  | "role_staff"
  | "role_guide"
  | "fieldCheckOn"
  | "fieldCheckNote"
  | "publish"
  | "retire"
  | "replaces"
  | "scopeLabel"
  | "scope_between"
  | "scope_airport"
  | "scope_around"
  | "fromLabel"
  | "toLabel"
  | "modeLabel"
  | "lineName"
  | "pickupName"
  | "dropoffName"
  | "fareBasis"
  | "basis_person"
  | "basis_vehicle"
  | "basis_free"
  | "fareLow"
  | "fareHigh"
  | "currencyLabel"
  | "durMin"
  | "durMax"
  | "frequency"
  | "firstDep"
  | "lastDep"
  | "sundayQ"
  | "stepFreeQ"
  | "nightQ"
  | "luggageQ"
  | "tip_en"
  | "tip_ar"
  | "tip_fr"
  | "safetyNote"
  | "evidenceKind"
  | "evidenceNote"
  | "evidenceUrl"
  | "evidenceOn"
  | "addEvidence"
  | "needEvidence"
  | "saveCard"
  | "submitCard"
  | "cancel"
  | "guideTransportTitle"
  | "guideTransportBody"
  | "myCards"
  | "decisionReasonShort"
  | "exTitle"
  | "exBody"
  | "registerLatest"
  | "registerNone"
  | "registerOverdue"
  | "loadTitle"
  | "publishedOn"
  | "sourceUrl"
  | "pasteLabel"
  | "parsed"
  | "parseErrors"
  | "loadButton"
  | "diffMatched"
  | "diffMissing"
  | "diffCategory"
  | "heldTitle"
  | "heldEmpty"
  | "showRate"
  | "rejectRate"
  | "licencesTitle"
  | "licencesEmpty"
  | "branchChecked"
  | "branchNotChecked"
  | "recordBranchCheck"
  | "pausedUntil"
  | "reg_unchecked"
  | "reg_matched"
  | "reg_missing"
  | "reg_category_changed"
  | "upholdExchange"
  | "upheld"
  | "ratesPausedNow"
  | "vnTitle"
  | "vnBody"
  | "coverageTitle"
  | "colRestaurants"
  | "colStays"
  | "colTransport"
  | "colDrivers"
  | "colChangers"
  | "venuesTitle"
  | "dueOnly"
  | "kind_restaurant"
  | "kind_hotel"
  | "noVenues"
  | "notChecked"
  | "checkedUntil"
  | "runBy"
  | "levelLabel"
  | "level_licensed_claimed"
  | "level_checked_by_mshwar"
  | "checkedOnDate"
  | "venueNotes"
  | "recordVenueCheck"
  | "licenceMissing"
  | "addVisitedTitle"
  | "nameLabel"
  | "descriptionLabel"
  | "addressLabel"
  | "latLabel"
  | "lngLabel"
  | "cuisinesLabel"
  | "priceLevelLabel"
  | "phoneLabel"
  | "stayTypeLabel"
  | "starsLabel"
  | "priceFromLabel"
  | "bookingUrlLabel"
  | "amenitiesLabel"
  | "addVenue"
  | "venueAdded"
  | "claimsTitle"
  | "claimsEmpty"
  | "claimBy"
  | "approveClaim"
  | "rejectClaim"
  | "claimReason";

export const adminTrustCopy: Record<Locale, Record<AdminTrustKey, string>> = {
  en: {
    loadError: "Couldn't load. Try again.",
    saved: "Saved.",
    back: "Back",
    open: "Open",
    all: "All",
    yes: "Yes",
    no: "No",
    unknown: "Not known",
    remove: "Remove",
    vqTitle: "Driver and changer verification",
    vqBody:
      "Check every document with its issuer before you mark it verified. Approval needs every required document verified and a video call or visit.",
    kindLabel: "Kind",
    kind_driver: "Driver",
    kind_changer: "Money changer",
    statusLabel: "Status",
    st_submitted: "Waiting",
    st_approved: "Approved",
    st_lapsed: "Lapsed documents",
    st_suspended: "Suspended",
    st_rejected: "Rejected",
    st_draft: "Draft",
    queueEmpty: "Nothing here.",
    waitingHours: "Waiting {n} h",
    pendingDocs: "{n} documents to check",
    missingN: "{n} missing",
    documentsTitle: "Documents",
    openDocument: "Open document (link lasts 15 minutes)",
    reference: "Reference {ref}",
    issuer: "Issued by {issuer}",
    issuedOn: "issued {date}",
    expiresOn: "expires {date}",
    forVehicle: "Vehicle {plate}",
    verifyDoc: "Verified with the issuer",
    rejectDoc: "Reject",
    rejectReason: "Reason (the applicant sees it)",
    missingTitle: "Still missing",
    checksTitle: "Video call, visit or re-check",
    check_video_call: "Video call",
    check_visit: "Visit",
    check_recheck: "Re-check",
    checkNotes: "What you saw, in your own words",
    outcome_ok: "All fine",
    outcome_concern: "A concern",
    recordCheck: "Record",
    decisionTitle: "Decision",
    decisionReason: "Reason (needed to reject or suspend; the partner sees it)",
    approve: "Approve",
    rejectApp: "Reject",
    suspend: "Suspend",
    approveBlocked: "Approval opens once every required document is verified and someone has met them.",
    eventsTitle: "History",
    recheckTitle: "This month's re-checks",
    recheckBody: "A sample of live partners, longest since someone last met them first.",
    lastMet: "Last met {date}",
    neverMet: "Never met in person",
    securityLine: "Phone {phone} · authenticator {totp}",
    on: "on",
    off: "off",
    unverifiedPhone: "not verified",
    ttTitle: "Transport cards",
    ttBody:
      "Publish a card only after someone rode it or checked it with the operator. A card is due for a re-check 90 days after its field check.",
    destinationLabel: "Destination",
    anyDestination: "All destinations",
    tst_submitted: "Waiting",
    tst_published: "Published",
    tst_rejected: "Rejected",
    tst_retired: "Retired",
    newCard: "New card",
    editCard: "Edit",
    noCards: "No cards here.",
    evidenceTitle: "Evidence",
    ev_field_check: "Field check",
    ev_operator: "Operator",
    ev_guide_report: "Guide report",
    ev_traveller_report: "Traveller report",
    flagsTitle: "Open flags",
    submittedBy: "Sent by {role}",
    role_staff: "staff",
    role_guide: "a guide",
    fieldCheckOn: "Date of the field check",
    fieldCheckNote: "What was checked, by whom",
    publish: "Publish",
    retire: "Retire",
    replaces: "Updates a published card",
    scopeLabel: "Kind of card",
    scope_between: "Between two places",
    scope_airport: "From the airport",
    scope_around: "Around a destination",
    fromLabel: "From",
    toLabel: "To",
    modeLabel: "How",
    lineName: "Line or operator",
    pickupName: "Where to get on",
    dropoffName: "Where to get off",
    fareBasis: "Fare",
    basis_person: "Per person",
    basis_vehicle: "Per vehicle",
    basis_free: "Free",
    fareLow: "Lowest",
    fareHigh: "Highest",
    currencyLabel: "Currency",
    durMin: "Shortest trip (min)",
    durMax: "Longest trip (min)",
    frequency: "Every (min)",
    firstDep: "First departure",
    lastDep: "Last departure",
    sundayQ: "Runs on Sundays",
    stepFreeQ: "Step-free",
    nightQ: "Runs at night",
    luggageQ: "Room for luggage",
    tip_en: "Tip for travellers (English)",
    tip_ar: "Tip for travellers (Arabic)",
    tip_fr: "Tip for travellers (French)",
    safetyNote: "Safety note",
    evidenceKind: "Kind of evidence",
    evidenceNote: "What was checked, by whom, when",
    evidenceUrl: "Link (optional)",
    evidenceOn: "On",
    addEvidence: "Add evidence",
    needEvidence: "Add at least one piece of evidence.",
    saveCard: "Save card",
    submitCard: "Send for review",
    cancel: "Cancel",
    guideTransportTitle: "Transport you know",
    guideTransportBody:
      "Tell us how to get somewhere by service, bus or van: where it leaves from, what it costs, how often. Our team checks it before travellers see it.",
    myCards: "Cards you sent",
    decisionReasonShort: "Reason (the sender sees it)",
    exTitle: "Money changers",
    exBody:
      "Load Banque du Liban's list of registered exchange institutions every month. A changer missing from the list is hidden at once.",
    registerLatest: "List dated {date}, {n} institutions, loaded {loaded}",
    registerNone: "No list loaded yet, so no changer can be approved.",
    registerOverdue: "The list is over 35 days old. Load this month's.",
    loadTitle: "Load this month's list",
    publishedOn: "Date printed on the list",
    sourceUrl: "Where you got it (link)",
    pasteLabel: "Paste the list: one institution per line, as number, category, name, address",
    parsed: "{n} institutions read",
    parseErrors: "Lines {lines} need a number and category A or B.",
    loadButton: "Load and compare",
    diffMatched: "{n} changers matched",
    diffMissing: "Missing from the list, now hidden",
    diffCategory: "Category changed",
    heldTitle: "Held rates",
    heldEmpty: "No held rates.",
    showRate: "Show it",
    rejectRate: "Don't show",
    licencesTitle: "Licences and branches",
    licencesEmpty: "No changer has applied yet.",
    branchChecked: "Checked {date}",
    branchNotChecked: "Not checked yet",
    recordBranchCheck: "Record a check",
    pausedUntil: "Rates paused until {date}",
    reg_unchecked: "Not matched yet",
    reg_matched: "On the list",
    reg_missing: "Not on the list",
    reg_category_changed: "Category differs",
    upholdExchange: "Uphold as an exchange report",
    upheld: "Upheld.",
    ratesPausedNow: "Second upheld rate report in 30 days: rate posting is paused for 30 days.",
    vnTitle: "Restaurants and stays",
    vnBody:
      "Each destination aims for 5 restaurants and 3 places to stay that we checked. A check lasts a year; licensed owners can claim a place we visited.",
    coverageTitle: "Coverage by destination",
    colRestaurants: "Restaurants",
    colStays: "Stays",
    colTransport: "Transport",
    colDrivers: "Drivers",
    colChangers: "Changers",
    venuesTitle: "Places",
    dueOnly: "Only those due for a re-check",
    kind_restaurant: "Restaurant",
    kind_hotel: "Place to stay",
    noVenues: "No places here.",
    notChecked: "Not checked",
    checkedUntil: "Checked {date}, re-check by {due}",
    runBy: "Run by {owner}",
    levelLabel: "What was checked",
    level_licensed_claimed: "Licence checked, run by the owner",
    level_checked_by_mshwar: "Visited by our team",
    checkedOnDate: "Checked on",
    venueNotes: "What you checked (licence seen, visit, meal, rooms)",
    recordVenueCheck: "Record check",
    licenceMissing: "Needs a licence number on the listing first.",
    addVisitedTitle: "Add a place our team visited",
    nameLabel: "Name",
    descriptionLabel: "Description travellers will read",
    addressLabel: "Address",
    latLabel: "Latitude",
    lngLabel: "Longitude",
    cuisinesLabel: "Cuisines (comma separated)",
    priceLevelLabel: "Price level (1–4)",
    phoneLabel: "Reservation phone",
    stayTypeLabel: "Type of stay",
    starsLabel: "Stars",
    priceFromLabel: "From (USD a night)",
    bookingUrlLabel: "Booking link",
    amenitiesLabel: "Amenities (comma separated)",
    addVenue: "Add place",
    venueAdded: "Added. It shows as visited by Mshwar.",
    claimsTitle: "Ownership claims",
    claimsEmpty: "No claims waiting.",
    claimBy: "{org} ({status}) claims {place}",
    approveClaim: "Approve",
    rejectClaim: "Reject",
    claimReason: "Reason (the business sees it)",
  },
  ar: {
    loadError: "تعذّر التحميل. حاول مجددًا.",
    saved: "تم الحفظ.",
    back: "رجوع",
    open: "افتح",
    all: "الكل",
    yes: "نعم",
    no: "لا",
    unknown: "غير معروف",
    remove: "إزالة",
    vqTitle: "التحقّق من السائقين والصرّافين",
    vqBody:
      "تحقّق من كل مستند لدى الجهة المُصدِرة قبل اعتماده. تتطلّب الموافقة اعتماد كل المستندات المطلوبة ومكالمة فيديو أو زيارة.",
    kindLabel: "النوع",
    kind_driver: "سائق",
    kind_changer: "صرّاف",
    statusLabel: "الحالة",
    st_submitted: "بانتظار المراجعة",
    st_approved: "موافق عليه",
    st_lapsed: "مستندات منتهية",
    st_suspended: "موقوف",
    st_rejected: "مرفوض",
    st_draft: "مسودة",
    queueEmpty: "لا شيء هنا.",
    waitingHours: "ينتظر منذ {n} ساعة",
    pendingDocs: "{n} مستندات للتحقّق",
    missingN: "{n} ناقصة",
    documentsTitle: "المستندات",
    openDocument: "افتح المستند (الرابط صالح 15 دقيقة)",
    reference: "المرجع {ref}",
    issuer: "صادر عن {issuer}",
    issuedOn: "صدر في {date}",
    expiresOn: "ينتهي في {date}",
    forVehicle: "المركبة {plate}",
    verifyDoc: "تم التحقّق لدى الجهة المُصدِرة",
    rejectDoc: "ارفض",
    rejectReason: "السبب (يراه مقدّم الطلب)",
    missingTitle: "ما زال ناقصًا",
    checksTitle: "مكالمة فيديو أو زيارة أو إعادة تحقّق",
    check_video_call: "مكالمة فيديو",
    check_visit: "زيارة",
    check_recheck: "إعادة تحقّق",
    checkNotes: "ما رأيته، بكلماتك",
    outcome_ok: "كل شيء سليم",
    outcome_concern: "ملاحظة مقلقة",
    recordCheck: "سجّل",
    decisionTitle: "القرار",
    decisionReason: "السبب (مطلوب للرفض أو الإيقاف؛ يراه الشريك)",
    approve: "وافق",
    rejectApp: "ارفض",
    suspend: "أوقف",
    approveBlocked: "تُتاح الموافقة بعد اعتماد كل المستندات المطلوبة ولقاء أحدنا بهم.",
    eventsTitle: "السجل",
    recheckTitle: "إعادات التحقّق لهذا الشهر",
    recheckBody: "عيّنة من الشركاء الظاهرين، الأطول مدةً منذ آخر لقاء أولًا.",
    lastMet: "آخر لقاء {date}",
    neverMet: "لم نلتقِ به شخصيًا",
    securityLine: "الهاتف {phone} · المصادقة {totp}",
    on: "مفعّل",
    off: "غير مفعّل",
    unverifiedPhone: "غير موثّق",
    ttTitle: "بطاقات المواصلات",
    ttBody:
      "لا تنشر بطاقة إلا بعد أن يجرّبها أحد أو يتحقّق منها لدى المشغّل. تحتاج البطاقة إلى تحقّق جديد بعد 90 يومًا.",
    destinationLabel: "الوجهة",
    anyDestination: "كل الوجهات",
    tst_submitted: "بانتظار المراجعة",
    tst_published: "منشورة",
    tst_rejected: "مرفوضة",
    tst_retired: "متوقفة",
    newCard: "بطاقة جديدة",
    editCard: "عدّل",
    noCards: "لا بطاقات هنا.",
    evidenceTitle: "الأدلة",
    ev_field_check: "تحقّق ميداني",
    ev_operator: "المشغّل",
    ev_guide_report: "تقرير مرشد",
    ev_traveller_report: "تقرير مسافر",
    flagsTitle: "بلاغات مفتوحة",
    submittedBy: "أرسلها {role}",
    role_staff: "الفريق",
    role_guide: "مرشد",
    fieldCheckOn: "تاريخ التحقّق الميداني",
    fieldCheckNote: "ما الذي جرى التحقّق منه ومن قام به",
    publish: "انشر",
    retire: "أوقف",
    replaces: "تحدّث بطاقة منشورة",
    scopeLabel: "نوع البطاقة",
    scope_between: "بين مكانين",
    scope_airport: "من المطار",
    scope_around: "داخل وجهة",
    fromLabel: "من",
    toLabel: "إلى",
    modeLabel: "الوسيلة",
    lineName: "الخط أو المشغّل",
    pickupName: "مكان الصعود",
    dropoffName: "مكان النزول",
    fareBasis: "الأجرة",
    basis_person: "للشخص",
    basis_vehicle: "للمركبة",
    basis_free: "مجانية",
    fareLow: "الأدنى",
    fareHigh: "الأعلى",
    currencyLabel: "العملة",
    durMin: "أقصر مدة (دقيقة)",
    durMax: "أطول مدة (دقيقة)",
    frequency: "كل (دقيقة)",
    firstDep: "أول انطلاق",
    lastDep: "آخر انطلاق",
    sundayQ: "يعمل أيام الأحد",
    stepFreeQ: "بلا درج",
    nightQ: "يعمل ليلًا",
    luggageQ: "يتّسع للأمتعة",
    tip_en: "نصيحة للمسافرين (بالإنكليزية)",
    tip_ar: "نصيحة للمسافرين (بالعربية)",
    tip_fr: "نصيحة للمسافرين (بالفرنسية)",
    safetyNote: "ملاحظة أمان",
    evidenceKind: "نوع الدليل",
    evidenceNote: "ما الذي جرى التحقّق منه ومن قام به ومتى",
    evidenceUrl: "رابط (اختياري)",
    evidenceOn: "في",
    addEvidence: "أضف دليلًا",
    needEvidence: "أضف دليلًا واحدًا على الأقل.",
    saveCard: "احفظ البطاقة",
    submitCard: "أرسل للمراجعة",
    cancel: "إلغاء",
    guideTransportTitle: "مواصلات تعرفها",
    guideTransportBody:
      "أخبرنا كيف نصل إلى مكان ما بالسرفيس أو الباص أو الفان: من أين ينطلق وكم يكلّف وكم مرة. يتحقّق فريقنا قبل أن يراه المسافرون.",
    myCards: "البطاقات التي أرسلتها",
    decisionReasonShort: "السبب (يراه المُرسِل)",
    exTitle: "الصرّافون",
    exBody: "حمّل لائحة مصرف لبنان لمؤسسات الصرافة المسجّلة كل شهر. يُخفى فورًا كل صرّاف غير موجود على اللائحة.",
    registerLatest: "لائحة بتاريخ {date}، {n} مؤسسة، حُمّلت في {loaded}",
    registerNone: "لم تُحمَّل أي لائحة بعد، فلا يمكن الموافقة على أي صرّاف.",
    registerOverdue: "عمر اللائحة أكثر من 35 يومًا. حمّل لائحة هذا الشهر.",
    loadTitle: "حمّل لائحة هذا الشهر",
    publishedOn: "التاريخ المطبوع على اللائحة",
    sourceUrl: "المصدر (رابط)",
    pasteLabel: "الصق اللائحة: مؤسسة في كل سطر بالشكل رقم، فئة، اسم، عنوان",
    parsed: "قُرئت {n} مؤسسة",
    parseErrors: "الأسطر {lines} تحتاج إلى رقم وفئة أ أو ب.",
    loadButton: "حمّل وقارن",
    diffMatched: "تطابق {n} صرّافًا",
    diffMissing: "غير موجودين على اللائحة، أُخفوا الآن",
    diffCategory: "تغيّرت الفئة",
    heldTitle: "أسعار معلّقة",
    heldEmpty: "لا أسعار معلّقة.",
    showRate: "أظهره",
    rejectRate: "لا تُظهره",
    licencesTitle: "التراخيص والفروع",
    licencesEmpty: "لم يتقدّم أي صرّاف بعد.",
    branchChecked: "تحقّقنا في {date}",
    branchNotChecked: "لم يُتحقّق منه بعد",
    recordBranchCheck: "سجّل تحقّقًا",
    pausedUntil: "الأسعار موقوفة حتى {date}",
    reg_unchecked: "لم يُطابَق بعد",
    reg_matched: "على اللائحة",
    reg_missing: "غير موجود على اللائحة",
    reg_category_changed: "الفئة مختلفة",
    upholdExchange: "ثبّت كبلاغ صرافة",
    upheld: "تم التثبيت.",
    ratesPausedNow: "ثاني بلاغ مثبت عن السعر خلال 30 يومًا: أوقف نشر الأسعار 30 يومًا.",
    vnTitle: "المطاعم وأماكن الإقامة",
    vnBody:
      "تهدف كل وجهة إلى 5 مطاعم و3 أماكن إقامة تحقّقنا منها. يدوم التحقّق سنة؛ ويمكن للمالكين المرخّصين المطالبة بمكان زرناه.",
    coverageTitle: "التغطية حسب الوجهة",
    colRestaurants: "مطاعم",
    colStays: "إقامة",
    colTransport: "مواصلات",
    colDrivers: "سائقون",
    colChangers: "صرّافون",
    venuesTitle: "الأماكن",
    dueOnly: "فقط ما يحتاج إلى تحقّق جديد",
    kind_restaurant: "مطعم",
    kind_hotel: "مكان إقامة",
    noVenues: "لا أماكن هنا.",
    notChecked: "لم يُتحقّق منه",
    checkedUntil: "تحقّقنا في {date}، إعادة التحقّق قبل {due}",
    runBy: "يديره {owner}",
    levelLabel: "ما الذي جرى التحقّق منه",
    level_licensed_claimed: "تحقّقنا من الترخيص، يديره المالك",
    level_checked_by_mshwar: "زاره فريقنا",
    checkedOnDate: "تاريخ التحقّق",
    venueNotes: "ما الذي تحقّقت منه (الترخيص، الزيارة، الوجبة، الغرف)",
    recordVenueCheck: "سجّل التحقّق",
    licenceMissing: "يلزم رقم ترخيص على الإدراج أولًا.",
    addVisitedTitle: "أضف مكانًا زاره فريقنا",
    nameLabel: "الاسم",
    descriptionLabel: "الوصف الذي يقرؤه المسافرون",
    addressLabel: "العنوان",
    latLabel: "خط العرض",
    lngLabel: "خط الطول",
    cuisinesLabel: "المطابخ (مفصولة بفواصل)",
    priceLevelLabel: "مستوى السعر (1–4)",
    phoneLabel: "هاتف الحجز",
    stayTypeLabel: "نوع الإقامة",
    starsLabel: "النجوم",
    priceFromLabel: "ابتداءً من (دولار لليلة)",
    bookingUrlLabel: "رابط الحجز",
    amenitiesLabel: "المرافق (مفصولة بفواصل)",
    addVenue: "أضف المكان",
    venueAdded: "أُضيف. يظهر على أنه زاره مشوار.",
    claimsTitle: "طلبات الملكية",
    claimsEmpty: "لا طلبات بانتظار المراجعة.",
    claimBy: "{org} ({status}) يطالب بـ {place}",
    approveClaim: "وافق",
    rejectClaim: "ارفض",
    claimReason: "السبب (تراه المؤسسة)",
  },
  fr: {
    loadError: "Chargement impossible. Réessayez.",
    saved: "Enregistré.",
    back: "Retour",
    open: "Ouvrir",
    all: "Tous",
    yes: "Oui",
    no: "Non",
    unknown: "Inconnu",
    remove: "Retirer",
    vqTitle: "Vérification des chauffeurs et changeurs",
    vqBody:
      "Vérifiez chaque document auprès de l’émetteur avant de le valider. L’approbation exige tous les documents validés et un appel vidéo ou une visite.",
    kindLabel: "Type",
    kind_driver: "Chauffeur",
    kind_changer: "Changeur",
    statusLabel: "Statut",
    st_submitted: "En attente",
    st_approved: "Approuvé",
    st_lapsed: "Documents expirés",
    st_suspended: "Suspendu",
    st_rejected: "Refusé",
    st_draft: "Brouillon",
    queueEmpty: "Rien ici.",
    waitingHours: "En attente depuis {n} h",
    pendingDocs: "{n} documents à vérifier",
    missingN: "{n} manquants",
    documentsTitle: "Documents",
    openDocument: "Ouvrir le document (lien valable 15 minutes)",
    reference: "Référence {ref}",
    issuer: "Émis par {issuer}",
    issuedOn: "émis le {date}",
    expiresOn: "expire le {date}",
    forVehicle: "Véhicule {plate}",
    verifyDoc: "Vérifié auprès de l’émetteur",
    rejectDoc: "Refuser",
    rejectReason: "Motif (visible par le candidat)",
    missingTitle: "Encore manquant",
    checksTitle: "Appel vidéo, visite ou revérification",
    check_video_call: "Appel vidéo",
    check_visit: "Visite",
    check_recheck: "Revérification",
    checkNotes: "Ce que vous avez constaté, avec vos mots",
    outcome_ok: "Tout va bien",
    outcome_concern: "Un doute",
    recordCheck: "Enregistrer",
    decisionTitle: "Décision",
    decisionReason: "Motif (obligatoire pour refuser ou suspendre ; visible par le partenaire)",
    approve: "Approuver",
    rejectApp: "Refuser",
    suspend: "Suspendre",
    approveBlocked: "L’approbation s’ouvre quand tous les documents sont validés et que quelqu’un les a rencontrés.",
    eventsTitle: "Historique",
    recheckTitle: "Revérifications du mois",
    recheckBody: "Un échantillon de partenaires actifs, les plus anciens depuis la dernière rencontre d’abord.",
    lastMet: "Rencontré le {date}",
    neverMet: "Jamais rencontré",
    securityLine: "Téléphone {phone} · authentificateur {totp}",
    on: "activé",
    off: "désactivé",
    unverifiedPhone: "non vérifié",
    ttTitle: "Fiches transport",
    ttBody:
      "Ne publiez une fiche qu’après l’avoir testée ou vérifiée auprès de l’opérateur. Une fiche est à revérifier 90 jours après sa vérification.",
    destinationLabel: "Destination",
    anyDestination: "Toutes les destinations",
    tst_submitted: "En attente",
    tst_published: "Publiée",
    tst_rejected: "Refusée",
    tst_retired: "Retirée",
    newCard: "Nouvelle fiche",
    editCard: "Modifier",
    noCards: "Aucune fiche ici.",
    evidenceTitle: "Preuves",
    ev_field_check: "Vérification sur place",
    ev_operator: "Opérateur",
    ev_guide_report: "Rapport de guide",
    ev_traveller_report: "Rapport de voyageur",
    flagsTitle: "Signalements ouverts",
    submittedBy: "Envoyée par {role}",
    role_staff: "l’équipe",
    role_guide: "un guide",
    fieldCheckOn: "Date de la vérification",
    fieldCheckNote: "Ce qui a été vérifié, et par qui",
    publish: "Publier",
    retire: "Retirer",
    replaces: "Met à jour une fiche publiée",
    scopeLabel: "Type de fiche",
    scope_between: "Entre deux lieux",
    scope_airport: "Depuis l’aéroport",
    scope_around: "Dans une destination",
    fromLabel: "De",
    toLabel: "À",
    modeLabel: "Mode",
    lineName: "Ligne ou opérateur",
    pickupName: "Où monter",
    dropoffName: "Où descendre",
    fareBasis: "Tarif",
    basis_person: "Par personne",
    basis_vehicle: "Par véhicule",
    basis_free: "Gratuit",
    fareLow: "Minimum",
    fareHigh: "Maximum",
    currencyLabel: "Devise",
    durMin: "Trajet le plus court (min)",
    durMax: "Trajet le plus long (min)",
    frequency: "Toutes les (min)",
    firstDep: "Premier départ",
    lastDep: "Dernier départ",
    sundayQ: "Circule le dimanche",
    stepFreeQ: "Sans marche",
    nightQ: "Circule la nuit",
    luggageQ: "Place pour les bagages",
    tip_en: "Conseil (anglais)",
    tip_ar: "Conseil (arabe)",
    tip_fr: "Conseil (français)",
    safetyNote: "Note de sécurité",
    evidenceKind: "Type de preuve",
    evidenceNote: "Ce qui a été vérifié, par qui, quand",
    evidenceUrl: "Lien (facultatif)",
    evidenceOn: "Le",
    addEvidence: "Ajouter une preuve",
    needEvidence: "Ajoutez au moins une preuve.",
    saveCard: "Enregistrer la fiche",
    submitCard: "Envoyer pour vérification",
    cancel: "Annuler",
    guideTransportTitle: "Les transports que vous connaissez",
    guideTransportBody:
      "Dites-nous comment aller quelque part en service, bus ou van : d’où il part, son prix, sa fréquence. Notre équipe vérifie avant publication.",
    myCards: "Vos fiches envoyées",
    decisionReasonShort: "Motif (visible par l’expéditeur)",
    exTitle: "Changeurs",
    exBody:
      "Chargez chaque mois la liste de la Banque du Liban. Un changeur absent de la liste est masqué immédiatement.",
    registerLatest: "Liste du {date}, {n} établissements, chargée le {loaded}",
    registerNone: "Aucune liste chargée : aucun changeur ne peut être approuvé.",
    registerOverdue: "La liste a plus de 35 jours. Chargez celle du mois.",
    loadTitle: "Charger la liste du mois",
    publishedOn: "Date indiquée sur la liste",
    sourceUrl: "Source (lien)",
    pasteLabel: "Collez la liste : un établissement par ligne, numéro, catégorie, nom, adresse",
    parsed: "{n} établissements lus",
    parseErrors: "Les lignes {lines} nécessitent un numéro et une catégorie A ou B.",
    loadButton: "Charger et comparer",
    diffMatched: "{n} changeurs retrouvés",
    diffMissing: "Absents de la liste, désormais masqués",
    diffCategory: "Catégorie modifiée",
    heldTitle: "Taux retenus",
    heldEmpty: "Aucun taux retenu.",
    showRate: "L’afficher",
    rejectRate: "Ne pas afficher",
    licencesTitle: "Licences et agences",
    licencesEmpty: "Aucun changeur n’a encore postulé.",
    branchChecked: "Vérifiée le {date}",
    branchNotChecked: "Pas encore vérifiée",
    recordBranchCheck: "Enregistrer une vérification",
    pausedUntil: "Taux suspendus jusqu’au {date}",
    reg_unchecked: "Pas encore comparé",
    reg_matched: "Sur la liste",
    reg_missing: "Absent de la liste",
    reg_category_changed: "Catégorie différente",
    upholdExchange: "Confirmer le signalement de change",
    upheld: "Confirmé.",
    ratesPausedNow: "Deuxième signalement de taux confirmé en 30 jours : publication suspendue 30 jours.",
    vnTitle: "Restaurants et hébergements",
    vnBody:
      "Chaque destination vise 5 restaurants et 3 hébergements vérifiés. Une vérification dure un an ; les propriétaires licenciés peuvent revendiquer un lieu visité.",
    coverageTitle: "Couverture par destination",
    colRestaurants: "Restaurants",
    colStays: "Hébergements",
    colTransport: "Transports",
    colDrivers: "Chauffeurs",
    colChangers: "Changeurs",
    venuesTitle: "Lieux",
    dueOnly: "Seulement ceux à revérifier",
    kind_restaurant: "Restaurant",
    kind_hotel: "Hébergement",
    noVenues: "Aucun lieu ici.",
    notChecked: "Non vérifié",
    checkedUntil: "Vérifié le {date}, à revérifier avant le {due}",
    runBy: "Géré par {owner}",
    levelLabel: "Ce qui a été vérifié",
    level_licensed_claimed: "Licence vérifiée, géré par le propriétaire",
    level_checked_by_mshwar: "Visité par notre équipe",
    checkedOnDate: "Vérifié le",
    venueNotes: "Ce que vous avez vérifié (licence, visite, repas, chambres)",
    recordVenueCheck: "Enregistrer la vérification",
    licenceMissing: "Il faut d’abord un numéro de licence.",
    addVisitedTitle: "Ajouter un lieu visité par l’équipe",
    nameLabel: "Nom",
    descriptionLabel: "Description pour les voyageurs",
    addressLabel: "Adresse",
    latLabel: "Latitude",
    lngLabel: "Longitude",
    cuisinesLabel: "Cuisines (séparées par des virgules)",
    priceLevelLabel: "Niveau de prix (1–4)",
    phoneLabel: "Téléphone de réservation",
    stayTypeLabel: "Type d’hébergement",
    starsLabel: "Étoiles",
    priceFromLabel: "À partir de (USD la nuit)",
    bookingUrlLabel: "Lien de réservation",
    amenitiesLabel: "Équipements (séparés par des virgules)",
    addVenue: "Ajouter le lieu",
    venueAdded: "Ajouté. Il apparaît comme visité par Mshwar.",
    claimsTitle: "Revendications",
    claimsEmpty: "Aucune revendication en attente.",
    claimBy: "{org} ({status}) revendique {place}",
    approveClaim: "Approuver",
    rejectClaim: "Refuser",
    claimReason: "Motif (visible par l’établissement)",
  },
};

export type AdminTrustCopy = Record<AdminTrustKey, string>;

export function useAdminTrustCopy(): AdminTrustCopy {
  const { locale } = useLocale();
  return adminTrustCopy[locale];
}
