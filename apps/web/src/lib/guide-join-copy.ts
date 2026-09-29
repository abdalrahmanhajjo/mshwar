import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

/**
 * Copy for "Earn with Mshwar" (/guides/join), the founding programme and a new guide's
 * launch checklist. Only what exists is offered as available; the rest says "Coming soon".
 */
export type GuideJoinKey =
  | "metaTitle"
  | "crumbGuides"
  | "crumbJoin"
  | "metaDescription"
  | "kicker"
  | "titleLead"
  | "titleAccent"
  | "body"
  | "apply"
  | "seeEarnings"
  | "foundingKicker"
  | "foundingTitle"
  | "foundingBody"
  | "foundingLeft"
  | "foundingFull"
  | "foundingLimited"
  | "foundingBadge"
  | "whyKicker"
  | "whyTitle"
  | "why1Title"
  | "why1Body"
  | "why2Title"
  | "why2Body"
  | "why3Title"
  | "why3Body"
  | "why4Title"
  | "why4Body"
  | "why5Title"
  | "why5Body"
  | "why6Title"
  | "why6Body"
  | "waysKicker"
  | "waysTitle"
  | "availableNow"
  | "comingSoon"
  | "wayToursTitle"
  | "wayToursBody"
  | "wayHireTitle"
  | "wayHireBody"
  | "wayChangesTitle"
  | "wayChangesBody"
  | "wayHostTitle"
  | "wayHostBody"
  | "wayPrivateTitle"
  | "wayPrivateBody"
  | "wayAddonsTitle"
  | "wayAddonsBody"
  | "wayMultiTitle"
  | "wayMultiBody"
  | "wayGroupsTitle"
  | "wayGroupsBody"
  | "calcKicker"
  | "calcTitle"
  | "calcBody"
  | "calcTourPrice"
  | "calcGuests"
  | "calcTours"
  | "calcDayRate"
  | "calcHireDays"
  | "calcWeek"
  | "calcMonth"
  | "calcIllustrative"
  | "calcFeeNow"
  | "calcFeeLater"
  | "stepsKicker"
  | "stepsTitle"
  | "step1Title"
  | "step1Body"
  | "step2Title"
  | "step2Body"
  | "step3Title"
  | "step3Body"
  | "step4Title"
  | "step4Body"
  | "tiersKicker"
  | "tiersTitle"
  | "tierLicensedTitle"
  | "tierLicensedBody"
  | "tierHostTitle"
  | "tierHostBody"
  | "feesKicker"
  | "feesTitle"
  | "feeFoundingLabel"
  | "feeFoundingNote"
  | "feeNowLabel"
  | "feeNowNote"
  | "feeLaterLabel"
  | "feeLaterNote"
  | "faqKicker"
  | "faqTitle"
  | "faq1Q"
  | "faq1A"
  | "faq2Q"
  | "faq2A"
  | "faq3Q"
  | "faq3A"
  | "faq4Q"
  | "faq4A"
  | "faq5Q"
  | "faq5A"
  | "faq6Q"
  | "faq6A"
  | "ctaTitle"
  | "ctaBody"
  | "ctaDirectory"
  | "dirJoinTitle"
  | "dirJoinBody"
  | "dirJoinCta"
  | "homeFoundingTitle"
  | "homeFoundingBody"
  | "launchTitle"
  | "launchProgress"
  | "launchProfile"
  | "launchTour"
  | "launchPublish"
  | "launchTimes"
  | "launchDates"
  | "launchHire"
  | "launchGo"
  | "launchShare"
  | "launchCopy"
  | "launchCopied"
  | "launchDone"
  | "templateTitle"
  | "templateBlank"
  | "templateHint"
  | "tplByblosTitle"
  | "tplByblosBody"
  | "tplByblosIncluded"
  | "tplByblosBring"
  | "tplByblosStops"
  | "tplBatrounTitle"
  | "tplBatrounBody"
  | "tplBatrounIncluded"
  | "tplBatrounBring"
  | "tplBatrounStops"
  | "tplQadishaTitle"
  | "tplQadishaBody"
  | "tplQadishaIncluded"
  | "tplQadishaBring"
  | "tplQadishaStops"
  | "tplBeirutTitle"
  | "tplBeirutBody"
  | "tplBeirutIncluded"
  | "tplBeirutBring"
  | "tplBeirutStops"
  | "tplBaalbekTitle"
  | "tplBaalbekBody"
  | "tplBaalbekIncluded"
  | "tplBaalbekBring"
  | "tplBaalbekStops"
  | "tplTyreTitle"
  | "tplTyreBody"
  | "tplTyreIncluded"
  | "tplTyreBring"
  | "tplTyreStops";

