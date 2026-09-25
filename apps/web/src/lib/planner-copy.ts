import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

export type PlannerKey =
  | "startTitle"
  | "startHint"
  | "searchPlace"
  | "searchPlaceholder"
  | "dropPin"
  | "useLocation"
  | "locationDenied"
  | "manualEntry"
  | "saveStart"
  | "savedStart"
  | "precisePermission"
  | "mapFallback"
  | "planTitle"
  | "planHint"
  | "optimize"
  | "infeasible"
  | "metricsUnavailable"
  | "weatherWarning"
  | "noWarning"
  | "forecastUnavailable"
  | "replanAffected"
  | "replanNone"
  | "before"
  | "after"
  | "indoor"
  | "outdoor"
  | "weatherSensitive"
  | "thresholdsTitle"
  | "thresholdsHint"
  | "title"
  | "body"
  | "placeholder"
  | "build"
  | "clarify"
  | "assumptions"
  | "degraded"
  | "timeline"
  | "travel"
  | "cost"
  | "total"
  | "lock"
  | "unlock"
  | "regenerate"
  | "replace"
  | "accept"
  | "cancel"
  | "refine"
  | "apply"
  | "versions"
  | "sponsored"
  | "estimated"
  | "fromPrice"
  | "quote"
  | "why"
  | "booking"
  | "updateError"
  | "aiQuotaExceeded"
  | "aiCapacityReached"
  | "rateLimited"
  | "tripLabel"
  | "sealed"
  | "plannerKicker"
  | "pageTitle"
  | "pageBody"
  | "moodLabel"
  | "emptyKicker"
  | "emptyHeading"
  | "emptyTitle"
  | "emptyBody"
  | "takingShape"
  | "editableNote"
  | "savedPlanNote"
  | "noSavedPlan"
  | "flowStepOf"
  | "flowStepDestination"
  | "flowStepDetails"
  | "flowStepReview"
  | "flowChooseTitle"
  | "flowChooseHint"
  | "flowDetailsTitle"
  | "flowDetailsHint"
  | "flowDateLabel"
  | "flowPartyLabel"
  | "flowBudgetLabel"
  | "flowStrictLabel"
  | "flowVibeLabel"
  | "flowVibePlaceholder"
  | "flowBack"
  | "flowContinue"
  | "flowGenerate"
  | "flowGenerating"
  | "flowStartOver"
  | "flowReviewTitle"
  | "flowReviewHint"
  | "flowAdvancedTitle"
  | "flowAdvancedHint"
  | "flowOpenGroup"
  | "flowChangeDestination"
  | "flowNoDestinations"
  | "flowRegenerating"
  | "flowSelected"
  | "modeAi"
  | "modeManual"
  | "modeAiHint"
  | "modeManualHint"
  | "flowStepPlaces"
  | "flowPickTitle"
  | "flowPickHint"
  | "flowPickAdd"
  | "flowPickAdded"
  | "flowPickEmpty"
  | "flowSelectedCount"
  | "flowReorderHint"
  | "flowMoveUp"
  | "flowMoveDown"
  | "flowRemove"
  | "flowSave"
  | "flowSaving"
  | "flowYourDay"
  | "flowAddMore"
  | "flowManualNeedPicks"
  | "flowManualReviewHint"
  | "flowEditManual"
  | "flowNoOverlap"
  | "stopsLabel"
  | "estimateLabel"
  | "ofBudget"
  | "partyLabel"
  | "fineTune"
  | "fineTuneBody"
  | "previewAction"
  | "previewNote"
  | "suggestionsLabel"
  | "suggestion1"
  | "suggestion2"
  | "suggestion3"
  | "routeStart"
  | "flowMultiDestHint"
  | "flowDestinationsChosen"
  | "flowAllDestinations"
  | "flowClearTowns"
  | "flowFilterTown"
  | "flowStepSettings"
  | "flowContinueToDetails"
  | "flowContinueToPlaces"
  | "dayPanelTitle"
  | "dayPanelEmpty"
  | "dayPanelShow"
  | "dayPanelHide"
  | "dayClearAll"
  | "dayStopsCount"
  | "dayEndsBy"
  | "dayCheckChecking"
  | "dayCheckDriving"
  | "dayCheckFits"
  | "dayCheckBlocked"
  | "dayReorder"
  | "dayReorderSaves"
  | "daySplit"
  | "daySaveAnyway"
  | "issueRegionSpread"
  | "issueLongTransfer"
  | "issueTravelHeavy"
  | "issueDayOverflow"
  | "issueClosedThatDay"
  | "issueAfterHours"
  | "issueLongWait"
  | "issueHoursUnknown"
  | "issueRouteUnavailable"
  | "stopArrives"
  | "stopOpenBetween"
  | "stopHoursUnknown"
  | "stopDriveFrom"
  | "stopWaits"
  | "addToDay"
  | "destinationPlaces"
  | "replacementsTitle"
  | "priceOnRequest"
  | "onRequestCount"
  | "totalFrom"
  | "totalRange"
  | "perPerson"
  | "perPersonRange"
  | "dayCostTitle"
  | "dayCostBody"
  | "basis_fixed"
  | "basis_free"
  | "basis_from"
  | "basis_range"
  | "basis_estimated"
  | "basis_typical_spend"
  | "basis_per_night_from"
  | "basis_driver_day_rate"
  | "basis_exchange_rate"
  | "basis_on_request"
  | "unitTimes"
  | "budget_within"
  | "budget_over"
  | "budget_may_exceed"
  | "otherCurrency"
  | "driverTitle"
  | "driverBody"
  | "driverPickup"
  | "driverSend"
  | "driverSent"
  | "priceSource"
  | "dayTitle"
  | "dayBody"
  | "role_meal"
  | "role_sight"
  | "role_activity"
  | "role_stay"
  | "role_service"
  | "role_exchange"
  | "status_empty"
  | "status_skipped"
  | "askedFor"
  | "reason_no_trusted_match"
  | "reason_closed_that_day"
  | "reason_opens_too_late"
  | "reason_closes_too_early"
  | "reason_does_not_fit_the_day"
  | "reason_too_late_for_the_time_asked"
  | "reason_over_the_budget"
  | "reason_already_in_the_day"
  | "reason_travel_unavailable"
  | "reason_office_without_location"
  | "flag_check_times"
  | "flag_outside_destination"
  | "flag_long_wait"
  | "flag_hours_unknown"
  | "flag_meal_unconfirmed"
  | "flag_needs_unconfirmed"
  | "tripDay"
  | "otherOptions"
  | "hideOptions"
  | "useOption"
  | "noOptions"
  | "optionsLoading"
  | "optionsFailed"
  | "patchPreview"
  | "optionDistance"
  | "flag_quote_required"
  | "flag_estimated_price"
  | "trust_checked_by_mshwar"
  | "trust_licensed_claimed"
  | "trust_verified_organisation"
  | "trust_changer"
  | "action_call"
  | "action_whatsapp"
  | "action_reserve"
  | "action_book"
  | "checkInFrom"
  | "driveMinutes"
  | "freeMinutes"
  | "understoodTitle"
  | "understoodDriver"
  | "understoodNight"
  | "understoodOptional"
  | "understoodAvoid"
  | "understoodUnclear"
  | "meal_breakfast"
  | "meal_brunch"
  | "meal_lunch"
  | "meal_dinner"
  | "meal_snack";

