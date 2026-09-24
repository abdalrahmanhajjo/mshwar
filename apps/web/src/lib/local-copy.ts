import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/** Copy for the traveller side of transport, drivers, money changers, food and stays. */
export type LocalKey =
  | "localKicker"
  | "localTitle"
  | "localBody"
  | "navTransport"
  | "navDrivers"
  | "navMoney"
  | "navEat"
  | "navStay"
  | "loadError"
  | "transportTitle"
  | "fromAirport"
  | "fromBeirut"
  | "between"
  | "around"
  | "transportEmpty"
  | "mode_service_taxi"
  | "mode_taxi"
  | "mode_bus"
  | "mode_van"
  | "mode_ride_hailing"
  | "mode_car_rental"
  | "mode_walking"
  | "mode_ferry"
  | "farePerson"
  | "fareVehicle"
  | "fareFree"
  | "durationRange"
  | "durationOne"
  | "everyN"
  | "firstLast"
  | "sundayYes"
  | "sundayNo"
  | "pickupAt"
  | "dropoffAt"
  | "stepFree"
  | "nightService"
  | "luggageOk"
  | "checkedOn"
  | "reviewDue"
  | "flagCard"
  | "flagReason"
  | "flag_fare_higher"
  | "flag_fare_lower"
  | "flag_no_longer_runs"
  | "flag_wrong_pickup"
  | "flag_times_wrong"
  | "flag_unsafe"
  | "flag_other"
  | "flagDetails"
  | "sendFlag"
  | "flagThanks"
  | "signInToReport"
  | "driversTitle"
  | "driversBody"
  | "driversEmpty"
  | "askPrice"
  | "seeAllDrivers"
  | "newDriver"
  | "ratingLine"
  | "ridesDone"
  | "dayRateFrom"
  | "airportYes"
  | "seatsN"
  | "speaks"
  | "viewDriver"
  | "changersTitle"
  | "changersBody"
  | "changersEmpty"
  | "nearMe"
  | "distanceKm"
  | "distanceM"
  | "bdlLine"
  | "registerChecked"
  | "branchChecked"
  | "ratePosted"
  | "noRate"
  | "theyBuy"
  | "theySell"
  | "lbp"
  | "openToday"
  | "closedToday"
  | "directions"
  | "callBranch"
  | "exch_rate_different"
  | "exch_counterfeit"
  | "exch_refused_receipt"
  | "exch_conduct"
  | "exch_other"
  | "counterfeitNote"
  | "eatTitle"
  | "stayTitle"
  | "eatEmpty"
  | "stayEmpty"
  | "venue_licensed_claimed"
  | "venue_checked_by_mshwar"
  | "licenceLine"
  | "reserve"
  | "whatsapp"
  | "website"
  | "fromPrice"
  | "stay_hotel"
  | "stay_guesthouse"
  | "stay_hostel"
  | "stay_apartment"
  | "starsN"
  | "checkInOut"
  | "askToStay"
  | "details"
  | "myRidesTitle"
  | "myRidesBody"
  | "noRides"
  | "openRequests"
  | "bookedRides"
  | "pastRequests"
  | "pricesN"
  | "req_open"
  | "req_booked"
  | "req_cancelled"
  | "req_expired"
  | "newRideTitle"
  | "newRideBody"
  | "kindLabel"
  | "kindRideHint"
  | "kindDayHint"
  | "kindAirportHint"
  | "areaLabel"
  | "pickupLabel"
  | "dropoffLabel"
  | "dropoffOptional"
  | "placeHint"
  | "findPlace"
  | "useMyLocation"
  | "pinned"
  | "airportName"
  | "dateLabel"
  | "timeLabel"
  | "timeHint"
  | "hoursLabel"
  | "partyLabel"
  | "luggageLabel"
  | "flightLabel"
  | "notesLabel"
  | "notesHint"
  | "sendRequest"
  | "requestTitle"
  | "quotesTitle"
  | "quotesWaiting"
  | "openUntil"
  | "bookAt"
  | "cancelRequest"
  | "requestClosed"
  | "quoteNoteLabel"
  | "quoteFor"
  | "rideTitle"
  | "yourDriver"
  | "checkPlate"
  | "vehicleLine"
  | "callDriver"
  | "payInCar"
  | "tstate_confirmed"
  | "tstate_completed"
  | "tstate_cancelled_by_traveller"
  | "tstate_cancelled_by_driver"
  | "tstate_no_show"
  | "driverReason"
  | "shareTitle"
  | "shareBody"
  | "shareOnce"
  | "copyLink"
  | "copied"
  | "newLink"
  | "newLinkHint"
  | "cancelRideTraveller"
  | "cancelReasonOptional"
  | "confirmCancelRide"
  | "keepRide"
  | "reviewDriver"
  | "yourReviewN"
  | "reviewBlindTraveller"
  | "backToRides"
  | "sharedTitle"
  | "sharedTraveller"
  | "sharedBody"
  | "sharedEnded"
  | "sharedGone"
  | "sharedWorried"
  | "directoryTitle"
  | "filterArea"
  | "anyArea"
  | "directoryEmpty"
  | "about"
  | "vehiclesTitle"
  | "reviewsTitle"
  | "noReviews"
  | "driverNotListed"
  | "howItWorks"
  | "how1"
  | "how2"
  | "how3"
  | "how4"
  | "signInToBook"
  | "legTitle"
  | "legNone"
  | "legAskDriver"
  | "legAllTransport"
  | "nearbyTitle"
  | "nearbyEat"
  | "nearbyStay"
  | "nearbyNone";