export const guideJoinCopy: Record<Locale, Record<GuideJoinKey, string>> = {
  en: {
    metaTitle: "Earn with Mshwar — for guides and local hosts in Lebanon",
    crumbGuides: "Guides",
    crumbJoin: "Earn with Mshwar",
    metaDescription:
      "List your tours for free, get requests from travellers who are ready to go, and run your week from one place. 0% fee for Founding Guides.",
    kicker: "For guides & local hosts",
    titleLead: "Turn your love of Lebanon",
    titleAccent: "into your business.",
    body: "List your tours for free, get requests from travellers who already know where they want to go, and run your week from one place — in English, Arabic and French.",
    apply: "Apply in 15 minutes",
    seeEarnings: "See what you could earn",
    foundingKicker: "Founding Guides",
    foundingTitle: "0% Mshwar fee for 6 months",
    foundingBody:
      "For the first 50 guides we approve, from the day online payments start. Your Founding Guide number is yours for good.",
    foundingLeft: "{n} of {limit} places left",
    foundingFull: "All {limit} Founding Guide places are taken.",
    foundingLimited: "Limited to the first 50 approved guides.",
    foundingBadge: "Founding Guide #{n}",
    whyKicker: "Why Mshwar",
    whyTitle: "Built for guides in Lebanon.",
    why1Title: "Travellers who are ready to go",
    why1Body:
      "Mshwar's planner turns a wish into a real day. Licensed guides can be hired for it with the date, the group and the route already set.",
    why2Title: "Free to join",
    why2Body: "No listing fee and no subscription. Today your guests pay you directly on the day.",
    why3Title: "A page that earns trust",
    why3Body:
      "A verified licence badge, your tours drawn on a map of real places, and reviews only from guests who toured with you.",
    why4Title: "Your week, organised",
    why4Body: "Set your weekly start times, block days off, cap tours per day, and get a day sheet for every run.",
    why5Title: "Fair reviews, both ways",
    why5Body: "You and your guests review each other blind: neither sees the other's review until both have written.",
    why6Title: "Three languages",
    why6Body: "Your page works in English, العربية and Français, right-to-left Arabic included.",
    waysKicker: "Ways to earn",
    waysTitle: "More than one kind of booking.",
    availableNow: "Available now",
    comingSoon: "Coming soon",
    wayToursTitle: "Tours on your schedule",
    wayToursBody: "Publish tours through real places; travellers request a start time. Price per person or per group.",
    wayHireTitle: "Hired for a planned day",
    wayHireBody: "Set a day rate. Travellers who planned a day with Mshwar can hire you for it.",
    wayChangesTitle: "Your expertise, their day",
    wayChangesBody:
      "Propose changes to a traveller's plan — better stops, better timing — and they accept with one tap.",
    wayHostTitle: "Free walks as a local host",
    wayHostBody: "No licence yet? Host free walks, meet travellers, earn tips and build reviews.",
    wayPrivateTitle: "Private & shared tours",
    wayPrivateBody: "Private groups and join-a-group tours, with child and group prices.",
    wayAddonsTitle: "Add-ons",
    wayAddonsBody: "Pickup, tastings, tickets and extra hours, each at your own price.",
    wayMultiTitle: "Several days",
    wayMultiBody: "Multi-day trips from the planner, with one guide throughout.",
    wayGroupsTitle: "Schools & companies",
    wayGroupsBody: "Group requests from organisers, answered with your quote.",
    calcKicker: "Earnings calculator",
    calcTitle: "What could a week look like?",
    calcBody:
      "Enter your own prices. This is an estimate to plan with, not a promise: real earnings depend on bookings.",
    calcTourPrice: "Tour price per guest (USD)",
    calcGuests: "Guests per tour",
    calcTours: "Tours per week",
    calcDayRate: "Day rate when hired (USD)",
    calcHireDays: "Hired days per week",
    calcWeek: "A week",
    calcMonth: "A month",
    calcIllustrative: "Illustrative estimate",
    calcFeeNow: "Mshwar fee today: 0% — your guests pay you on the day.",
    calcFeeLater: "Later, with online payments and a {fee}% fee, you would keep {net} a month.",
    stepsKicker: "How it works",
    stepsTitle: "From application to first booking.",
    step1Title: "Apply",
    step1Body: "Tell us about you, your languages and your regions. About 15 minutes.",
    step2Title: "Get verified",
    step2Body: "We check your ID and licence, and aim to reply within 2 working days.",
    step3Title: "Publish your first tour",
    step3Body: "Start from a template, add real stops from the map, set your times and price.",
    step4Title: "Get requests",
    step4Body: "Accept or decline, see the group and their needs, and run the day from your phone.",
    tiersKicker: "Two ways to join",
    tiersTitle: "Licensed guide or local host.",
    tierLicensedTitle: "Licensed guide",
    tierLicensedBody:
      "Hold a Ministry of Tourism guide licence? Charge for tours, be hired for planned days, and carry the verified badge while your licence is valid.",
    tierHostTitle: "Local host",
    tierHostBody: "Know your town inside out but not licensed? Host free walks, meet travellers and collect tips.",
    feesKicker: "Fees",
    feesTitle: "Clear and simple.",
    feeFoundingLabel: "Founding Guides",
    feeFoundingNote: "The first 50 approved guides, for their first 6 months of online payments.",
    feeNowLabel: "Today",
    feeNowNote: "Guests pay you on the day. Mshwar takes nothing.",
    feeLaterLabel: "With online payments (coming)",
    feeLaterNote: "Always shown before you accept a booking.",
    faqKicker: "Questions",
    faqTitle: "Good to know.",
    faq1Q: "Do I need a licence?",
    faq1A:
      "To charge for tours or be hired for a planned day, yes: a valid Ministry of Tourism guide licence. Without one you can join as a local host for free walks.",
    faq2Q: "How do I get paid?",
    faq2A:
      "Today your guests pay you directly on the day, in the way you agree. Online payments will come with a licensed Lebanese payment partner.",
    faq3Q: "What does it cost?",
    faq3A: "Nothing to join or to list. Mshwar charges no fee while your guests pay you on the day.",
    faq4Q: "Who sets the prices and times?",
    faq4A: "You do: your tours, your prices, your weekly times, your days off and how many tours you run a day.",
    faq5Q: "What if I need to cancel?",
    faq5A: "Tell your guests as early as you can. Cancellations show on your record, so keep them rare.",
    faq6Q: "Can guests see my phone number?",
    faq6A: "Only after you confirm their request. Your documents are never shown to anyone except Mshwar's reviewers.",
    ctaTitle: "Ready to show people your Lebanon?",
    ctaBody: "Apply today — it takes about 15 minutes.",
    ctaDirectory: "See the guides on Mshwar",
    dirJoinTitle: "Are you a guide?",
    dirJoinBody: "Earn with Mshwar: free to join, 0% fee for Founding Guides.",
    dirJoinCta: "Learn more",
    homeFoundingTitle: "You're Founding Guide #{n}",
    homeFoundingBody: "Your 0% fee for the first 6 months of online payments is saved on your profile.",
    launchTitle: "Get ready for your first booking",
    launchProgress: "{done} of {total} done",
    launchProfile: "Complete your page: headline, bio, languages and regions",
    launchTour: "Create your first tour",
    launchPublish: "Publish a tour",
    launchTimes: "Set your weekly start times",
    launchDates: "Open dates for travellers to request",
    launchHire: "Set a day rate to be hired for planned days",
    launchGo: "Go",
    launchShare: "Share your page",
    launchCopy: "Copy link",
    launchCopied: "Copied",
    launchDone: "All set — you're ready for bookings.",
    templateTitle: "Start from a template",
    templateBlank: "Blank tour",
    templateHint: "Stops to add from the map: {stops}",
    tplByblosTitle: "Byblos old souk & harbour walk",
    tplByblosBody:
      "Seven thousand years in one morning: the Crusader castle, the old souk's stone lanes, St John-Mark church and the fishing harbour at the end.",
    tplByblosIncluded: "Guiding in your language",
    tplByblosBring: "Comfortable shoes, water, a hat",
    tplByblosStops: "Byblos Castle, Old Souk, St John-Mark Church, Byblos Harbour",
    tplBatrounTitle: "Batroun old town & sunset",
    tplBatrounBody:
      "Wander the old town's churches and lanes, stop at the Phoenician wall, taste the town's famous lemonade and end on the sea at sunset.",
    tplBatrounIncluded: "Guiding in your language",
    tplBatrounBring: "Comfortable shoes, a light jacket for the evening",
    tplBatrounStops: "Our Lady of the Sea, Phoenician Wall, Old Souk, St Stephen's Church",
    tplQadishaTitle: "Qadisha Valley hike",
    tplQadishaBody:
      "Walk the holy valley between cliffs and monasteries, with the stories of the hermits who lived here and time to rest by the river.",
    tplQadishaIncluded: "Guiding, a safety briefing",
    tplQadishaBring: "Hiking shoes, 2 litres of water, snacks, sun protection",
    tplQadishaStops: "Qannoubine Monastery, Mar Lichaa Monastery, Qadisha River",
    tplBeirutTitle: "Beirut food & history walk",
    tplBeirutBody:
      "From Roman columns to Ottoman houses, with the bakeries, juice bars and street food Beirutis love along the way.",
    tplBeirutIncluded: "Guiding in your language",
    tplBeirutBring: "An appetite, comfortable shoes",
    tplBeirutStops: "Roman Baths, Mohammad Al-Amin Mosque, Gemmayzeh, Mar Mikhael",
    tplBaalbekTitle: "Baalbek temples",
    tplBaalbekBody:
      "Stand under the columns of the Temple of Jupiter and inside the Temple of Bacchus, one of the best-preserved Roman temples anywhere.",
    tplBaalbekIncluded: "Guiding in your language",
    tplBaalbekBring: "Water, a hat, comfortable shoes",
    tplBaalbekStops: "Baalbek Temples, Temple of Bacchus, Stone of the Pregnant Woman",
    tplTyreTitle: "Tyre, sea & ruins",
    tplTyreBody:
      "Roman roads, a hippodrome and a harbour town by the sea: walk Tyre's archaeological sites and end on the beach.",
    tplTyreIncluded: "Guiding in your language",
    tplTyreBring: "Water, a hat, swimwear if you'd like a swim",
    tplTyreStops: "Al-Bass Archaeological Site, Tyre Hippodrome, Tyre Old Port",
  },
  ar: {
    metaTitle: "اربح مع مشوار — للمرشدين والمضيفين المحليين في لبنان",
    crumbGuides: "المرشدون",
    crumbJoin: "اربح مع مشوار",
    metaDescription:
      "اعرض جولاتك مجانًا، واستقبل طلبات من مسافرين جاهزين للانطلاق، ونظّم أسبوعك من مكان واحد. بلا عمولة للمرشدين المؤسِّسين.",
    kicker: "للمرشدين والمضيفين المحليين",
    titleLead: "حوّل حبّك للبنان",
    titleAccent: "إلى عملك الخاص.",
    body: "اعرض جولاتك مجانًا، واستقبل طلبات من مسافرين يعرفون أين يريدون الذهاب، ونظّم أسبوعك من مكان واحد — بالعربية والإنجليزية والفرنسية.",
    apply: "قدّم طلبك في 15 دقيقة",
    seeEarnings: "احسب ما قد تربحه",
    foundingKicker: "المرشدون المؤسِّسون",
    foundingTitle: "0% عمولة لمشوار لمدة 6 أشهر",
    foundingBody: "لأول 50 مرشدًا نقبلهم، من يوم بدء الدفع الإلكتروني. رقمك كمرشد مؤسِّس يبقى لك دائمًا.",
    foundingLeft: "بقي {n} من أصل {limit} مكانًا",
    foundingFull: "كل أماكن المرشدين المؤسِّسين الـ{limit} محجوزة.",
    foundingLimited: "محدود لأول 50 مرشدًا مقبولًا.",
    foundingBadge: "مرشد مؤسِّس رقم {n}",
    whyKicker: "لماذا مشوار",
    whyTitle: "مصمَّم للمرشدين في لبنان.",
    why1Title: "مسافرون جاهزون للانطلاق",
    why1Body:
      "يحوّل مخطِّط مشوار الرغبة إلى يوم حقيقي، ويمكن للمسافر أن يستعين بمرشد مرخَّص له مع التاريخ والمجموعة والمسار محدَّدة مسبقًا.",
    why2Title: "الانضمام مجاني",
    why2Body: "لا رسوم إدراج ولا اشتراك. اليوم يدفع لك ضيوفك مباشرة يوم الجولة.",
    why3Title: "صفحة تكسب الثقة",
    why3Body: "شارة ترخيص موثَّقة، وجولاتك مرسومة على خريطة أماكن حقيقية، وتقييمات فقط من ضيوف تجوّلوا معك.",
    why4Title: "أسبوعك منظَّم",
    why4Body:
      "حدّد مواعيد انطلاقك الأسبوعية، وأغلق أيام العطلة، وضع حدًّا لعدد الجولات يوميًا، واحصل على ورقة يوم لكل جولة.",
    why5Title: "تقييمات عادلة للطرفين",
    why5Body: "تقيّم ضيوفك ويقيّمونك دون أن يرى أحدكما تقييم الآخر حتى يكتب الطرفان.",
    why6Title: "ثلاث لغات",
    why6Body: "صفحتك تعمل بالعربية والإنجليزية والفرنسية، مع دعم كامل للكتابة من اليمين إلى اليسار.",
    waysKicker: "طرق الربح",
    waysTitle: "أكثر من نوع حجز واحد.",
    availableNow: "متاح الآن",
    comingSoon: "قريبًا",
    wayToursTitle: "جولات على مواعيدك",
    wayToursBody: "انشر جولات تمرّ بأماكن حقيقية، ويطلب المسافرون موعد انطلاق. السعر للشخص أو للمجموعة.",
    wayHireTitle: "مرشد ليوم مخطَّط",
    wayHireBody: "حدّد أجرك اليومي، ويمكن للمسافرين الذين خطّطوا يومهم مع مشوار أن يستعينوا بك.",
    wayChangesTitle: "خبرتك، ويومهم",
    wayChangesBody: "اقترح تعديلات على خطة المسافر — محطات أفضل وتوقيت أفضل — ويقبلها بلمسة واحدة.",
    wayHostTitle: "جولات مجانية كمضيف محلي",
    wayHostBody: "لا ترخيص بعد؟ استضف جولات مشي مجانية، وتعرّف على المسافرين، واحصل على الإكراميات والتقييمات.",
    wayPrivateTitle: "جولات خاصة ومشتركة",
    wayPrivateBody: "مجموعات خاصة وجولات مشتركة، مع أسعار للأطفال وللمجموعات.",
    wayAddonsTitle: "إضافات",
    wayAddonsBody: "توصيل، تذوّق، تذاكر وساعات إضافية، كلٌّ بسعرك.",
    wayMultiTitle: "عدة أيام",
    wayMultiBody: "رحلات لعدة أيام من المخطِّط، مع مرشد واحد طوال الرحلة.",
    wayGroupsTitle: "مدارس وشركات",
    wayGroupsBody: "طلبات مجموعات من المنظّمين، تجيب عليها بعرض سعرك.",
    calcKicker: "حاسبة الأرباح",
    calcTitle: "كيف قد يبدو أسبوعك؟",
    calcBody: "أدخل أسعارك. هذا تقدير للتخطيط وليس وعدًا: الأرباح الحقيقية تعتمد على الحجوزات.",
    calcTourPrice: "سعر الجولة للضيف (دولار)",
    calcGuests: "عدد الضيوف في الجولة",
    calcTours: "عدد الجولات في الأسبوع",
    calcDayRate: "الأجر اليومي عند الاستعانة بك (دولار)",
    calcHireDays: "أيام الاستعانة في الأسبوع",
    calcWeek: "في الأسبوع",
    calcMonth: "في الشهر",
    calcIllustrative: "تقدير توضيحي",
    calcFeeNow: "عمولة مشوار اليوم: 0% — يدفع لك ضيوفك يوم الجولة.",
    calcFeeLater: "لاحقًا، مع الدفع الإلكتروني وعمولة {fee}%، سيبقى لك {net} في الشهر.",
    stepsKicker: "كيف يعمل",
    stepsTitle: "من الطلب إلى أول حجز.",
    step1Title: "قدّم طلبك",
    step1Body: "أخبرنا عنك وعن لغاتك ومناطقك. نحو 15 دقيقة.",
    step2Title: "التوثيق",
    step2Body: "نتحقق من هويتك وترخيصك، ونسعى للرد خلال يومَي عمل.",
    step3Title: "انشر جولتك الأولى",
    step3Body: "ابدأ من نموذج، وأضف محطات حقيقية من الخريطة، وحدّد مواعيدك وسعرك.",
    step4Title: "استقبل الطلبات",
    step4Body: "اقبل أو ارفض، واطّلع على المجموعة واحتياجاتها، وأدِر يومك من هاتفك.",
    tiersKicker: "طريقتان للانضمام",
    tiersTitle: "مرشد مرخَّص أو مضيف محلي.",
    tierLicensedTitle: "مرشد مرخَّص",
    tierLicensedBody:
      "لديك ترخيص مرشد سياحي من وزارة السياحة؟ تقاضَ أجرًا عن جولاتك، واستقبل طلبات الاستعانة بك ليوم مخطَّط، واحمل الشارة الموثَّقة طالما ترخيصك ساري.",
    tierHostTitle: "مضيف محلي",
    tierHostBody:
      "تعرف بلدتك جيدًا لكنك غير مرخَّص؟ استضف جولات مشي مجانية، وتعرّف على المسافرين، واحصل على الإكراميات.",
    feesKicker: "الرسوم",
    feesTitle: "واضحة وبسيطة.",
    feeFoundingLabel: "المرشدون المؤسِّسون",
    feeFoundingNote: "لأول 50 مرشدًا مقبولًا، خلال أول 6 أشهر من الدفع الإلكتروني.",
    feeNowLabel: "اليوم",
    feeNowNote: "يدفع لك الضيوف يوم الجولة، ولا يأخذ مشوار شيئًا.",
    feeLaterLabel: "مع الدفع الإلكتروني (قريبًا)",
    feeLaterNote: "تُعرض دائمًا قبل أن تقبل أي حجز.",
    faqKicker: "أسئلة",
    faqTitle: "من المفيد أن تعرف.",
    faq1Q: "هل أحتاج إلى ترخيص؟",
    faq1A:
      "لتتقاضى أجرًا عن الجولات أو يُستعان بك ليوم مخطَّط، نعم: ترخيص مرشد سياحي ساري من وزارة السياحة. من دونه يمكنك الانضمام كمضيف محلي لجولات مجانية.",
    faq2Q: "كيف أتقاضى أجري؟",
    faq2A:
      "اليوم يدفع لك ضيوفك مباشرة يوم الجولة بالطريقة التي تتفقون عليها. سيأتي الدفع الإلكتروني مع شريك دفع لبناني مرخَّص.",
    faq3Q: "كم يكلّف؟",
    faq3A: "لا شيء للانضمام أو للإدراج. لا يتقاضى مشوار أي عمولة طالما يدفع لك ضيوفك يوم الجولة.",
    faq4Q: "من يحدّد الأسعار والمواعيد؟",
    faq4A: "أنت: جولاتك وأسعارك ومواعيدك الأسبوعية وأيام عطلتك وعدد جولاتك في اليوم.",
    faq5Q: "ماذا لو اضطررت إلى الإلغاء؟",
    faq5A: "أبلغ ضيوفك بأسرع ما يمكن. الإلغاءات تظهر في سجلّك، فاجعلها نادرة.",
    faq6Q: "هل يرى الضيوف رقم هاتفي؟",
    faq6A: "فقط بعد أن تؤكّد طلبهم. ولا تُعرض مستنداتك لأحد سوى مراجعي مشوار.",
    ctaTitle: "جاهز لتُري الناس لبنانك؟",
    ctaBody: "قدّم طلبك اليوم — يستغرق نحو 15 دقيقة.",
    ctaDirectory: "تعرّف على المرشدين في مشوار",
    dirJoinTitle: "هل أنت مرشد؟",
    dirJoinBody: "اربح مع مشوار: الانضمام مجاني، وبلا عمولة للمرشدين المؤسِّسين.",
    dirJoinCta: "اعرف المزيد",
    homeFoundingTitle: "أنت المرشد المؤسِّس رقم {n}",
    homeFoundingBody: "عمولتك 0% خلال أول 6 أشهر من الدفع الإلكتروني محفوظة في ملفك.",
    launchTitle: "استعدّ لحجزك الأول",
    launchProgress: "أُنجز {done} من {total}",
    launchProfile: "أكمل صفحتك: العنوان والنبذة واللغات والمناطق",
    launchTour: "أنشئ جولتك الأولى",
    launchPublish: "انشر جولة",
    launchTimes: "حدّد مواعيد انطلاقك الأسبوعية",
    launchDates: "افتح مواعيد ليطلبها المسافرون",
    launchHire: "حدّد أجرًا يوميًا ليُستعان بك في الأيام المخطَّطة",
    launchGo: "اذهب",
    launchShare: "شارك صفحتك",
    launchCopy: "انسخ الرابط",
    launchCopied: "نُسخ",
    launchDone: "كل شيء جاهز — أنت مستعد للحجوزات.",
    templateTitle: "ابدأ من نموذج",
    templateBlank: "جولة فارغة",
    templateHint: "محطات تضيفها من الخريطة: {stops}",
    tplByblosTitle: "جولة سوق جبيل القديم والميناء",
    tplByblosBody:
      "سبعة آلاف سنة في صباح واحد: القلعة الصليبية، وأزقّة السوق القديم الحجرية، وكنيسة مار يوحنا مرقس، وميناء الصيادين في الختام.",
    tplByblosIncluded: "إرشاد بلغتك",
    tplByblosBring: "حذاء مريح، ماء، قبعة",
    tplByblosStops: "قلعة جبيل، السوق القديم، كنيسة مار يوحنا مرقس، ميناء جبيل",
    tplBatrounTitle: "البترون القديمة والغروب",
    tplBatrounBody:
      "تجوّل بين كنائس البلدة القديمة وأزقّتها، وتوقّف عند السور الفينيقي، وتذوّق ليموناضة البترون الشهيرة، واختم على البحر عند الغروب.",
    tplBatrounIncluded: "إرشاد بلغتك",
    tplBatrounBring: "حذاء مريح، وسترة خفيفة للمساء",
    tplBatrounStops: "سيدة البحر، السور الفينيقي، السوق القديم، كنيسة مار اسطفان",
    tplQadishaTitle: "مشي في وادي قاديشا",
    tplQadishaBody:
      "امشِ في الوادي المقدّس بين المنحدرات والأديرة، مع قصص النسّاك الذين عاشوا فيه، ووقت للراحة قرب النهر.",
    tplQadishaIncluded: "إرشاد، وتعليمات سلامة",
    tplQadishaBring: "حذاء مشي، ليتران من الماء، وجبات خفيفة، واقٍ من الشمس",
    tplQadishaStops: "دير قنوبين، دير مار ليشع، نهر قاديشا",
    tplBeirutTitle: "جولة بيروت للطعام والتاريخ",
    tplBeirutBody:
      "من الأعمدة الرومانية إلى البيوت العثمانية، مع الأفران ومحلات العصير والأكل الشعبي الذي يحبه البيروتيون على الطريق.",
    tplBeirutIncluded: "إرشاد بلغتك",
    tplBeirutBring: "شهية جيدة، حذاء مريح",
    tplBeirutStops: "الحمّامات الرومانية، جامع محمد الأمين، الجمّيزة، مار مخايل",
    tplBaalbekTitle: "معابد بعلبك",
    tplBaalbekBody: "قف تحت أعمدة معبد جوبيتر وداخل معبد باخوس، من أفضل المعابد الرومانية حفظًا في العالم.",
    tplBaalbekIncluded: "إرشاد بلغتك",
    tplBaalbekBring: "ماء، قبعة، حذاء مريح",
    tplBaalbekStops: "قلعة بعلبك، معبد باخوس، حجر الحبلى",
    tplTyreTitle: "صور، البحر والآثار",
    tplTyreBody: "طرق رومانية وميدان سباق ومدينة ميناء على البحر: تجوّل في مواقع صور الأثرية واختم على الشاطئ.",
    tplTyreIncluded: "إرشاد بلغتك",
    tplTyreBring: "ماء، قبعة، وملابس سباحة إن أردت السباحة",
    tplTyreStops: "موقع البص الأثري، ميدان سباق الخيل، ميناء صور القديم",
  },
  fr: {
    metaTitle: "Gagnez avec Mshwar — pour les guides et hôtes locaux au Liban",
    crumbGuides: "Guides",
    crumbJoin: "Gagnez avec Mshwar",
    metaDescription:
      "Publiez vos visites gratuitement, recevez des demandes de voyageurs prêts à partir et organisez votre semaine au même endroit. 0 % de commission pour les Guides fondateurs.",
    kicker: "Pour les guides et hôtes locaux",
    titleLead: "Faites de votre amour du Liban",
    titleAccent: "votre activité.",
    body: "Publiez vos visites gratuitement, recevez des demandes de voyageurs qui savent déjà où aller, et organisez votre semaine au même endroit — en français, en arabe et en anglais.",
    apply: "Postuler en 15 minutes",
    seeEarnings: "Estimer mes revenus",
    foundingKicker: "Guides fondateurs",
    foundingTitle: "0 % de commission Mshwar pendant 6 mois",
    foundingBody:
      "Pour les 50 premiers guides approuvés, à partir du lancement des paiements en ligne. Votre numéro de Guide fondateur vous appartient pour toujours.",
    foundingLeft: "Encore {n} places sur {limit}",
    foundingFull: "Les {limit} places de Guide fondateur sont prises.",
    foundingLimited: "Réservé aux 50 premiers guides approuvés.",
    foundingBadge: "Guide fondateur n° {n}",
    whyKicker: "Pourquoi Mshwar",
    whyTitle: "Pensé pour les guides au Liban.",
    why1Title: "Des voyageurs prêts à partir",
    why1Body:
      "Le planificateur de Mshwar transforme une envie en journée réelle. Les guides agréés peuvent y être engagés, avec la date, le groupe et l'itinéraire déjà fixés.",
    why2Title: "Inscription gratuite",
    why2Body: "Ni frais de publication ni abonnement. Aujourd'hui, vos clients vous paient directement le jour même.",
    why3Title: "Une page qui inspire confiance",
    why3Body:
      "Un badge de licence vérifiée, vos visites tracées sur une carte de lieux réels, et des avis uniquement de clients venus avec vous.",
    why4Title: "Votre semaine, organisée",
    why4Body:
      "Fixez vos départs hebdomadaires, bloquez vos jours de repos, limitez les visites par jour et recevez une fiche pour chaque sortie.",
    why5Title: "Des avis justes, dans les deux sens",
    why5Body:
      "Vous et vos clients vous évaluez à l'aveugle : aucun ne voit l'avis de l'autre avant que les deux aient écrit.",
    why6Title: "Trois langues",
    why6Body: "Votre page fonctionne en français, en anglais et en arabe, écrit de droite à gauche.",
    waysKicker: "Façons de gagner",
    waysTitle: "Plus d'un type de réservation.",
    availableNow: "Disponible",
    comingSoon: "Bientôt",
    wayToursTitle: "Des visites à votre rythme",
    wayToursBody:
      "Publiez des visites passant par des lieux réels ; les voyageurs demandent un horaire. Prix par personne ou par groupe.",
    wayHireTitle: "Engagé pour une journée planifiée",
    wayHireBody:
      "Fixez un tarif journalier. Les voyageurs qui ont planifié une journée avec Mshwar peuvent vous engager.",
    wayChangesTitle: "Votre expertise, leur journée",
    wayChangesBody:
      "Proposez des modifications au plan d'un voyageur — meilleures étapes, meilleur timing — acceptées en un geste.",
    wayHostTitle: "Balades gratuites en hôte local",
    wayHostBody:
      "Pas encore de licence ? Proposez des balades gratuites, rencontrez des voyageurs, recevez des pourboires et des avis.",
    wayPrivateTitle: "Visites privées et partagées",
    wayPrivateBody: "Groupes privés et visites partagées, avec tarifs enfants et groupes.",
    wayAddonsTitle: "Options",
    wayAddonsBody: "Prise en charge, dégustations, billets et heures en plus, chacun à votre prix.",
    wayMultiTitle: "Plusieurs jours",
    wayMultiBody: "Séjours de plusieurs jours depuis le planificateur, avec un seul guide.",
    wayGroupsTitle: "Écoles et entreprises",
    wayGroupsBody: "Demandes de groupes d'organisateurs, auxquelles vous répondez par un devis.",
    calcKicker: "Calculateur de revenus",
    calcTitle: "À quoi pourrait ressembler une semaine ?",
    calcBody:
      "Saisissez vos propres prix. C'est une estimation pour planifier, pas une promesse : les revenus réels dépendent des réservations.",
    calcTourPrice: "Prix de la visite par personne (USD)",
    calcGuests: "Personnes par visite",
    calcTours: "Visites par semaine",
    calcDayRate: "Tarif journalier engagé (USD)",
    calcHireDays: "Journées engagées par semaine",
    calcWeek: "Par semaine",
    calcMonth: "Par mois",
    calcIllustrative: "Estimation indicative",
    calcFeeNow: "Commission Mshwar aujourd'hui : 0 % — vos clients vous paient le jour même.",
    calcFeeLater: "Plus tard, avec les paiements en ligne et {fee} % de commission, vous garderiez {net} par mois.",
    stepsKicker: "Comment ça marche",
    stepsTitle: "De la candidature à la première réservation.",
    step1Title: "Postulez",
    step1Body: "Parlez-nous de vous, de vos langues et de vos régions. Environ 15 minutes.",
    step2Title: "Faites-vous vérifier",
    step2Body: "Nous vérifions votre pièce d'identité et votre licence, et visons une réponse sous 2 jours ouvrés.",
    step3Title: "Publiez votre première visite",
    step3Body: "Partez d'un modèle, ajoutez des étapes réelles depuis la carte, fixez vos horaires et votre prix.",
    step4Title: "Recevez des demandes",
    step4Body: "Acceptez ou refusez, voyez le groupe et ses besoins, et gérez la journée depuis votre téléphone.",
    tiersKicker: "Deux façons de rejoindre",
    tiersTitle: "Guide agréé ou hôte local.",
    tierLicensedTitle: "Guide agréé",
    tierLicensedBody:
      "Titulaire d'une licence de guide du ministère du Tourisme ? Faites payer vos visites, soyez engagé pour des journées planifiées et portez le badge vérifié tant que votre licence est valide.",
    tierHostTitle: "Hôte local",
    tierHostBody:
      "Vous connaissez votre ville par cœur sans être agréé ? Proposez des balades gratuites, rencontrez des voyageurs et recevez des pourboires.",
    feesKicker: "Commissions",
    feesTitle: "Claires et simples.",
    feeFoundingLabel: "Guides fondateurs",
    feeFoundingNote: "Les 50 premiers guides approuvés, pendant leurs 6 premiers mois de paiements en ligne.",
    feeNowLabel: "Aujourd'hui",
    feeNowNote: "Vos clients vous paient le jour même. Mshwar ne prend rien.",
    feeLaterLabel: "Avec les paiements en ligne (bientôt)",
    feeLaterNote: "Toujours affichée avant d'accepter une réservation.",
    faqKicker: "Questions",
    faqTitle: "Bon à savoir.",
    faq1Q: "Ai-je besoin d'une licence ?",
    faq1A:
      "Pour faire payer vos visites ou être engagé pour une journée planifiée, oui : une licence de guide valide du ministère du Tourisme. Sans licence, vous pouvez rejoindre Mshwar comme hôte local pour des balades gratuites.",
    faq2Q: "Comment suis-je payé ?",
    faq2A:
      "Aujourd'hui, vos clients vous paient directement le jour même, comme convenu entre vous. Les paiements en ligne viendront avec un partenaire de paiement libanais agréé.",
    faq3Q: "Combien ça coûte ?",
    faq3A:
      "Rien pour s'inscrire ni pour publier. Mshwar ne prend aucune commission tant que vos clients vous paient le jour même.",
    faq4Q: "Qui fixe les prix et les horaires ?",
    faq4A:
      "Vous : vos visites, vos prix, vos horaires hebdomadaires, vos jours de repos et le nombre de visites par jour.",
    faq5Q: "Et si je dois annuler ?",
    faq5A:
      "Prévenez vos clients le plus tôt possible. Les annulations apparaissent sur votre profil : qu'elles restent rares.",
    faq6Q: "Les clients voient-ils mon numéro ?",
    faq6A:
      "Seulement après que vous avez confirmé leur demande. Vos documents ne sont montrés qu'aux vérificateurs de Mshwar.",
    ctaTitle: "Prêt à faire découvrir votre Liban ?",
    ctaBody: "Postulez aujourd'hui — cela prend environ 15 minutes.",
    ctaDirectory: "Voir les guides sur Mshwar",
    dirJoinTitle: "Vous êtes guide ?",
    dirJoinBody: "Gagnez avec Mshwar : inscription gratuite, 0 % de commission pour les Guides fondateurs.",
    dirJoinCta: "En savoir plus",
    homeFoundingTitle: "Vous êtes le Guide fondateur n° {n}",
    homeFoundingBody:
      "Vos 0 % de commission pendant les 6 premiers mois de paiements en ligne sont enregistrés sur votre profil.",
    launchTitle: "Préparez votre première réservation",
    launchProgress: "{done} sur {total} fait",
    launchProfile: "Complétez votre page : accroche, présentation, langues et régions",
    launchTour: "Créez votre première visite",
    launchPublish: "Publiez une visite",
    launchTimes: "Fixez vos départs hebdomadaires",
    launchDates: "Ouvrez des dates que les voyageurs peuvent demander",
    launchHire: "Fixez un tarif journalier pour être engagé",
    launchGo: "Y aller",
    launchShare: "Partagez votre page",
    launchCopy: "Copier le lien",
    launchCopied: "Copié",
    launchDone: "Tout est prêt — vous pouvez recevoir des réservations.",
    templateTitle: "Partir d'un modèle",
    templateBlank: "Visite vierge",
    templateHint: "Étapes à ajouter depuis la carte : {stops}",
    tplByblosTitle: "Byblos : vieux souk et port",
    tplByblosBody:
      "Sept mille ans en une matinée : le château croisé, les ruelles de pierre du vieux souk, l'église Saint-Jean-Marc et le port de pêche pour finir.",
    tplByblosIncluded: "Visite guidée dans votre langue",
    tplByblosBring: "Chaussures confortables, eau, chapeau",
    tplByblosStops: "Château de Byblos, Vieux souk, Église Saint-Jean-Marc, Port de Byblos",
    tplBatrounTitle: "Vieille ville de Batroun et coucher de soleil",
    tplBatrounBody:
      "Flânez entre les églises et les ruelles de la vieille ville, arrêtez-vous au mur phénicien, goûtez la célèbre limonade et finissez face à la mer au coucher du soleil.",
    tplBatrounIncluded: "Visite guidée dans votre langue",
    tplBatrounBring: "Chaussures confortables, une veste légère pour le soir",
    tplBatrounStops: "Notre-Dame de la Mer, Mur phénicien, Vieux souk, Église Saint-Étienne",
    tplQadishaTitle: "Randonnée dans la vallée de la Qadisha",
    tplQadishaBody:
      "Marchez dans la vallée sainte entre falaises et monastères, avec l'histoire des ermites qui y vivaient et une pause au bord de la rivière.",
    tplQadishaIncluded: "Visite guidée, consignes de sécurité",
    tplQadishaBring: "Chaussures de marche, 2 litres d'eau, en-cas, protection solaire",
    tplQadishaStops: "Monastère de Qannoubine, Monastère Mar Lichaa, Rivière Qadisha",
    tplBeirutTitle: "Beyrouth, cuisine et histoire",
    tplBeirutBody:
      "Des colonnes romaines aux maisons ottomanes, avec les boulangeries, bars à jus et cuisine de rue qu'aiment les Beyrouthins.",
    tplBeirutIncluded: "Visite guidée dans votre langue",
    tplBeirutBring: "De l'appétit, des chaussures confortables",
    tplBeirutStops: "Thermes romains, Mosquée Mohammad Al-Amin, Gemmayzé, Mar Mikhaël",
    tplBaalbekTitle: "Les temples de Baalbek",
    tplBaalbekBody:
      "Tenez-vous sous les colonnes du temple de Jupiter et dans le temple de Bacchus, l'un des temples romains les mieux conservés au monde.",
    tplBaalbekIncluded: "Visite guidée dans votre langue",
    tplBaalbekBring: "Eau, chapeau, chaussures confortables",
    tplBaalbekStops: "Temples de Baalbek, Temple de Bacchus, Pierre de la femme enceinte",
    tplTyreTitle: "Tyr, la mer et les ruines",
    tplTyreBody:
      "Voies romaines, hippodrome et ville portuaire au bord de la mer : parcourez les sites archéologiques de Tyr et finissez sur la plage.",
    tplTyreIncluded: "Visite guidée dans votre langue",
    tplTyreBring: "Eau, chapeau, maillot si vous voulez vous baigner",
    tplTyreStops: "Site archéologique d'Al-Bass, Hippodrome de Tyr, Vieux port de Tyr",
  },
};

export type GuideJoinCopy = Record<GuideJoinKey, string>;

export function useGuideJoinCopy(): GuideJoinCopy {
  const { locale } = useLocale();
  return guideJoinCopy[locale];
}

export function guideJoinText(locale: Locale, key: GuideJoinKey): string {
  return guideJoinCopy[locale][key];
}