export const plannerCopy: Record<Locale, Record<PlannerKey, string>> = {
  en: {
    startTitle: "Where should this plan start?",
    startHint: "Search, drop a pin, or type a place. Device location is optional and never the only way in.",
    searchPlace: "Search a place",
    searchPlaceholder: "Hamra, Byblos, airport…",
    dropPin: "Drop a pin on the map",
    useLocation: "Use my location",
    locationDenied: "Location permission was denied. Search, pin, or type a place instead.",
    manualEntry: "Type a label and coordinates",
    saveStart: "Save as default start",
    savedStart: "Saved to your profile",
    precisePermission: "Precise location is requested only when you tap Use my location.",
    mapFallback: "Map tiles need a browser Maps key. The pin grid still works.",
    planTitle: "Route, weather and replan",
    planHint: "Travel times come from the routing service. Weather warnings never change bookings.",
    optimize: "Optimise stop order",
    infeasible: "No feasible plan honours locked stops, hours and return-by.",
    metricsUnavailable: "Travel time is unavailable from the routing provider. These are not estimates.",
    weatherWarning: "Weather warning",
    noWarning: "No weather warning for this plan.",
    forecastUnavailable: "Forecast unavailable — no warning shown.",
    replanAffected: "Rebuild weather-affected stops",
    replanNone: "No feasible alternative. The current plan was left unchanged.",
    before: "Before",
    after: "After",
    indoor: "Indoor",
    outdoor: "Outdoor",
    weatherSensitive: "Weather-sensitive",
    thresholdsTitle: "Weather warning thresholds",
    thresholdsHint: "Warnings name affected stops. They never cancel bookings.",
    title: "AI trip builder",
    body: "Describe a day in Arabic, Lebanese Arabic, English or French. Stops come from published inventory. Totals are summed from stored prices — the model never invents a place or a number.",
    placeholder: "A slow day in Byblos for two, or بدي يوم هادي بجبيل…",
    build: "Build plan",
    clarify: "Answer and continue",
    assumptions: "Assumed defaults",
    degraded: "Natural-language planning is unavailable. This plan used structured filters only.",
    timeline: "Timeline",
    travel: "Travel",
    cost: "Cost breakdown",
    total: "Plan total",
    lock: "Lock stop",
    unlock: "Unlock",
    regenerate: "Regenerate the rest",
    replace: "Replace this stop",
    accept: "Accept replacement",
    cancel: "Cancel",
    refine: "Ask for a change",
    apply: "Apply this change",
    versions: "Version history",
    sponsored: "Sponsored",
    estimated: "Estimated",
    fromPrice: "From",
    quote: "Quote required",
    why: "Why this stop",
    booking: "Booking",
    updateError: "Could not update the plan.",
    aiQuotaExceeded: "You've reached today's AI planning limit. It resets at midnight Beirut time.",
    aiCapacityReached: "AI planning is busy right now. Please try again later.",
    rateLimited: "You're going a little fast. Please wait a moment and try again.",
    tripLabel: "Trip {id}",
    sealed: "sealed",
    plannerKicker: "The Mshwar planner",
    pageTitle: "Your day. Your way.",
    pageBody: "A few details. A little inspiration. Something worth going out for.",
    moodLabel: "What are you in the mood for?",
    emptyKicker: "Room for something good",
    emptyHeading: "Where will the day take you?",
    emptyTitle: "Start with a feeling. We’ll help with the rest.",
    emptyBody: "Describe your day to explore a sample plan built from published places.",
    takingShape: "Your day is taking shape",
    editableNote: "Stop order is editable. Travel times, opening hours and availability still need live verification.",
    savedPlanNote: "This is your saved itinerary. Start a new plan or refine it to make changes.",
    noSavedPlan: "This trip has no saved plan yet. Describe your day below to generate one.",
    flowStepOf: "Step {n} of {total}",
    flowStepDestination: "Destination",
    flowStepDetails: "Details",
    flowStepReview: "Itinerary",
    flowChooseTitle: "Where do you want to go?",
    flowChooseHint: "Pick a destination and we'll build a real day plan from published places there.",
    flowDetailsTitle: "Trip details",
    flowDetailsHint: "A few basics so the plan fits your day. You can change everything later.",
    flowDateLabel: "Date",
    flowPartyLabel: "Group size",
    flowBudgetLabel: "Budget (USD)",
    flowStrictLabel: "Keep the plan within this budget",
    flowVibeLabel: "Anything specific? (optional)",
    flowVibePlaceholder: "e.g. relaxed pace, good food, sea views, family-friendly",
    flowBack: "Back",
    flowContinue: "Continue",
    flowGenerate: "Generate itinerary",
    flowGenerating: "Building your day…",
    flowStartOver: "Start over",
    flowReviewTitle: "Your itinerary",
    flowReviewHint: "Saved to My Trips automatically. Refine it, swap stops or fine-tune the route below.",
    flowAdvancedTitle: "Advanced tools",
    flowAdvancedHint: "Optimise the route, check the weather and plan with a group.",
    flowOpenGroup: "Plan with a group",
    flowChangeDestination: "Change",
    flowNoDestinations: "No destinations are available yet.",
    flowRegenerating: "Regenerating…",
    flowSelected: "Selected",
    modeAi: "Plan with AI",
    modeManual: "Build it myself",
    modeAiHint: "Tell us the vibe and we build the day.",
    modeManualHint: "Pick the places yourself and arrange the day.",
    flowStepPlaces: "Places",
    flowPickTitle: "Pick your places",
    flowPickHint: "Add real published places, then arrange them into your day.",
    flowPickAdd: "Add",
    flowPickAdded: "Added",
    flowPickEmpty: "No places are published for this destination yet.",
    flowSelectedCount: "{n} selected",
    flowReorderHint: "Use the arrows to set the order of your day.",
    flowMoveUp: "Move up",
    flowMoveDown: "Move down",
    flowRemove: "Remove",
    flowSave: "Save itinerary",
    flowSaving: "Saving…",
    flowYourDay: "Your day",
    flowAddMore: "Add more places",
    flowManualNeedPicks: "Add at least one place to continue.",
    flowManualReviewHint: "Saved to My Trips. Times are estimated from each place’s typical visit length.",
    flowEditManual: "Edit manually",
    flowNoOverlap: "Stops are scheduled back-to-back, so times never overlap.",
    stopsLabel: "stops",
    estimateLabel: "Your experience estimate",
    ofBudget: "of {budget} budget",
    partyLabel: "people",
    fineTune: "Fine-tune the route",
    fineTuneBody: "Set where the day starts, then optimise the stop order and check the weather.",
    previewAction: "Preview",
    previewNote:
      "Preview planner uses published inventory and stored prices. Live AI and route validation may be limited.",
    suggestionsLabel: "Try",
    suggestion1: "A slow day by the sea for two",
    suggestion2: "Cedars and a mountain lunch with family",
    suggestion3: "بدي يوم هادي بجبيل",
    routeStart: "Starting point",
    flowMultiDestHint: "Pick as many towns as you like — we will tell you if they are too far apart for one day.",
    flowDestinationsChosen: "{n} chosen",
    flowAllDestinations: "All chosen towns",
    flowClearTowns: "Clear",
    flowFilterTown: "Filter by town",
    flowStepSettings: "Your day",
    flowContinueToDetails: "Next: your day",
    flowContinueToPlaces: "Next: pick places",
    dayPanelTitle: "Your day",
    dayPanelEmpty: "Nothing picked yet. Add a place and the day builds itself around opening times and driving.",
    dayPanelShow: "Show your day",
    dayPanelHide: "Hide your day",
    dayClearAll: "Clear all",
    dayStopsCount: "{n} stops",
    dayEndsBy: "Back by {time}",
    dayCheckChecking: "Checking distances, traffic and opening times…",
    dayCheckDriving: "{minutes} min driving · {km} km",
    dayCheckFits: "This day fits comfortably.",
    dayCheckBlocked: "Something needs to change before this day can be saved.",
    dayReorder: "Use the shortest driving order",
    dayReorderSaves: "saves about {n} min",
    daySplit: "Split into {n} days",
    daySaveAnyway: "Save it anyway",
    issueRegionSpread: "{a} and {b} are about {km} km apart — too far for one day.",
    issueLongTransfer: "{a} is a {n} min drive from the stop before it.",
    issueTravelHeavy: "{n} of your {total} min day would be spent driving.",
    issueDayOverflow: "{a} ends {n} min after you wanted to be back.",
    issueClosedThatDay: "{a} is closed on that date.",
    issueAfterHours: "{a} runs past its closing time.",
    issueLongWait: "You would reach {a} {n} min before it opens.",
    issueHoursUnknown: "We have no opening hours for {a} — check before you go.",
    issueRouteUnavailable: "No live driving time for {a}; the estimate is approximate.",
    stopArrives: "Arrive {time}",
    stopOpenBetween: "Open {opens}–{closes}",
    stopHoursUnknown: "Opening hours unknown",
    stopDriveFrom: "{minutes} min · {km} km",
    stopWaits: "{n} min wait",
    addToDay: "Add to your day",
    destinationPlaces: "{n} places to plan from",
    replacementsTitle: "Alternatives",
    priceOnRequest: "Price on request",
    onRequestCount: "{count} on request – ask the place, not counted",
    totalFrom: "from {amount}",
    totalRange: "{low} – {high}",
    perPerson: "{amount} per person",
    perPersonRange: "{low} – {high} per person",
    dayCostTitle: "What the day costs",
    dayCostBody: "Only prices places and drivers published. Nothing unknown is counted as free.",
    basis_fixed: "Fixed price",
    basis_free: "Free",
    basis_from: "From",
    basis_range: "Price range",
    basis_estimated: "Estimated by the place",
    basis_typical_spend: "Typical spend per person",
    basis_per_night_from: "From, per room per night",
    basis_driver_day_rate: "Drivers' published day rates",
    basis_exchange_rate: "No fee – the changer's rate applies",
    basis_on_request: "Price on request",
    unitTimes: "{count} × {amount}",
    budget_within: "Within your budget of {budget}",
    budget_over: "Over your budget of {budget}",
    budget_may_exceed: "May go over your budget of {budget}",
    otherCurrency: "{count} price in another currency, shown but not added",
    driverTitle: "A driver for this day",
    driverBody:
      "We send your plan to the verified drivers who cover it. Each quotes a fixed price and you choose one in Rides. Nothing is booked until you do.",
    driverPickup: "Where should the driver pick you up?",
    driverSend: "Ask drivers for prices",
    driverSent: "Sent. Fixed prices from verified drivers will appear in Rides.",
    priceSource: "Published by {source} · checked {date}",
    dayTitle: "Your day, step by step",
    dayBody:
      "Every step you asked for, in your order. Places come only from trusted listings; a step we could not fill says why.",
    role_meal: "Meal",
    role_sight: "Sight",
    role_activity: "Activity",
    role_stay: "Night",
    role_service: "Errand",
    role_exchange: "Money changer",
    status_empty: "Not filled",
    status_skipped: "Skipped – it did not fit",
    askedFor: "You asked for: {text}",
    reason_no_trusted_match: "No trusted place of this kind here yet.",
    reason_closed_that_day: "The only matching places are closed that day.",
    reason_opens_too_late: "Matching places open too late for this step.",
    reason_closes_too_early: "Matching places close before this step would end.",
    reason_does_not_fit_the_day: "It does not fit in the time your day allows.",
    reason_too_late_for_the_time_asked: "The day cannot get there by the time you asked.",
    reason_over_the_budget: "Matching places are over your strict budget.",
    reason_already_in_the_day: "The only matching place is already another step.",
    reason_travel_unavailable: "We could not work out the travel time.",
    reason_office_without_location: "The changer's office has no location on record.",
    flag_check_times: "Check showtimes",
    flag_outside_destination: "Outside your destination",
    flag_long_wait: "Free time before this step",
    flag_hours_unknown: "Hours not confirmed",
    flag_meal_unconfirmed: "Meals served not confirmed",
    flag_needs_unconfirmed: "Your needs not confirmed here",
    tripDay: "Day {day}",
    otherOptions: "Other options",
    hideOptions: "Hide options",
    useOption: "Use this place",
    noOptions: "No other trusted place fits this step yet.",
    optionsLoading: "Looking for trusted places…",
    optionsFailed: "We could not load the options. Try again.",
    patchPreview: "Your day would become:",
    optionDistance: "{km} km from the step before",
    flag_quote_required: "Price on request",
    flag_estimated_price: "Price not fixed",
    trust_checked_by_mshwar: "Visited by Mshwar",
    trust_licensed_claimed: "Licence checked",
    trust_verified_organisation: "Verified business",
    trust_changer: "Registered money changer",
    action_call: "Call",
    action_whatsapp: "WhatsApp",
    action_reserve: "Reserve online",
    action_book: "Book the stay",
    checkInFrom: "Check-in from {time}",
    driveMinutes: "{minutes} min drive",
    freeMinutes: "{minutes} min free before",
    understoodTitle: "Here's your day as I understood it",
    understoodDriver: "With a driver",
    understoodNight: "Ends with a night away",
    understoodOptional: "if there is time",
    understoodAvoid: "Not: {items}",
    understoodUnclear: "Not sure what you meant by: {text}",
    meal_breakfast: "Breakfast",
    meal_brunch: "Brunch",
    meal_lunch: "Lunch",
    meal_dinner: "Dinner",
    meal_snack: "A bite",
  },
  ar: {
    startTitle: "من أين تبدأ هذه الخطة؟",
    startHint: "ابحث أو أسقط دبوساً أو اكتب مكاناً. موقع الجهاز اختياري وليس الطريق الوحيد.",
    searchPlace: "ابحث عن مكان",
    searchPlaceholder: "الحمرا، جبيل، المطار…",
    dropPin: "أسقط دبوساً على الخريطة",
    useLocation: "استخدم موقعي",
    locationDenied: "رُفض إذن الموقع. استخدم البحث أو الدبوس أو الإدخال اليدوي.",
    manualEntry: "اكتب اسماً وإحداثيات",
    saveStart: "احفظ كنقطة انطلاق افتراضية",
    savedStart: "حُفظ في ملفك",
    precisePermission: "يُطلب الموقع الدقيق فقط عند الضغط على استخدم موقعي.",
    mapFallback: "بلاطات الخريطة تحتاج مفتاح متصفح. شبكة الدبابيس ما زالت تعمل.",
    planTitle: "المسار والطقس وإعادة التخطيط",
    planHint: "أوقات التنقل من خدمة التوجيه. تحذيرات الطقس لا تغيّر الحجوزات.",
    optimize: "حسّن ترتيب المحطات",
    infeasible: "لا توجد خطة ممكنة تحترم المحطات المقفلة والساعات ووقت العودة.",
    metricsUnavailable: "وقت التنقل غير متاح من المزود. هذه ليست تقديرات.",
    weatherWarning: "تحذير طقس",
    noWarning: "لا يوجد تحذير طقس لهذه الخطة.",
    forecastUnavailable: "التوقع غير متاح — لن يُعرض تحذير.",
    replanAffected: "أعد بناء المحطات المتأثرة بالطقس",
    replanNone: "لا بديل ممكن. بقيت الخطة الحالية كما هي.",
    before: "قبل",
    after: "بعد",
    indoor: "داخلي",
    outdoor: "خارجي",
    weatherSensitive: "حسّاس للطقس",
    thresholdsTitle: "عتبات تحذير الطقس",
    thresholdsHint: "التحذيرات تسمّي المحطات المتأثرة ولا تلغي الحجوزات.",
    title: "منشئ الرحلة",
    body: "صف يوماً بالعربية أو الإنكليزية أو الفرنسية. المحطات من المخزون المنشور. المجاميع تُحسب من الأسعار المخزّنة.",
    placeholder: "بدي يوم هادي بجبيل لشخصين…",
    build: "إنشاء الخطة",
    clarify: "أجب وتابع",
    assumptions: "افتراضات ظاهرة",
    degraded: "التخطيط باللغة الطبيعية غير متاح. استُخدمت عوامل التصفية المنظمة فقط.",
    timeline: "الجدول",
    travel: "الانتقال",
    cost: "تفصيل التكلفة",
    total: "مجموع الخطة",
    lock: "تثبيت المحطة",
    unlock: "إلغاء التثبيت",
    regenerate: "إعادة توليد الباقي",
    replace: "استبدال هذه المحطة",
    accept: "قبول البديل",
    cancel: "إلغاء",
    refine: "اطلب تغييراً",
    apply: "تطبيق التغيير",
    versions: "سجل النسخ",
    sponsored: "مدعوم",
    estimated: "تقديري",
    fromPrice: "ابتداءً من",
    quote: "يتطلب عرض سعر",
    why: "لماذا هذه المحطة",
    booking: "الحجز",
    updateError: "تعذّر تحديث الخطة.",
    aiQuotaExceeded: "لقد بلغت حدّ التخطيط بالذكاء الاصطناعي لهذا اليوم. يُعاد ضبطه عند منتصف الليل بتوقيت بيروت.",
    aiCapacityReached: "خدمة التخطيط بالذكاء الاصطناعي مشغولة حاليًا. يُرجى المحاولة لاحقًا.",
    rateLimited: "طلباتك سريعة بعض الشيء. يُرجى الانتظار قليلًا ثم المحاولة مجددًا.",
    tripLabel: "رحلة {id}",
    sealed: "مُغلقة",
    plannerKicker: "مخطِّط مشوار",
    pageTitle: "يومك. على طريقتك.",
    pageBody: "بعض التفاصيل. قليل من الإلهام. وشيء يستحق الخروج من أجله.",
    moodLabel: "ما الذي تشعر برغبة فيه؟",
    emptyKicker: "مساحة لشيء جميل",
    emptyHeading: "إلى أين سيأخذك اليوم؟",
    emptyTitle: "ابدأ بإحساس. ونساعدك في الباقي.",
    emptyBody: "صف يومك لتستكشف خطة عيّنة مبنية من أماكن منشورة.",
    takingShape: "يومك يتشكّل",
    editableNote: "يمكن تعديل ترتيب المحطات. أوقات التنقل وساعات العمل والتوفر تحتاج إلى تحقق مباشر.",
    savedPlanNote: "هذه خطتك المحفوظة. ابدأ خطة جديدة أو حسّنها لإجراء تغييرات.",
    noSavedPlan: "لا توجد خطة محفوظة لهذه الرحلة بعد. صف يومك بالأسفل لإنشاء واحدة.",
    flowStepOf: "خطوة {n} من {total}",
    flowStepDestination: "الوجهة",
    flowStepDetails: "التفاصيل",
    flowStepReview: "البرنامج",
    flowChooseTitle: "إلى أين تريد أن تذهب؟",
    flowChooseHint: "اختر وجهة وسننشئ لك خطة يوم حقيقية من الأماكن المنشورة هناك.",
    flowDetailsTitle: "تفاصيل الرحلة",
    flowDetailsHint: "بعض الأساسيات لتناسب الخطة يومك. يمكنك تغيير كل شيء لاحقاً.",
    flowDateLabel: "التاريخ",
    flowPartyLabel: "عدد الأشخاص",
    flowBudgetLabel: "الميزانية (دولار)",
    flowStrictLabel: "أبقِ الخطة ضمن هذه الميزانية",
    flowVibeLabel: "أي شيء محدد؟ (اختياري)",
    flowVibePlaceholder: "مثال: إيقاع هادئ، طعام جيد، إطلالة على البحر، مناسب للعائلة",
    flowBack: "رجوع",
    flowContinue: "متابعة",
    flowGenerate: "أنشئ البرنامج",
    flowGenerating: "نجهّز يومك…",
    flowStartOver: "ابدأ من جديد",
    flowReviewTitle: "برنامجك",
    flowReviewHint: "يُحفظ في رحلاتي تلقائياً. حسّنه أو بدّل المحطات أو اضبط المسار بالأسفل.",
    flowAdvancedTitle: "أدوات متقدمة",
    flowAdvancedHint: "حسّن المسار، تحقق من الطقس، وخطّط مع مجموعة.",
    flowOpenGroup: "التخطيط مع مجموعة",
    flowChangeDestination: "تغيير",
    flowNoDestinations: "لا توجد وجهات متاحة بعد.",
    flowRegenerating: "إعادة الإنشاء…",
    flowSelected: "مختارة",
    modeAi: "التخطيط بالذكاء الاصطناعي",
    modeManual: "أبنيها بنفسي",
    modeAiHint: "أخبرنا بالأجواء وسنبني اليوم.",
    modeManualHint: "اختر الأماكن بنفسك ورتّب يومك.",
    flowStepPlaces: "الأماكن",
    flowPickTitle: "اختر أماكنك",
    flowPickHint: "أضف أماكن حقيقية منشورة ثم رتّبها في يومك.",
    flowPickAdd: "إضافة",
    flowPickAdded: "مُضاف",
    flowPickEmpty: "لا توجد أماكن منشورة لهذه الوجهة بعد.",
    flowSelectedCount: "{n} مختارة",
    flowReorderHint: "استخدم الأسهم لترتيب يومك.",
    flowMoveUp: "تحريك لأعلى",
    flowMoveDown: "تحريك لأسفل",
    flowRemove: "إزالة",
    flowSave: "حفظ البرنامج",
    flowSaving: "جارٍ الحفظ…",
    flowYourDay: "يومك",
    flowAddMore: "إضافة أماكن أخرى",
    flowManualNeedPicks: "أضف مكاناً واحداً على الأقل للمتابعة.",
    flowManualReviewHint: "محفوظ في رحلاتي. الأوقات تقديرية بناءً على مدة الزيارة المعتادة لكل مكان.",
    flowEditManual: "تعديل يدوي",
    flowNoOverlap: "المحطات مجدولة تِباعاً، لذا لا تتداخل الأوقات.",
    stopsLabel: "محطات",
    estimateLabel: "تقدير تجربتك",
    ofBudget: "من ميزانية {budget}",
    partyLabel: "أشخاص",
    fineTune: "اضبط المسار",
    fineTuneBody: "حدّد نقطة انطلاق اليوم، ثم رتّب المحطات وتحقّق من الطقس.",
    previewAction: "معاينة",
    previewNote:
      "يستخدم المخطط التجريبي العروض المنشورة والأسعار المخزّنة. قد يكون الذكاء الاصطناعي والتحقق من المسار محدودين.",
    suggestionsLabel: "جرّب",
    suggestion1: "يوم هادئ على البحر لشخصين",
    suggestion2: "الأرز وغداء جبلي مع العائلة",
    suggestion3: "بدي يوم هادي بجبيل",
    routeStart: "نقطة الانطلاق",
    flowMultiDestHint: "اختر ما تشاء من المدن — وسنخبرك إن كانت متباعدة أكثر من اللازم ليوم واحد.",
    flowDestinationsChosen: "{n} مختارة",
    flowAllDestinations: "كل المدن المختارة",
    flowClearTowns: "مسح",
    flowFilterTown: "تصفية حسب المدينة",
    flowStepSettings: "يومك",
    flowContinueToDetails: "التالي: يومك",
    flowContinueToPlaces: "التالي: اختر الأماكن",
    dayPanelTitle: "يومك",
    dayPanelEmpty: "لم تختر شيئاً بعد. أضف مكاناً وسيُبنى اليوم حول أوقات العمل والقيادة.",
    dayPanelShow: "أظهر يومك",
    dayPanelHide: "أخفِ يومك",
    dayClearAll: "امسح الكل",
    dayStopsCount: "{n} محطات",
    dayEndsBy: "العودة قبل {time}",
    dayCheckChecking: "نتحقق من المسافات وحركة السير وأوقات العمل…",
    dayCheckDriving: "{minutes} دقيقة قيادة · {km} كم",
    dayCheckFits: "هذا اليوم مريح ومناسب.",
    dayCheckBlocked: "هناك ما يجب تعديله قبل حفظ هذا اليوم.",
    dayReorder: "استخدم الترتيب الأقصر قيادةً",
    dayReorderSaves: "يوفّر نحو {n} دقيقة",
    daySplit: "قسّمه إلى {n} أيام",
    daySaveAnyway: "احفظه على أي حال",
    issueRegionSpread: "{a} و{b} تبعدان نحو {km} كم — بعيدتان جداً ليوم واحد.",
    issueLongTransfer: "{a} تبعد {n} دقيقة قيادة عن المحطة السابقة.",
    issueTravelHeavy: "{n} دقيقة من أصل {total} دقيقة ستمضيها في السيارة.",
    issueDayOverflow: "{a} ينتهي بعد {n} دقيقة من موعد عودتك.",
    issueClosedThatDay: "{a} مغلق في ذلك التاريخ.",
    issueAfterHours: "{a} يمتد بعد وقت الإغلاق.",
    issueLongWait: "ستصل إلى {a} قبل {n} دقيقة من فتحه.",
    issueHoursUnknown: "لا نملك أوقات عمل {a} — تحقّق قبل الذهاب.",
    issueRouteUnavailable: "لا يوجد زمن قيادة مباشر لـ{a}؛ التقدير تقريبي.",
    stopArrives: "الوصول {time}",
    stopOpenBetween: "مفتوح {opens}–{closes}",
    stopHoursUnknown: "أوقات العمل غير معروفة",
    stopDriveFrom: "{minutes} دقيقة · {km} كم",
    stopWaits: "انتظار {n} دقيقة",
    addToDay: "أضفه إلى يومك",
    destinationPlaces: "{n} مكاناً للتخطيط منها",
    replacementsTitle: "بدائل",
    priceOnRequest: "السعر عند الطلب",
    onRequestCount: "{count} عند الطلب – اسأل المكان، غير محسوب",
    totalFrom: "ابتداءً من {amount}",
    totalRange: "{low} – {high}",
    perPerson: "{amount} للشخص",
    perPersonRange: "{low} – {high} للشخص",
    dayCostTitle: "كلفة اليوم",
    dayCostBody: "نعتمد فقط الأسعار التي نشرتها الأماكن والسائقون. لا نحسب أي سعر مجهول كأنه مجاني.",
    basis_fixed: "سعر ثابت",
    basis_free: "مجاني",
    basis_from: "ابتداءً من",
    basis_range: "نطاق سعري",
    basis_estimated: "تقدير من المكان",
    basis_typical_spend: "متوسط إنفاق الشخص",
    basis_per_night_from: "ابتداءً من، للغرفة في الليلة",
    basis_driver_day_rate: "الأسعار اليومية المنشورة للسائقين",
    basis_exchange_rate: "بلا رسوم – يُطبَّق سعر الصرّاف",
    basis_on_request: "السعر عند الطلب",
    unitTimes: "{count} × {amount}",
    budget_within: "ضمن ميزانيتك البالغة {budget}",
    budget_over: "يتجاوز ميزانيتك البالغة {budget}",
    budget_may_exceed: "قد يتجاوز ميزانيتك البالغة {budget}",
    otherCurrency: "{count} سعر بعملة أخرى، معروض وغير مُضاف",
    driverTitle: "سائق لهذا اليوم",
    driverBody:
      "نرسل خطتك إلى السائقين الموثّقين الذين يغطّونها. يقدّم كل منهم سعرًا ثابتًا وتختار واحدًا في قسم الرحلات. لا يُحجز شيء قبل أن تختار.",
    driverPickup: "من أين يقلّك السائق؟",
    driverSend: "اطلب أسعارًا من السائقين",
    driverSent: "تم الإرسال. ستظهر أسعار السائقين الموثّقين الثابتة في قسم الرحلات.",
    priceSource: "منشور من {source} · جرى التحقّق في {date}",
    dayTitle: "يومك خطوة بخطوة",
    dayBody: "كل خطوة طلبتها، بترتيبك. الأماكن من منشورات موثوقة فقط؛ والخطوة التي لم نستطع ملأها تذكر السبب.",
    role_meal: "وجبة",
    role_sight: "معلم",
    role_activity: "نشاط",
    role_stay: "مبيت",
    role_service: "مشوار",
    role_exchange: "صرّاف",
    status_empty: "غير مملوءة",
    status_skipped: "تم تخطيها – لم تتّسع",
    askedFor: "طلبت: {text}",
    reason_no_trusted_match: "لا يوجد بعد مكان موثوق من هذا النوع هنا.",
    reason_closed_that_day: "الأماكن المطابقة مغلقة في ذلك اليوم.",
    reason_opens_too_late: "الأماكن المطابقة تفتح متأخرة على هذه الخطوة.",
    reason_closes_too_early: "الأماكن المطابقة تُغلق قبل نهاية هذه الخطوة.",
    reason_does_not_fit_the_day: "لا تتّسع ضمن وقت يومك.",
    reason_too_late_for_the_time_asked: "لا يمكن الوصول في الوقت الذي طلبته.",
    reason_over_the_budget: "الأماكن المطابقة تتجاوز ميزانيتك المحدّدة.",
    reason_already_in_the_day: "المكان المطابق الوحيد مستخدم في خطوة أخرى.",
    reason_travel_unavailable: "تعذّر حساب وقت التنقّل.",
    reason_office_without_location: "لا يوجد موقع مسجّل لمكتب الصرّاف.",
    flag_check_times: "تحقّق من مواعيد العروض",
    flag_outside_destination: "خارج وجهتك",
    flag_long_wait: "وقت حرّ قبل هذه الخطوة",
    flag_hours_unknown: "ساعات العمل غير مؤكَّدة",
    flag_meal_unconfirmed: "الوجبات المقدَّمة غير مؤكَّدة",
    flag_needs_unconfirmed: "احتياجاتك غير مؤكَّدة هنا",
    tripDay: "اليوم {day}",
    otherOptions: "خيارات أخرى",
    hideOptions: "إخفاء الخيارات",
    useOption: "اختر هذا المكان",
    noOptions: "لا يوجد بعد مكان موثوق آخر يناسب هذه الخطوة.",
    optionsLoading: "نبحث عن أماكن موثوقة…",
    optionsFailed: "تعذّر تحميل الخيارات. حاول مجددًا.",
    patchPreview: "سيصبح يومك:",
    optionDistance: "{km} كم من الخطوة السابقة",
    flag_quote_required: "السعر عند الطلب",
    flag_estimated_price: "السعر غير ثابت",
    trust_checked_by_mshwar: "زاره فريق مشوار",
    trust_licensed_claimed: "جرى التحقّق من الترخيص",
    trust_verified_organisation: "مؤسسة موثّقة",
    trust_changer: "صرّاف مسجّل",
    action_call: "اتصل",
    action_whatsapp: "واتساب",
    action_reserve: "احجز عبر الإنترنت",
    action_book: "احجز الإقامة",
    checkInFrom: "تسجيل الدخول من {time}",
    driveMinutes: "{minutes} دقيقة بالسيارة",
    freeMinutes: "{minutes} دقيقة حرّة قبلها",
    understoodTitle: "هكذا فهمت يومك",
    understoodDriver: "مع سائق",
    understoodNight: "ينتهي بمبيت",
    understoodOptional: "إذا توفّر الوقت",
    understoodAvoid: "بدون: {items}",
    understoodUnclear: "لم أفهم تمامًا ما تقصده بـ: {text}",
    meal_breakfast: "فطور",
    meal_brunch: "برانش",
    meal_lunch: "غداء",
    meal_dinner: "عشاء",
    meal_snack: "لقمة سريعة",
  },
  fr: {
    startTitle: "D’où part ce plan ?",
    startHint: "Recherchez, déposez une épingle ou saisissez un lieu. La géolocalisation est facultative.",
    searchPlace: "Rechercher un lieu",
    searchPlaceholder: "Hamra, Byblos, aéroport…",
    dropPin: "Déposer une épingle",
    useLocation: "Utiliser ma position",
    locationDenied: "Permission refusée. Utilisez la recherche, l’épingle ou la saisie.",
    manualEntry: "Saisir un libellé et des coordonnées",
    saveStart: "Enregistrer comme départ par défaut",
    savedStart: "Enregistré dans le profil",
    precisePermission: "La position précise n’est demandée que si vous appuyez sur Utiliser ma position.",
    mapFallback: "Les tuiles carte nécessitent une clé navigateur. La grille d’épingles reste utilisable.",
    planTitle: "Itinéraire, météo et replanification",
    planHint:
      "Les temps de trajet viennent du service d’itinéraire. Les alertes météo ne modifient jamais les réservations.",
    optimize: "Optimiser l’ordre des arrêts",
    infeasible: "Aucun plan ne respecte les arrêts verrouillés, les horaires et l’heure de retour.",
    metricsUnavailable: "Le temps de trajet est indisponible. Ce ne sont pas des estimations.",
    weatherWarning: "Alerte météo",
    noWarning: "Aucune alerte météo pour ce plan.",
    forecastUnavailable: "Prévision indisponible — aucune alerte affichée.",
    replanAffected: "Reconstruire les arrêts touchés par la météo",
    replanNone: "Aucune alternative possible. Le plan actuel n’a pas été modifié.",
    before: "Avant",
    after: "Après",
    indoor: "Intérieur",
    outdoor: "Extérieur",
    weatherSensitive: "Sensible à la météo",
    thresholdsTitle: "Seuils d’alerte météo",
    thresholdsHint: "Les alertes nomment les arrêts concernés. Elles n’annulent jamais une réservation.",
    title: "Créateur de voyage",
    body: "Décrivez une journée en arabe, anglais ou français. Les arrêts viennent de l’inventaire publié. Les totaux sont calculés côté serveur.",
    placeholder: "Une journée lente à Byblos pour deux…",
    build: "Créer le plan",
    clarify: "Répondre et continuer",
    assumptions: "Hypothèses affichées",
    degraded: "La planification en langage naturel est indisponible. Filtres structurés uniquement.",
    timeline: "Chronologie",
    travel: "Trajet",
    cost: "Détail des coûts",
    total: "Total du plan",
    lock: "Verrouiller",
    unlock: "Déverrouiller",
    regenerate: "Régénérer le reste",
    replace: "Remplacer cet arrêt",
    accept: "Accepter le remplacement",
    cancel: "Annuler",
    refine: "Demander un changement",
    apply: "Appliquer",
    versions: "Historique des versions",
    sponsored: "Sponsorisé",
    estimated: "Estimé",
    fromPrice: "À partir de",
    quote: "Devis requis",
    why: "Pourquoi cet arrêt",
    booking: "Réservation",
    updateError: "Impossible de mettre à jour le plan.",
    aiQuotaExceeded:
      "Vous avez atteint la limite quotidienne de planification par IA. Elle se réinitialise à minuit, heure de Beyrouth.",
    aiCapacityReached: "La planification par IA est très sollicitée. Veuillez réessayer plus tard.",
    rateLimited: "Vous allez un peu vite. Patientez un instant puis réessayez.",
    tripLabel: "Voyage {id}",
    sealed: "scellé",
    plannerKicker: "Le planificateur Mshwar",
    pageTitle: "Votre journée. À votre façon.",
    pageBody: "Quelques détails. Un peu d’inspiration. Une vraie raison de sortir.",
    moodLabel: "De quoi avez-vous envie ?",
    emptyKicker: "De la place pour du bon",
    emptyHeading: "Où la journée vous mènera-t-elle ?",
    emptyTitle: "Partez d’une envie. On s’occupe du reste.",
    emptyBody: "Décrivez votre journée pour découvrir un plan exemple construit à partir de lieux publiés.",
    takingShape: "Votre journée prend forme",
    editableNote:
      "L’ordre des étapes est modifiable. Trajets, horaires et disponibilités restent à vérifier en direct.",
    savedPlanNote: "Voici votre itinéraire enregistré. Lancez un nouveau plan ou affinez-le pour le modifier.",
    noSavedPlan: "Ce voyage n’a pas encore de plan enregistré. Décrivez votre journée ci-dessous pour en générer un.",
    flowStepOf: "Étape {n} sur {total}",
    flowStepDestination: "Destination",
    flowStepDetails: "Détails",
    flowStepReview: "Itinéraire",
    flowChooseTitle: "Où voulez-vous aller ?",
    flowChooseHint: "Choisissez une destination et nous créerons un vrai plan de journée à partir des lieux publiés.",
    flowDetailsTitle: "Détails du voyage",
    flowDetailsHint: "Quelques bases pour adapter le plan à votre journée. Tout est modifiable ensuite.",
    flowDateLabel: "Date",
    flowPartyLabel: "Nombre de personnes",
    flowBudgetLabel: "Budget (USD)",
    flowStrictLabel: "Rester dans ce budget",
    flowVibeLabel: "Quelque chose de précis ? (facultatif)",
    flowVibePlaceholder: "ex. rythme tranquille, bonne cuisine, vue sur mer, en famille",
    flowBack: "Retour",
    flowContinue: "Continuer",
    flowGenerate: "Générer l'itinéraire",
    flowGenerating: "Création de votre journée…",
    flowStartOver: "Recommencer",
    flowReviewTitle: "Votre itinéraire",
    flowReviewHint:
      "Enregistré dans Mes voyages automatiquement. Affinez-le, changez des étapes ou ajustez l'itinéraire ci-dessous.",
    flowAdvancedTitle: "Outils avancés",
    flowAdvancedHint: "Optimisez l'itinéraire, vérifiez la météo et planifiez en groupe.",
    flowOpenGroup: "Planifier en groupe",
    flowChangeDestination: "Changer",
    flowNoDestinations: "Aucune destination n'est encore disponible.",
    flowRegenerating: "Régénération…",
    flowSelected: "Sélectionnée",
    modeAi: "Planifier avec l'IA",
    modeManual: "Le faire moi-même",
    modeAiHint: "Dites l'ambiance, on construit la journée.",
    modeManualHint: "Choisissez les lieux et organisez la journée.",
    flowStepPlaces: "Lieux",
    flowPickTitle: "Choisissez vos lieux",
    flowPickHint: "Ajoutez de vrais lieux publiés, puis organisez votre journée.",
    flowPickAdd: "Ajouter",
    flowPickAdded: "Ajouté",
    flowPickEmpty: "Aucun lieu publié pour cette destination pour l'instant.",
    flowSelectedCount: "{n} sélectionné(s)",
    flowReorderHint: "Utilisez les flèches pour ordonner votre journée.",
    flowMoveUp: "Monter",
    flowMoveDown: "Descendre",
    flowRemove: "Retirer",
    flowSave: "Enregistrer l'itinéraire",
    flowSaving: "Enregistrement…",
    flowYourDay: "Votre journée",
    flowAddMore: "Ajouter d'autres lieux",
    flowManualNeedPicks: "Ajoutez au moins un lieu pour continuer.",
    flowManualReviewHint: "Enregistré dans Mes voyages. Les horaires sont estimés selon la durée de visite habituelle.",
    flowEditManual: "Modifier manuellement",
    flowNoOverlap: "Les étapes s'enchaînent, les horaires ne se chevauchent jamais.",
    stopsLabel: "étapes",
    estimateLabel: "Estimation de votre journée",
    ofBudget: "sur un budget de {budget}",
    partyLabel: "personnes",
    fineTune: "Affiner l’itinéraire",
    fineTuneBody: "Choisissez le point de départ, puis optimisez l’ordre des étapes et vérifiez la météo.",
    previewAction: "Aperçu",
    previewNote:
      "Le planificateur d’aperçu utilise l’inventaire publié et les prix enregistrés. L’IA et la validation d’itinéraire peuvent être limitées.",
    suggestionsLabel: "Essayez",
    suggestion1: "Une journée tranquille au bord de la mer à deux",
    suggestion2: "Les cèdres et un déjeuner en montagne en famille",
    suggestion3: "Une journée d’histoire à Baalbek",
    routeStart: "Point de départ",
    flowMultiDestHint:
      "Choisissez autant de villes que vous voulez — nous vous dirons si elles sont trop éloignées pour une seule journée.",
    flowDestinationsChosen: "{n} sélectionnées",
    flowAllDestinations: "Toutes les villes choisies",
    flowClearTowns: "Effacer",
    flowFilterTown: "Filtrer par ville",
    flowStepSettings: "Votre journée",
    flowContinueToDetails: "Suite : votre journée",
    flowContinueToPlaces: "Suite : choisir les lieux",
    dayPanelTitle: "Votre journée",
    dayPanelEmpty:
      "Rien de choisi pour l’instant. Ajoutez un lieu et la journée se construit autour des horaires et de la route.",
    dayPanelShow: "Afficher votre journée",
    dayPanelHide: "Masquer votre journée",
    dayClearAll: "Tout effacer",
    dayStopsCount: "{n} étapes",
    dayEndsBy: "Retour avant {time}",
    dayCheckChecking: "Vérification des distances, du trafic et des horaires…",
    dayCheckDriving: "{minutes} min de route · {km} km",
    dayCheckFits: "Cette journée tient confortablement.",
    dayCheckBlocked: "Quelque chose doit changer avant d’enregistrer cette journée.",
    dayReorder: "Adopter l’ordre le plus court",
    dayReorderSaves: "économise environ {n} min",
    daySplit: "Répartir sur {n} journées",
    daySaveAnyway: "Enregistrer quand même",
    issueRegionSpread: "{a} et {b} sont à environ {km} km l’une de l’autre — trop loin pour une journée.",
    issueLongTransfer: "{a} est à {n} min de route de l’étape précédente.",
    issueTravelHeavy: "{n} des {total} min de votre journée se passeraient en voiture.",
    issueDayOverflow: "{a} se termine {n} min après votre heure de retour.",
    issueClosedThatDay: "{a} est fermé ce jour-là.",
    issueAfterHours: "{a} dépasse son heure de fermeture.",
    issueLongWait: "Vous arriveriez à {a} {n} min avant l’ouverture.",
    issueHoursUnknown: "Nous n’avons pas les horaires de {a} — vérifiez avant de partir.",
    issueRouteUnavailable: "Pas de temps de trajet en direct pour {a} ; l’estimation est approximative.",
    stopArrives: "Arrivée {time}",
    stopOpenBetween: "Ouvert {opens}–{closes}",
    stopHoursUnknown: "Horaires inconnus",
    stopDriveFrom: "{minutes} min · {km} km",
    stopWaits: "{n} min d’attente",
    addToDay: "Ajouter à votre journée",
    destinationPlaces: "{n} lieux à planifier",
    replacementsTitle: "Alternatives",
    priceOnRequest: "Prix sur demande",
    onRequestCount: "{count} sur demande – à demander au lieu, non compté",
    totalFrom: "à partir de {amount}",
    totalRange: "{low} – {high}",
    perPerson: "{amount} par personne",
    perPersonRange: "{low} – {high} par personne",
    dayCostTitle: "Le coût de la journée",
    dayCostBody:
      "Uniquement les prix publiés par les lieux et les chauffeurs. Rien d'inconnu n'est compté comme gratuit.",
    basis_fixed: "Prix fixe",
    basis_free: "Gratuit",
    basis_from: "À partir de",
    basis_range: "Fourchette de prix",
    basis_estimated: "Estimé par le lieu",
    basis_typical_spend: "Dépense habituelle par personne",
    basis_per_night_from: "À partir de, par chambre et par nuit",
    basis_driver_day_rate: "Tarifs journée publiés par les chauffeurs",
    basis_exchange_rate: "Sans frais – le taux du changeur s'applique",
    basis_on_request: "Prix sur demande",
    unitTimes: "{count} × {amount}",
    budget_within: "Dans votre budget de {budget}",
    budget_over: "Au-dessus de votre budget de {budget}",
    budget_may_exceed: "Peut dépasser votre budget de {budget}",
    otherCurrency: "{count} prix dans une autre devise, affiché mais non ajouté",
    driverTitle: "Un chauffeur pour la journée",
    driverBody:
      "Nous envoyons votre plan aux chauffeurs vérifiés qui couvrent la zone. Chacun propose un prix fixe et vous choisissez dans Trajets. Rien n'est réservé avant votre choix.",
    driverPickup: "Où le chauffeur doit-il vous prendre ?",
    driverSend: "Demander des prix aux chauffeurs",
    driverSent: "Envoyé. Les prix fixes des chauffeurs vérifiés apparaîtront dans Trajets.",
    priceSource: "Publié par {source} · vérifié le {date}",
    dayTitle: "Votre journée, étape par étape",
    dayBody:
      "Chaque étape demandée, dans votre ordre. Les lieux viennent uniquement de fiches vérifiées ; une étape non remplie dit pourquoi.",
    role_meal: "Repas",
    role_sight: "Visite",
    role_activity: "Activité",
    role_stay: "Nuit",
    role_service: "Course",
    role_exchange: "Bureau de change",
    status_empty: "Non remplie",
    status_skipped: "Passée – elle ne tenait pas",
    askedFor: "Vous avez demandé : {text}",
    reason_no_trusted_match: "Pas encore de lieu vérifié de ce type ici.",
    reason_closed_that_day: "Les lieux correspondants sont fermés ce jour-là.",
    reason_opens_too_late: "Les lieux correspondants ouvrent trop tard pour cette étape.",
    reason_closes_too_early: "Les lieux correspondants ferment avant la fin de l'étape.",
    reason_does_not_fit_the_day: "Elle ne tient pas dans le temps de votre journée.",
    reason_too_late_for_the_time_asked: "Impossible d'arriver à l'heure demandée.",
    reason_over_the_budget: "Les lieux correspondants dépassent votre budget strict.",
    reason_already_in_the_day: "Le seul lieu correspondant est déjà une autre étape.",
    reason_travel_unavailable: "Temps de trajet indisponible.",
    reason_office_without_location: "Le bureau de change n'a pas d'adresse enregistrée.",
    flag_check_times: "Vérifier les séances",
    flag_outside_destination: "Hors de votre destination",
    flag_long_wait: "Temps libre avant cette étape",
    flag_hours_unknown: "Horaires non confirmés",
    flag_meal_unconfirmed: "Repas servis non confirmés",
    flag_needs_unconfirmed: "Vos besoins non confirmés ici",
    tripDay: "Jour {day}",
    otherOptions: "Autres options",
    hideOptions: "Masquer les options",
    useOption: "Choisir ce lieu",
    noOptions: "Aucun autre lieu de confiance ne convient encore à cette étape.",
    optionsLoading: "Recherche de lieux de confiance…",
    optionsFailed: "Impossible de charger les options. Réessayez.",
    patchPreview: "Votre journée deviendrait :",
    optionDistance: "À {km} km de l'étape précédente",
    flag_quote_required: "Prix sur demande",
    flag_estimated_price: "Prix non fixe",
    trust_checked_by_mshwar: "Visité par Mshwar",
    trust_licensed_claimed: "Licence vérifiée",
    trust_verified_organisation: "Entreprise vérifiée",
    trust_changer: "Changeur enregistré",
    action_call: "Appeler",
    action_whatsapp: "WhatsApp",
    action_reserve: "Réserver en ligne",
    action_book: "Réserver le séjour",
    checkInFrom: "Arrivée dès {time}",
    driveMinutes: "{minutes} min de route",
    freeMinutes: "{minutes} min libres avant",
    understoodTitle: "Voici votre journée telle que je l'ai comprise",
    understoodDriver: "Avec chauffeur",
    understoodNight: "Se termine par une nuit",
    understoodOptional: "si on a le temps",
    understoodAvoid: "Sans : {items}",
    understoodUnclear: "Je ne suis pas sûr de comprendre : {text}",
    meal_breakfast: "Petit-déjeuner",
    meal_brunch: "Brunch",
    meal_lunch: "Déjeuner",
    meal_dinner: "Dîner",
    meal_snack: "Un en-cas",
  },
};

export type PlannerCopy = Record<PlannerKey, string>;

export function usePlannerCopy(): PlannerCopy {
  const { locale } = useLocale();
  return plannerCopy[locale];
}