export const localCopy: Record<Locale, Record<LocalKey, string>> = {
  en: {
    localKicker: "Local essentials",
    localTitle: "Getting around {name}",
    localBody:
      "Transport, drivers, money changers, food and places to stay, each checked by our team with the date we checked it.",
    navTransport: "Transport",
    navDrivers: "Drivers",
    navMoney: "Money",
    navEat: "Eat",
    navStay: "Stay",
    loadError: "We couldn't load this part. Try again in a moment.",
    transportTitle: "Getting there and around",
    fromAirport: "From Beirut airport",
    fromBeirut: "From Beirut",
    between: "From other places",
    around: "Around {name}",
    transportEmpty: "We haven't checked transport to {name} yet. A verified driver can quote you a fixed price.",
    mode_service_taxi: "Service (shared taxi)",
    mode_taxi: "Taxi",
    mode_bus: "Bus",
    mode_van: "Van",
    mode_ride_hailing: "Ride-hailing app",
    mode_car_rental: "Car rental",
    mode_walking: "On foot",
    mode_ferry: "Ferry",
    farePerson: "{fare} per person",
    fareVehicle: "{fare} per car",
    fareFree: "Free",
    durationRange: "{min}–{max} min",
    durationOne: "About {min} min",
    everyN: "Every {n} min",
    firstLast: "First {first} · last {last}",
    sundayYes: "Runs on Sundays",
    sundayNo: "No Sunday service",
    pickupAt: "Get on at {place}",
    dropoffAt: "Get off at {place}",
    stepFree: "Step-free",
    nightService: "Runs at night",
    luggageOk: "Room for luggage",
    checkedOn: "Checked {date}",
    reviewDue: "Due for a re-check",
    flagCard: "Something changed?",
    flagReason: "What changed",
    flag_fare_higher: "The fare is higher",
    flag_fare_lower: "The fare is lower",
    flag_no_longer_runs: "It no longer runs",
    flag_wrong_pickup: "The pick-up point moved",
    flag_times_wrong: "The times are wrong",
    flag_unsafe: "It felt unsafe",
    flag_other: "Something else",
    flagDetails: "Details (optional)",
    sendFlag: "Send",
    flagThanks: "Thank you. We re-check a card when travellers tell us it changed.",
    signInToReport: "Sign in to tell us",
    driversTitle: "Verified drivers",
    driversBody:
      "Licensed red-plate drivers whose documents we checked with the issuer. Ask for a price, choose one, and pay the driver in the car. Mshwar takes nothing.",
    driversEmpty: "No verified driver covers {name} yet.",
    askPrice: "Ask drivers for a price",
    seeAllDrivers: "See every driver",
    newDriver: "New on Mshwar",
    ratingLine: "{avg} from {count} reviews",
    ridesDone: "{n} rides done",
    dayRateFrom: "Day hire around {price}",
    airportYes: "Airport pickups",
    seatsN: "{n} seats",
    speaks: "Speaks {languages}",
    viewDriver: "See {name}",
    changersTitle: "Licensed money changers",
    changersBody:
      "Only institutions on Banque du Liban's list, with the branch checked by our team. Rates are posted by the changer: confirm at the counter and ask for a receipt. We never rank changers by rate.",
    changersEmpty: "No checked changer in {name} yet. Banks and ATMs are the safe alternative.",
    nearMe: "Nearest to me",
    distanceKm: "{km} km away",
    distanceM: "{m} m away",
    bdlLine: "BDL no. {number} · category {category}",
    registerChecked: "On BDL's list, checked {date}",
    branchChecked: "Branch visited {date}",
    ratePosted: "Posted by the changer {time}",
    noRate: "No rate posted in the last 12 hours",
    theyBuy: "They buy 1 {base}",
    theySell: "They sell 1 {base}",
    lbp: "{amount} LBP",
    openToday: "Today {hours}",
    closedToday: "Closed today",
    directions: "Directions",
    callBranch: "Call",
    exch_rate_different: "The rate at the counter was different",
    exch_counterfeit: "I was given a counterfeit note",
    exch_refused_receipt: "They refused to give a receipt",
    exch_conduct: "Behaviour",
    exch_other: "Something else",
    counterfeitNote: "A counterfeit note reaches a person on our team straight away. Keep the note and the receipt.",
    eatTitle: "Where to eat",
    stayTitle: "Where to stay",
    eatEmpty: "We haven't checked restaurants in {name} yet.",
    stayEmpty: "We haven't checked places to stay in {name} yet.",
    venue_licensed_claimed: "Licensed · run by the owner on Mshwar",
    venue_checked_by_mshwar: "Checked by Mshwar",
    licenceLine: "Licence {number}, {authority}",
    reserve: "Call to reserve",
    whatsapp: "WhatsApp",
    website: "Book online",
    fromPrice: "From {price} a night",
    stay_hotel: "Hotel",
    stay_guesthouse: "Guesthouse",
    stay_hostel: "Hostel",
    stay_apartment: "Apartment",
    starsN: "{n}-star",
    checkInOut: "Check-in {in} · check-out {out}",
    askToStay: "Ask to stay",
    details: "Details",
    myRidesTitle: "My rides",
    myRidesBody: "Requests you sent to verified drivers and the rides you booked.",
    noRides: "You haven't asked for a ride yet.",
    openRequests: "Waiting for prices",
    bookedRides: "Booked rides",
    pastRequests: "Earlier requests",
    pricesN: "Prices: {n}",
    req_open: "Waiting for prices",
    req_booked: "Booked",
    req_cancelled: "Cancelled",
    req_expired: "Expired",
    newRideTitle: "Ask verified drivers for a price",
    newRideBody:
      "Say where and when. Verified drivers covering the area send you a fixed price with their checks; you choose one. You pay the driver in the car.",
    kindLabel: "What you need",
    kindRideHint: "From one place to another",
    kindDayHint: "A driver for 2 to 14 hours",
    kindAirportHint: "Met at arrivals, flight followed",
    areaLabel: "Area the ride starts in",
    pickupLabel: "Pick-up",
    dropoffLabel: "Drop-off",
    dropoffOptional: "Drop-off (optional)",
    placeHint: "Type an address or hotel, or find a place by name below.",
    findPlace: "Find a place by name",
    useMyLocation: "My location",
    pinned: "Pinned on the map",
    airportName: "Beirut–Rafic Hariri International Airport",
    dateLabel: "Date",
    timeLabel: "Time (Beirut)",
    timeHint: "At least an hour from now.",
    hoursLabel: "Hours",
    partyLabel: "People",
    luggageLabel: "Bags",
    flightLabel: "Flight number",
    notesLabel: "Anything the driver should know",
    notesHint:
      "A child seat, a wheelchair, a stop on the way. Don't share your phone number here; it is shared once you book.",
    sendRequest: "Send to drivers",
    requestTitle: "Your ride request",
    quotesTitle: "Prices from verified drivers",
    quotesWaiting: "Drivers covering the area have been told. Prices usually arrive within the hour; we'll notify you.",
    openUntil: "Open until {time}",
    bookAt: "Book at {price}",
    cancelRequest: "Cancel request",
    requestClosed: "This request is closed.",
    quoteNoteLabel: "Driver's note",
    quoteFor: "{vehicle} · {seats}",
    rideTitle: "Your ride",
    yourDriver: "Your driver",
    checkPlate: "Check the plate before you get in",
    vehicleLine: "{colour} {make} {model}",
    callDriver: "Call {phone}",
    payInCar: "Pay {price} to the driver in the car.",
    tstate_confirmed: "Booked",
    tstate_completed: "Done",
    tstate_cancelled_by_traveller: "Cancelled by you",
    tstate_cancelled_by_driver: "Cancelled by the driver",
    tstate_no_show: "Marked as a no-show",
    driverReason: "The driver said: {reason}",
    shareTitle: "Share your ride",
    shareBody:
      "Send this link to someone you trust. It shows the driver, the car and the plate, nothing else, and stops working when the ride ends.",
    shareOnce: "This link is shown only now. Copy it before you leave the page.",
    copyLink: "Copy link",
    copied: "Copied",
    newLink: "Make a share link",
    newLinkHint: "A new link replaces the old one.",
    cancelRideTraveller: "Cancel this ride",
    cancelReasonOptional: "Reason (optional, the driver sees it)",
    confirmCancelRide: "Yes, cancel",
    keepRide: "Keep the ride",
    reviewDriver: "Review your driver",
    yourReviewN: "Your review: {n}/5",
    reviewBlindTraveller: "The driver's review of you shows once you have both written, or after 14 days.",
    backToRides: "All my rides",
    sharedTitle: "{name} is on a ride booked through Mshwar",
    sharedTraveller: "Someone you know",
    sharedBody: "Someone shared this so you know who is driving. The driver's documents were checked by Mshwar.",
    sharedEnded: "This ride has ended.",
    sharedGone: "This link has expired or was replaced.",
    sharedWorried: "If you are worried, call them first. In an emergency call 112.",
    directoryTitle: "Verified drivers in Lebanon",
    filterArea: "Destination",
    anyArea: "Anywhere",
    directoryEmpty: "No verified driver here yet.",
    about: "About",
    vehiclesTitle: "Vehicles",
    reviewsTitle: "Reviews from travellers",
    noReviews: "No reviews yet.",
    driverNotListed: "This driver is not listed right now.",
    howItWorks: "How booking works",
    how1: "Send one request: where, when, how many people.",
    how2: "Verified drivers covering the area send a fixed price.",
    how3: "Book one. You get the plate and phone, and a link to share.",
    how4: "Pay the driver in the car. Mshwar takes nothing.",
    signInToBook: "Sign in to ask for a price",
    legTitle: "Getting between stops",
    legNone: "No checked transport from {from} to {to} yet.",
    legAskDriver: "Ask a verified driver",
    legAllTransport: "All transport for {name}",
    nearbyTitle: "Checked places near {place}",
    nearbyEat: "Eat",
    nearbyStay: "Stay",
    nearbyNone: "Nothing checked within 15 km yet.",
  },
  ar: {
    localKicker: "أساسيات محلية",
    localTitle: "التنقّل في {name}",
    localBody: "المواصلات والسائقون والصرّافون والمطاعم وأماكن الإقامة، وكلّها تحقّق منها فريقنا مع تاريخ التحقّق.",
    navTransport: "المواصلات",
    navDrivers: "السائقون",
    navMoney: "الصرافة",
    navEat: "مطاعم",
    navStay: "إقامة",
    loadError: "تعذّر تحميل هذا القسم. حاول بعد قليل.",
    transportTitle: "الوصول والتنقّل",
    fromAirport: "من مطار بيروت",
    fromBeirut: "من بيروت",
    between: "من أماكن أخرى",
    around: "داخل {name}",
    transportEmpty: "لم نتحقّق بعد من المواصلات إلى {name}. يمكن لسائق موثّق أن يعطيك سعرًا ثابتًا.",
    mode_service_taxi: "سرفيس",
    mode_taxi: "تاكسي",
    mode_bus: "باص",
    mode_van: "فان",
    mode_ride_hailing: "تطبيق نقل",
    mode_car_rental: "تأجير سيارات",
    mode_walking: "سيرًا على الأقدام",
    mode_ferry: "عبّارة",
    farePerson: "{fare} للشخص",
    fareVehicle: "{fare} للسيارة",
    fareFree: "مجاني",
    durationRange: "{min}–{max} دقيقة",
    durationOne: "نحو {min} دقيقة",
    everyN: "كل {n} دقيقة",
    firstLast: "الأولى {first} · الأخيرة {last}",
    sundayYes: "يعمل أيام الأحد",
    sundayNo: "لا يعمل أيام الأحد",
    pickupAt: "الانطلاق من {place}",
    dropoffAt: "النزول في {place}",
    stepFree: "بلا درج",
    nightService: "يعمل ليلًا",
    luggageOk: "يتّسع للأمتعة",
    checkedOn: "تحقّقنا في {date}",
    reviewDue: "يحتاج إلى تحقّق جديد",
    flagCard: "هل تغيّر شيء؟",
    flagReason: "ما الذي تغيّر",
    flag_fare_higher: "الأجرة أعلى",
    flag_fare_lower: "الأجرة أقل",
    flag_no_longer_runs: "لم يعد يعمل",
    flag_wrong_pickup: "تغيّرت نقطة الانطلاق",
    flag_times_wrong: "المواعيد غير صحيحة",
    flag_unsafe: "لم أشعر بالأمان",
    flag_other: "أمر آخر",
    flagDetails: "تفاصيل (اختياري)",
    sendFlag: "أرسل",
    flagThanks: "شكرًا. نعيد التحقّق من البطاقة عندما يخبرنا المسافرون بتغيّرها.",
    signInToReport: "سجّل الدخول لإبلاغنا",
    driversTitle: "سائقون موثّقون",
    driversBody:
      "سائقون مرخّصون ذوو لوحات حمراء تحقّقنا من مستنداتهم لدى الجهات المُصدِرة. اطلب سعرًا، واختر، وادفع للسائق في السيارة. لا يأخذ مشوار شيئًا.",
    driversEmpty: "لا سائق موثّقًا يغطّي {name} بعد.",
    askPrice: "اطلب سعرًا من السائقين",
    seeAllDrivers: "اعرض كل السائقين",
    newDriver: "جديد على مشوار",
    ratingLine: "{avg} من {count} مراجعات",
    ridesDone: "{n} رحلات منجزة",
    dayRateFrom: "يوم كامل بنحو {price}",
    airportYes: "استقبال من المطار",
    seatsN: "{n} مقاعد",
    speaks: "يتحدّث {languages}",
    viewDriver: "اعرض {name}",
    changersTitle: "صرّافون مرخّصون",
    changersBody:
      "فقط المؤسسات المدرجة على لائحة مصرف لبنان، مع تحقّق فريقنا من الفرع. الأسعار ينشرها الصرّاف: تأكّد منها عند الشبّاك واطلب إيصالًا. لا نرتّب الصرّافين حسب السعر.",
    changersEmpty: "لا صرّاف موثّقًا في {name} بعد. المصارف وأجهزة الصرف الآلي بديل آمن.",
    nearMe: "الأقرب إليّ",
    distanceKm: "على بعد {km} كم",
    distanceM: "على بعد {m} م",
    bdlLine: "رقم مصرف لبنان {number} · الفئة {category}",
    registerChecked: "على لائحة مصرف لبنان، تحقّقنا في {date}",
    branchChecked: "زرنا الفرع في {date}",
    ratePosted: "نشره الصرّاف {time}",
    noRate: "لا سعر منشور خلال آخر 12 ساعة",
    theyBuy: "يشترون 1 {base}",
    theySell: "يبيعون 1 {base}",
    lbp: "{amount} ل.ل.",
    openToday: "اليوم {hours}",
    closedToday: "مغلق اليوم",
    directions: "الاتجاهات",
    callBranch: "اتصل",
    exch_rate_different: "كان السعر عند الشبّاك مختلفًا",
    exch_counterfeit: "أُعطيت ورقة نقدية مزوّرة",
    exch_refused_receipt: "رفضوا إعطاء إيصال",
    exch_conduct: "السلوك",
    exch_other: "أمر آخر",
    counterfeitNote: "يصل بلاغ الورقة المزوّرة إلى شخص في فريقنا فورًا. احتفظ بالورقة والإيصال.",
    eatTitle: "أين تأكل",
    stayTitle: "أين تقيم",
    eatEmpty: "لم نتحقّق بعد من مطاعم في {name}.",
    stayEmpty: "لم نتحقّق بعد من أماكن إقامة في {name}.",
    venue_licensed_claimed: "مرخّص · يديره المالك على مشوار",
    venue_checked_by_mshwar: "تحقّق منه مشوار",
    licenceLine: "ترخيص {number}، {authority}",
    reserve: "اتصل للحجز",
    whatsapp: "واتساب",
    website: "احجز عبر الإنترنت",
    fromPrice: "ابتداءً من {price} لليلة",
    stay_hotel: "فندق",
    stay_guesthouse: "بيت ضيافة",
    stay_hostel: "نُزُل",
    stay_apartment: "شقة",
    starsN: "{n} نجوم",
    checkInOut: "الوصول {in} · المغادرة {out}",
    askToStay: "اطلب الإقامة",
    details: "التفاصيل",
    myRidesTitle: "رحلاتي",
    myRidesBody: "الطلبات التي أرسلتها إلى السائقين الموثّقين والرحلات التي حجزتها.",
    noRides: "لم تطلب أي رحلة بعد.",
    openRequests: "بانتظار الأسعار",
    bookedRides: "رحلات محجوزة",
    pastRequests: "طلبات سابقة",
    pricesN: "الأسعار: {n}",
    req_open: "بانتظار الأسعار",
    req_booked: "محجوزة",
    req_cancelled: "ملغاة",
    req_expired: "منتهية",
    newRideTitle: "اطلب سعرًا من سائقين موثّقين",
    newRideBody:
      "حدّد المكان والوقت. يرسل لك السائقون الموثّقون في المنطقة سعرًا ثابتًا مع ما تحقّقنا منه؛ وتختار أنت. تدفع للسائق في السيارة.",
    kindLabel: "ما تحتاج إليه",
    kindRideHint: "من مكان إلى آخر",
    kindDayHint: "سائق لمدة 2 إلى 14 ساعة",
    kindAirportHint: "استقبال عند الوصول مع متابعة الرحلة",
    areaLabel: "المنطقة التي تبدأ منها الرحلة",
    pickupLabel: "مكان الانطلاق",
    dropoffLabel: "الوجهة",
    dropoffOptional: "الوجهة (اختياري)",
    placeHint: "اكتب عنوانًا أو فندقًا، أو ابحث عن مكان باسمه أدناه.",
    findPlace: "ابحث عن مكان باسمه",
    useMyLocation: "موقعي",
    pinned: "محدَّد على الخريطة",
    airportName: "مطار رفيق الحريري الدولي – بيروت",
    dateLabel: "التاريخ",
    timeLabel: "الوقت (بتوقيت بيروت)",
    timeHint: "بعد ساعة على الأقل من الآن.",
    hoursLabel: "عدد الساعات",
    partyLabel: "عدد الأشخاص",
    luggageLabel: "الحقائب",
    flightLabel: "رقم الرحلة",
    notesLabel: "ما يجب أن يعرفه السائق",
    notesHint: "مقعد طفل، كرسي متحرّك، توقّف في الطريق. لا تكتب رقم هاتفك هنا؛ يُشارك عند الحجز.",
    sendRequest: "أرسل إلى السائقين",
    requestTitle: "طلب رحلتك",
    quotesTitle: "أسعار من سائقين موثّقين",
    quotesWaiting: "أُبلغ السائقون في المنطقة. تصل الأسعار عادةً خلال ساعة؛ وسنُعلمك.",
    openUntil: "مفتوح حتى {time}",
    bookAt: "احجز بـ {price}",
    cancelRequest: "ألغِ الطلب",
    requestClosed: "هذا الطلب مغلق.",
    quoteNoteLabel: "ملاحظة السائق",
    quoteFor: "{vehicle} · {seats}",
    rideTitle: "رحلتك",
    yourDriver: "سائقك",
    checkPlate: "تحقّق من اللوحة قبل الصعود",
    vehicleLine: "{make} {model} {colour}",
    callDriver: "اتصل بـ {phone}",
    payInCar: "ادفع {price} للسائق في السيارة.",
    tstate_confirmed: "محجوزة",
    tstate_completed: "منجزة",
    tstate_cancelled_by_traveller: "ألغيتها أنت",
    tstate_cancelled_by_driver: "ألغاها السائق",
    tstate_no_show: "سُجّلت كعدم حضور",
    driverReason: "قال السائق: {reason}",
    shareTitle: "شارك رحلتك",
    shareBody: "أرسل هذا الرابط إلى شخص تثق به. يُظهر السائق والسيارة واللوحة فقط، ويتوقّف عن العمل عند انتهاء الرحلة.",
    shareOnce: "يظهر هذا الرابط الآن فقط. انسخه قبل مغادرة الصفحة.",
    copyLink: "انسخ الرابط",
    copied: "تم النسخ",
    newLink: "أنشئ رابط مشاركة",
    newLinkHint: "الرابط الجديد يحلّ محلّ القديم.",
    cancelRideTraveller: "ألغِ هذه الرحلة",
    cancelReasonOptional: "السبب (اختياري، يراه السائق)",
    confirmCancelRide: "نعم، ألغِ",
    keepRide: "أبقِ الرحلة",
    reviewDriver: "قيّم سائقك",
    yourReviewN: "تقييمك: {n}/5",
    reviewBlindTraveller: "يظهر تقييم السائق لك بعد أن يكتب كلاكما، أو بعد 14 يومًا.",
    backToRides: "كل رحلاتي",
    sharedTitle: "{name} في رحلة محجوزة عبر مشوار",
    sharedTraveller: "شخص تعرفه",
    sharedBody: "شاركك أحدهم هذا لتعرف من يقود. تحقّق مشوار من مستندات السائق.",
    sharedEnded: "انتهت هذه الرحلة.",
    sharedGone: "انتهت صلاحية هذا الرابط أو استُبدل.",
    sharedWorried: "إذا كنت قلقًا فاتصل بهم أولًا. في حالة الطوارئ اتصل بـ 112.",
    directoryTitle: "سائقون موثّقون في لبنان",
    filterArea: "الوجهة",
    anyArea: "أي مكان",
    directoryEmpty: "لا سائق موثّقًا هنا بعد.",
    about: "نبذة",
    vehiclesTitle: "المركبات",
    reviewsTitle: "مراجعات المسافرين",
    noReviews: "لا مراجعات بعد.",
    driverNotListed: "هذا السائق غير مدرج حاليًا.",
    howItWorks: "كيف يتم الحجز",
    how1: "أرسل طلبًا واحدًا: أين، ومتى، وكم شخصًا.",
    how2: "يرسل السائقون الموثّقون في المنطقة سعرًا ثابتًا.",
    how3: "احجز واحدًا. تحصل على اللوحة والهاتف ورابط للمشاركة.",
    how4: "ادفع للسائق في السيارة. لا يأخذ مشوار شيئًا.",
    signInToBook: "سجّل الدخول لطلب سعر",
    legTitle: "التنقّل بين المحطات",
    legNone: "لا مواصلات موثّقة من {from} إلى {to} بعد.",
    legAskDriver: "اسأل سائقًا موثّقًا",
    legAllTransport: "كل المواصلات إلى {name}",
    nearbyTitle: "أماكن موثّقة قرب {place}",
    nearbyEat: "مطاعم",
    nearbyStay: "إقامة",
    nearbyNone: "لا شيء موثّقًا ضمن 15 كم بعد.",
  },
  fr: {
    localKicker: "L’essentiel sur place",
    localTitle: "Se déplacer à {name}",
    localBody:
      "Transports, chauffeurs, changeurs, restaurants et hébergements, chacun vérifié par notre équipe, avec la date de vérification.",
    navTransport: "Transports",
    navDrivers: "Chauffeurs",
    navMoney: "Change",
    navEat: "Manger",
    navStay: "Dormir",
    loadError: "Impossible de charger cette partie. Réessayez dans un instant.",
    transportTitle: "Y aller et circuler",
    fromAirport: "Depuis l’aéroport de Beyrouth",
    fromBeirut: "Depuis Beyrouth",
    between: "Depuis d’autres lieux",
    around: "À {name}",
    transportEmpty:
      "Nous n’avons pas encore vérifié les transports vers {name}. Un chauffeur vérifié peut vous donner un prix fixe.",
    mode_service_taxi: "Service (taxi collectif)",
    mode_taxi: "Taxi",
    mode_bus: "Bus",
    mode_van: "Van",
    mode_ride_hailing: "Application VTC",
    mode_car_rental: "Location de voiture",
    mode_walking: "À pied",
    mode_ferry: "Ferry",
    farePerson: "{fare} par personne",
    fareVehicle: "{fare} par voiture",
    fareFree: "Gratuit",
    durationRange: "{min}–{max} min",
    durationOne: "Environ {min} min",
    everyN: "Toutes les {n} min",
    firstLast: "Premier {first} · dernier {last}",
    sundayYes: "Circule le dimanche",
    sundayNo: "Pas de service le dimanche",
    pickupAt: "Montée à {place}",
    dropoffAt: "Descente à {place}",
    stepFree: "Sans marche",
    nightService: "Circule la nuit",
    luggageOk: "Place pour les bagages",
    checkedOn: "Vérifié le {date}",
    reviewDue: "À revérifier",
    flagCard: "Quelque chose a changé ?",
    flagReason: "Ce qui a changé",
    flag_fare_higher: "Le tarif est plus élevé",
    flag_fare_lower: "Le tarif est plus bas",
    flag_no_longer_runs: "Il ne circule plus",
    flag_wrong_pickup: "Le point de départ a changé",
    flag_times_wrong: "Les horaires sont faux",
    flag_unsafe: "Je ne me suis pas senti en sécurité",
    flag_other: "Autre chose",
    flagDetails: "Détails (facultatif)",
    sendFlag: "Envoyer",
    flagThanks: "Merci. Nous revérifions une fiche quand des voyageurs signalent un changement.",
    signInToReport: "Connectez-vous pour nous le signaler",
    driversTitle: "Chauffeurs vérifiés",
    driversBody:
      "Des chauffeurs à plaque rouge dont nous avons vérifié les documents auprès des émetteurs. Demandez un prix, choisissez, payez le chauffeur dans la voiture. Mshwar ne prend rien.",
    driversEmpty: "Aucun chauffeur vérifié ne couvre {name} pour l’instant.",
    askPrice: "Demander un prix aux chauffeurs",
    seeAllDrivers: "Voir tous les chauffeurs",
    newDriver: "Nouveau sur Mshwar",
    ratingLine: "{avg} sur {count} avis",
    ridesDone: "{n} courses effectuées",
    dayRateFrom: "Journée vers {price}",
    airportYes: "Transferts aéroport",
    seatsN: "{n} places",
    speaks: "Parle {languages}",
    viewDriver: "Voir {name}",
    changersTitle: "Changeurs agréés",
    changersBody:
      "Uniquement les établissements de la liste de la Banque du Liban, agence vérifiée par notre équipe. Les taux sont publiés par le changeur : confirmez au guichet et demandez un reçu. Nous ne classons jamais les changeurs par taux.",
    changersEmpty:
      "Aucun changeur vérifié à {name} pour l’instant. Les banques et distributeurs sont une alternative sûre.",
    nearMe: "Les plus proches",
    distanceKm: "À {km} km",
    distanceM: "À {m} m",
    bdlLine: "BDL n° {number} · catégorie {category}",
    registerChecked: "Sur la liste BDL, vérifié le {date}",
    branchChecked: "Agence visitée le {date}",
    ratePosted: "Publié par le changeur {time}",
    noRate: "Aucun taux publié ces 12 dernières heures",
    theyBuy: "Ils achètent 1 {base}",
    theySell: "Ils vendent 1 {base}",
    lbp: "{amount} LBP",
    openToday: "Aujourd’hui {hours}",
    closedToday: "Fermé aujourd’hui",
    directions: "Itinéraire",
    callBranch: "Appeler",
    exch_rate_different: "Le taux au guichet était différent",
    exch_counterfeit: "On m’a remis un faux billet",
    exch_refused_receipt: "Ils ont refusé de donner un reçu",
    exch_conduct: "Comportement",
    exch_other: "Autre chose",
    counterfeitNote: "Un faux billet est transmis immédiatement à notre équipe. Gardez le billet et le reçu.",
    eatTitle: "Où manger",
    stayTitle: "Où dormir",
    eatEmpty: "Nous n’avons pas encore vérifié de restaurants à {name}.",
    stayEmpty: "Nous n’avons pas encore vérifié d’hébergements à {name}.",
    venue_licensed_claimed: "Licencié · géré par le propriétaire",
    venue_checked_by_mshwar: "Vérifié par Mshwar",
    licenceLine: "Licence {number}, {authority}",
    reserve: "Appeler pour réserver",
    whatsapp: "WhatsApp",
    website: "Réserver en ligne",
    fromPrice: "À partir de {price} la nuit",
    stay_hotel: "Hôtel",
    stay_guesthouse: "Maison d’hôtes",
    stay_hostel: "Auberge",
    stay_apartment: "Appartement",
    starsN: "{n} étoiles",
    checkInOut: "Arrivée {in} · départ {out}",
    askToStay: "Demander un séjour",
    details: "Détails",
    myRidesTitle: "Mes courses",
    myRidesBody: "Vos demandes aux chauffeurs vérifiés et les courses réservées.",
    noRides: "Vous n’avez encore demandé aucune course.",
    openRequests: "En attente de prix",
    bookedRides: "Courses réservées",
    pastRequests: "Demandes précédentes",
    pricesN: "Prix : {n}",
    req_open: "En attente de prix",
    req_booked: "Réservée",
    req_cancelled: "Annulée",
    req_expired: "Expirée",
    newRideTitle: "Demandez un prix à des chauffeurs vérifiés",
    newRideBody:
      "Indiquez où et quand. Les chauffeurs vérifiés de la zone vous envoient un prix fixe avec leurs vérifications ; vous choisissez. Vous payez le chauffeur dans la voiture.",
    kindLabel: "Ce qu’il vous faut",
    kindRideHint: "D’un lieu à un autre",
    kindDayHint: "Un chauffeur de 2 à 14 heures",
    kindAirportHint: "Accueil aux arrivées, vol suivi",
    areaLabel: "Zone de départ",
    pickupLabel: "Prise en charge",
    dropoffLabel: "Destination",
    dropoffOptional: "Destination (facultatif)",
    placeHint: "Saisissez une adresse ou un hôtel, ou cherchez un lieu par son nom ci-dessous.",
    findPlace: "Chercher un lieu par son nom",
    useMyLocation: "Ma position",
    pinned: "Épinglé sur la carte",
    airportName: "Aéroport international Rafic-Hariri de Beyrouth",
    dateLabel: "Date",
    timeLabel: "Heure (Beyrouth)",
    timeHint: "Au moins dans une heure.",
    hoursLabel: "Heures",
    partyLabel: "Personnes",
    luggageLabel: "Bagages",
    flightLabel: "Numéro de vol",
    notesLabel: "Ce que le chauffeur doit savoir",
    notesHint:
      "Siège enfant, fauteuil roulant, un arrêt en route. Ne donnez pas votre numéro ici ; il est partagé à la réservation.",
    sendRequest: "Envoyer aux chauffeurs",
    requestTitle: "Votre demande de course",
    quotesTitle: "Prix de chauffeurs vérifiés",
    quotesWaiting:
      "Les chauffeurs de la zone ont été prévenus. Les prix arrivent en général dans l’heure ; nous vous préviendrons.",
    openUntil: "Ouverte jusqu’au {time}",
    bookAt: "Réserver à {price}",
    cancelRequest: "Annuler la demande",
    requestClosed: "Cette demande est close.",
    quoteNoteLabel: "Note du chauffeur",
    quoteFor: "{vehicle} · {seats}",
    rideTitle: "Votre course",
    yourDriver: "Votre chauffeur",
    checkPlate: "Vérifiez la plaque avant de monter",
    vehicleLine: "{make} {model} {colour}",
    callDriver: "Appeler le {phone}",
    payInCar: "Payez {price} au chauffeur dans la voiture.",
    tstate_confirmed: "Réservée",
    tstate_completed: "Effectuée",
    tstate_cancelled_by_traveller: "Annulée par vous",
    tstate_cancelled_by_driver: "Annulée par le chauffeur",
    tstate_no_show: "Marquée comme absence",
    driverReason: "Le chauffeur a indiqué : {reason}",
    shareTitle: "Partager votre course",
    shareBody:
      "Envoyez ce lien à une personne de confiance. Il montre le chauffeur, la voiture et la plaque, rien d’autre, et cesse de fonctionner à la fin de la course.",
    shareOnce: "Ce lien n’est affiché qu’une fois. Copiez-le avant de quitter la page.",
    copyLink: "Copier le lien",
    copied: "Copié",
    newLink: "Créer un lien de partage",
    newLinkHint: "Un nouveau lien remplace l’ancien.",
    cancelRideTraveller: "Annuler cette course",
    cancelReasonOptional: "Raison (facultatif, visible par le chauffeur)",
    confirmCancelRide: "Oui, annuler",
    keepRide: "Garder la course",
    reviewDriver: "Évaluez votre chauffeur",
    yourReviewN: "Votre avis : {n}/5",
    reviewBlindTraveller: "L’avis du chauffeur s’affiche quand vous avez tous deux écrit, ou après 14 jours.",
    backToRides: "Toutes mes courses",
    sharedTitle: "{name} est dans une course réservée via Mshwar",
    sharedTraveller: "Une personne que vous connaissez",
    sharedBody:
      "Quelqu’un a partagé ceci pour que vous sachiez qui conduit. Mshwar a vérifié les documents du chauffeur.",
    sharedEnded: "Cette course est terminée.",
    sharedGone: "Ce lien a expiré ou a été remplacé.",
    sharedWorried: "Si vous êtes inquiet, appelez-les d’abord. En cas d’urgence, composez le 112.",
    directoryTitle: "Chauffeurs vérifiés au Liban",
    filterArea: "Destination",
    anyArea: "Partout",
    directoryEmpty: "Aucun chauffeur vérifié ici pour l’instant.",
    about: "À propos",
    vehiclesTitle: "Véhicules",
    reviewsTitle: "Avis des voyageurs",
    noReviews: "Pas encore d’avis.",
    driverNotListed: "Ce chauffeur n’est pas référencé actuellement.",
    howItWorks: "Comment réserver",
    how1: "Envoyez une demande : où, quand, combien.",
    how2: "Les chauffeurs vérifiés de la zone envoient un prix fixe.",
    how3: "Réservez. Vous recevez la plaque, le téléphone et un lien à partager.",
    how4: "Payez le chauffeur dans la voiture. Mshwar ne prend rien.",
    signInToBook: "Connectez-vous pour demander un prix",
    legTitle: "Entre les étapes",
    legNone: "Pas encore de transport vérifié de {from} à {to}.",
    legAskDriver: "Demander à un chauffeur vérifié",
    legAllTransport: "Tous les transports pour {name}",
    nearbyTitle: "Lieux vérifiés près de {place}",
    nearbyEat: "Manger",
    nearbyStay: "Dormir",
    nearbyNone: "Rien de vérifié à moins de 15 km.",
  },
};

export type LocalCopy = Record<LocalKey, string>;

export function useLocalCopy(): LocalCopy {
  const { locale } = useLocale();
  return localCopy[locale];
}
