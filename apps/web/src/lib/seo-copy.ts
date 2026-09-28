import type { Locale } from "@/lib/locale";

/**
 * Copy for search-facing pages: breadcrumbs, page titles, the Lebanon guide, the
 * things-to-do landing pages, About, and the question-and-answer blocks. Answers that
 * name places or counts are filled from the catalogue at render time, never written here.
 */
export type SeoKey =
  | "crumbHome"
  | "crumbDestinations"
  | "crumbExperiences"
  | "crumbThingsToDo"
  | "crumbGuide"
  | "crumbAbout"
  | "crumbNav"
  | "faqHeading"
  | "destTitle"
  | "destDescription"
  | "destFaqWhereQ"
  | "destFaqWhereA"
  | "destFaqWhereRegionA"
  | "destFaqDoQ"
  | "destFaqDoA"
  | "destFaqPlanQ"
  | "planAnswer"
  | "destRelatedTitle"
  | "expTitle"
  | "listJoin"
  | "thingsTitle"
  | "thingsDescription"
  | "thingsH1"
  | "thingsIntro"
  | "thingsBrowse"
  | "catWhereTitle"
  | "catPlacesTitle"
  | "catEmpty"
  | "catFaqQ"
  | "catFaqA"
  | "catSeeAll"
  | "cat_nature_name"
  | "cat_nature_title"
  | "cat_nature_intro"
  | "cat_coast_name"
  | "cat_coast_title"
  | "cat_coast_intro"
  | "cat_culture_name"
  | "cat_culture_title"
  | "cat_culture_intro"
  | "cat_adventure_name"
  | "cat_adventure_title"
  | "cat_adventure_intro"
  | "cat_city_name"
  | "cat_city_title"
  | "cat_city_intro"
  | "cat_food_name"
  | "cat_food_title"
  | "cat_food_intro"
  | "hubTitle"
  | "hubDescription"
  | "hubH1"
  | "hubAnswer"
  | "hubRegionsTitle"
  | "hubThingsTitle"
  | "hubPlacesTitle"
  | "hubPlanTitle"
  | "hubPlanBody"
  | "hubPlanCta"
  | "hubFaqSeeQ"
  | "hubFaqSeeA"
  | "hubFaqLangQ"
  | "hubFaqLangA"
  | "hubFaqCapitalQ"
  | "hubFaqCapitalA"
  | "hubFaqPlanQ"
  | "placesCount"
  | "aboutTitle"
  | "aboutDescription"
  | "aboutH1"
  | "aboutLead"
  | "aboutWhatTitle"
  | "aboutWhatBody"
  | "aboutDataTitle"
  | "aboutDataBody"
  | "aboutWhoTitle"
  | "aboutWhoBody"
  | "aboutContact"
  | "footerGuide"
  | "footerAbout"
  | "footerBadge"
  | "badgeTitle"
  | "badgeH1"
  | "badgeBody"
  | "badgeUrlLabel"
  | "badgeUrlHint"
  | "badgeUrlError"
  | "badgeStyleLabel"
  | "badgeLight"
  | "badgeDark"
  | "badgeCodeLabel"
  | "badgeCopy"
  | "badgeCopied"
  | "badgePreview"
  | "guideAbout"
  | "guideBestTime"
  | "guideGettingThere"
  | "guideSources"
  | "guideAdvice"
  | "destFaqWhenQ"
  | "destFaqHowQ"
  | "homeTitle"
  | "homeDescription"
  | "destinationsTitle"
  | "destinationsDescription"
  | "experiencesTitle"
  | "experiencesDescription";

export const seoCopy: Record<Locale, Record<SeoKey, string>> = {
  en: {
    crumbHome: "Home",
    crumbDestinations: "Destinations",
    crumbExperiences: "Experiences",
    crumbThingsToDo: "Things to do",
    crumbGuide: "Lebanon travel guide",
    crumbAbout: "About",
    crumbNav: "Breadcrumb",
    faqHeading: "Questions travellers ask",
    destTitle: "{name}, Lebanon: things to do and places to visit — Mshwar",
    destDescription:
      "Plan a day in {name}, {region}: real places to see, eat and stay, with opening hours and drive times.",
    destFaqWhereQ: "Where is {name}?",
    destFaqWhereA: "{name} is in {region}, Lebanon.",
    destFaqWhereRegionA: "{name} is one of Lebanon’s regions (governorates).",
    destFaqDoQ: "What is there to do in {name}?",
    destFaqDoA: "Mshwar lists {n} places in {name}, including {list}.",
    destFaqPlanQ: "How can I plan a day in {name}?",
    planAnswer:
      "Choose the places you want in Mshwar’s planner. It puts the stops in a sensible order, checks opening hours and works out the drive between them, and you can change anything before you save.",
    destRelatedTitle: "More in {region}",
    expTitle: "{title}, {place} — Mshwar",
    listJoin: ", ",
    thingsTitle: "Things to do in Lebanon — Mshwar",
    thingsDescription:
      "Nature, coast, culture, adventure, city life and food across Lebanon — real places with where they are and how long they take.",
    thingsH1: "Things to do in Lebanon",
    thingsIntro: "Pick a kind of day. Every place listed is real, with where it is and roughly how long it takes.",
    thingsBrowse: "Browse",
    catWhereTitle: "Where to go",
    catPlacesTitle: "Places",
    catEmpty: "No places are listed here yet.",
    catFaqQ: "Where in Lebanon is best for {thing}?",
    catFaqA: "On Mshwar, most of these places are in {list}.",
    catSeeAll: "See all",
    cat_nature_name: "nature",
    cat_nature_title: "Nature and hiking in Lebanon",
    cat_nature_intro:
      "Cedar forests, deep valleys, springs and mountain trails — Lebanon’s mountains start minutes from the coast.",
    cat_coast_name: "the coast",
    cat_coast_title: "Beaches and coastal towns in Lebanon",
    cat_coast_intro: "Old harbours, sea walls and long lunches by the Mediterranean, from the north to the south.",
    cat_culture_name: "culture and history",
    cat_culture_title: "Culture and history in Lebanon",
    cat_culture_intro:
      "Roman temples, Phoenician harbours, crusader castles, old souks and monasteries carved into the cliffs.",
    cat_adventure_name: "adventure",
    cat_adventure_title: "Adventure in Lebanon",
    cat_adventure_intro: "Longer hikes, caves, gorges and days that ask a little more of you.",
    cat_city_name: "city life",
    cat_city_title: "City life in Lebanon",
    cat_city_intro: "Museums, streets, markets and evenings in Lebanon’s towns and cities.",
    cat_food_name: "food",
    cat_food_title: "Where to eat in Lebanon",
    cat_food_intro: "Restaurants across the country, with where they are, so a meal fits the day you are planning.",
    hubTitle: "Lebanon travel guide: places to visit and things to do — Mshwar",
    hubDescription:
      "Where to go in Lebanon and what to do there: every region, real places to visit, and a planner that builds the day around you.",
    hubH1: "Lebanon travel guide",
    hubAnswer:
      "Lebanon fits mountains, coast, Roman and Phoenician history and a celebrated food culture into a small country, so most places are within a few hours’ drive of Beirut. Mshwar lists {destinations} destinations and {places} places you can visit, each with where it is and how long it takes.",
    hubRegionsTitle: "Regions and destinations",
    hubThingsTitle: "Things to do in Lebanon",
    hubPlacesTitle: "Places to start with",
    hubPlanTitle: "Turn it into a day",
    hubPlanBody: "Pick places, or describe the day you want. Mshwar orders the stops and works out the drives.",
    hubPlanCta: "Plan your trip",
    hubFaqSeeQ: "What are the best places to visit in Lebanon?",
    hubFaqSeeA:
      "The destinations with the most places on Mshwar are {list}. Each has its own page with what to do there.",
    hubFaqLangQ: "What languages are spoken in Lebanon?",
    hubFaqLangA:
      "Arabic is the official language. French and English are widely spoken, especially in Beirut and in tourism.",
    hubFaqCapitalQ: "What is the capital of Lebanon?",
    hubFaqCapitalA: "Beirut is the capital and largest city, on the coast in the middle of the country.",
    hubFaqPlanQ: "How do I plan a day out in Lebanon?",
    placesCount: "{n} places",
    aboutTitle: "About Mshwar — Lebanon, at your own pace",
    aboutDescription:
      "Mshwar helps people discover Lebanon and plan days around real, sourced places. Who we are, how our information works, and how to reach us.",
    aboutH1: "About Mshwar",
    aboutLead:
      "Mshwar (مشوار — “an outing”) helps travellers, the Lebanese diaspora and residents discover Lebanon and plan a day that fits them.",
    aboutWhatTitle: "What Mshwar does",
    aboutWhatBody:
      "Browse destinations and places across the country, save the ones you like, and let the planner turn them into a day: in a sensible order, within opening hours, with the drive between stops worked out.",
    aboutDataTitle: "How our information works",
    aboutDataBody:
      "Every place comes from a source we can name, such as official listings or OpenStreetMap, credited on the place’s page. Prices are published or marked “on request” — never guessed — and the AI writes words, not facts.",
    aboutWhoTitle: "Who is behind it",
    aboutWhoBody: "Mshwar is built in Lebanon by Abdalrahman Hajjo.",
    aboutContact: "Contact us",
    footerGuide: "Lebanon travel guide",
    footerAbout: "About Mshwar",
    footerBadge: "Badge for partners",
    badgeTitle: "Link to your Mshwar page — Mshwar",
    badgeH1: "Show travellers where to find you",
    badgeBody:
      "Listed on Mshwar as a place, guide or driver? Add this badge to your website so travellers can see your opening hours, location and plan a day around you.",
    badgeUrlLabel: "Your Mshwar page",
    badgeUrlHint: "Open your page on Mshwar and copy its address from the browser.",
    badgeUrlError: "Use the address of a page on mshwarlb.com.",
    badgeStyleLabel: "Style",
    badgeLight: "Light",
    badgeDark: "Dark",
    badgeCodeLabel: "Code to paste into your website",
    badgeCopy: "Copy code",
    badgeCopied: "Copied",
    badgePreview: "Preview",
    guideAbout: "About {name}",
    guideBestTime: "Best time to visit",
    guideGettingThere: "Getting there",
    guideSources: "Sources",
    guideAdvice: "Check your government’s current travel advice for this area before you go.",
    destFaqWhenQ: "When is the best time to visit {name}?",
    destFaqHowQ: "How do I get to {name}?",
    homeTitle: "Mshwar — Lebanon, at your own pace",
    homeDescription:
      "Discover real, sourced places across Lebanon and plan a day that fits you — from the cedars to the sea.",
    destinationsTitle: "Destinations in Lebanon — Mshwar",
    destinationsDescription:
      "Every region and town on Mshwar, from Beirut and Byblos to the Qadisha Valley and Baalbek, with the places to visit in each.",
    experiencesTitle: "Things to do and places to visit in Lebanon — Mshwar",
    experiencesDescription:
      "Search real places across Lebanon by kind, region and time: sights, experiences and restaurants, with where they are and how long they take.",
  },
  ar: {
    crumbHome: "الرئيسية",
    crumbDestinations: "الوجهات",
    crumbExperiences: "التجارب",
    crumbThingsToDo: "ماذا تفعل",
    crumbGuide: "دليل السفر إلى لبنان",
    crumbAbout: "من نحن",
    crumbNav: "مسار التنقّل",
    faqHeading: "أسئلة يطرحها المسافرون",
    destTitle: "{name}، لبنان: أماكن تزورها وأشياء تفعلها — مشوار",
    destDescription:
      "خطّط ليومك في {name}، {region}: أماكن حقيقية للزيارة والأكل والإقامة، مع ساعات العمل ومدّة القيادة.",
    destFaqWhereQ: "أين تقع {name}؟",
    destFaqWhereA: "تقع {name} في {region}، لبنان.",
    destFaqWhereRegionA: "{name} إحدى مناطق (محافظات) لبنان.",
    destFaqDoQ: "ماذا يمكن أن أفعل في {name}؟",
    destFaqDoA: "يعرض مشوار {n} مكانًا في {name}، منها {list}.",
    destFaqPlanQ: "كيف أخطّط ليوم في {name}؟",
    planAnswer:
      "اختر الأماكن التي تريدها في مخطِّط مشوار. يرتّب المحطات ترتيبًا منطقيًا، ويتحقّق من ساعات العمل، ويحسب مدّة القيادة بينها، ويمكنك تعديل أي شيء قبل الحفظ.",
    destRelatedTitle: "المزيد في {region}",
    expTitle: "{title}، {place} — مشوار",
    listJoin: "، ",
    thingsTitle: "ماذا تفعل في لبنان — مشوار",
    thingsDescription:
      "طبيعة وساحل وثقافة ومغامرة وحياة المدن وطعام في كل لبنان — أماكن حقيقية مع موقعها ومدّة زيارتها.",
    thingsH1: "ماذا تفعل في لبنان",
    thingsIntro: "اختر نوع يومك. كل مكان هنا حقيقي، مع موقعه ومدّة زيارته التقريبية.",
    thingsBrowse: "تصفّح",
    catWhereTitle: "إلى أين تذهب",
    catPlacesTitle: "أماكن",
    catEmpty: "لا أماكن هنا بعد.",
    catFaqQ: "أين في لبنان الأفضل لـ{thing}؟",
    catFaqA: "على مشوار، معظم هذه الأماكن في {list}.",
    catSeeAll: "عرض الكل",
    cat_nature_name: "الطبيعة",
    cat_nature_title: "الطبيعة والمشي في لبنان",
    cat_nature_intro: "غابات أرز ووديان عميقة وينابيع ودروب جبلية — جبال لبنان تبدأ على بعد دقائق من الساحل.",
    cat_coast_name: "الساحل",
    cat_coast_title: "الشواطئ والمدن الساحلية في لبنان",
    cat_coast_intro: "موانئ قديمة وأسوار بحرية وغداء طويل على المتوسط، من الشمال إلى الجنوب.",
    cat_culture_name: "الثقافة والتاريخ",
    cat_culture_title: "الثقافة والتاريخ في لبنان",
    cat_culture_intro: "معابد رومانية وموانئ فينيقية وقلاع صليبية وأسواق قديمة وأديرة محفورة في الصخر.",
    cat_adventure_name: "المغامرة",
    cat_adventure_title: "المغامرة في لبنان",
    cat_adventure_intro: "مسارات أطول ومغاور ووديان وأيام تطلب منك جهدًا أكبر قليلًا.",
    cat_city_name: "حياة المدن",
    cat_city_title: "حياة المدن في لبنان",
    cat_city_intro: "متاحف وشوارع وأسواق وأمسيات في مدن لبنان وبلداته.",
    cat_food_name: "الطعام",
    cat_food_title: "أين تأكل في لبنان",
    cat_food_intro: "مطاعم في كل البلد مع موقعها، ليتّسع الغداء ليومك كما تخطّط له.",
    hubTitle: "دليل السفر إلى لبنان: أماكن تزورها وأشياء تفعلها — مشوار",
    hubDescription:
      "إلى أين تذهب في لبنان وماذا تفعل هناك: كل المناطق، وأماكن حقيقية للزيارة، ومخطِّط يبني اليوم حولك.",
    hubH1: "دليل السفر إلى لبنان",
    hubAnswer:
      "يجمع لبنان الجبال والساحل والتاريخ الروماني والفينيقي ومطبخًا مشهورًا في بلد صغير، فمعظم الأماكن على بعد ساعات قليلة بالسيارة من بيروت. يعرض مشوار {destinations} وجهة و{places} مكانًا يمكنك زيارتها، لكلٍّ منها موقعه ومدّة زيارته.",
    hubRegionsTitle: "المناطق والوجهات",
    hubThingsTitle: "ماذا تفعل في لبنان",
    hubPlacesTitle: "أماكن للبداية",
    hubPlanTitle: "حوّلها إلى يوم",
    hubPlanBody: "اختر أماكن، أو صِف اليوم الذي تريده. يرتّب مشوار المحطات ويحسب مدّة القيادة.",
    hubPlanCta: "خطّط لرحلتك",
    hubFaqSeeQ: "ما أفضل الأماكن لزيارتها في لبنان؟",
    hubFaqSeeA: "الوجهات التي تضمّ أكبر عدد من الأماكن على مشوار هي {list}. لكلٍّ منها صفحة بما يمكن فعله هناك.",
    hubFaqLangQ: "ما اللغات المستخدمة في لبنان؟",
    hubFaqLangA: "العربية هي اللغة الرسمية. والفرنسية والإنجليزية منتشرتان، خاصة في بيروت وفي القطاع السياحي.",
    hubFaqCapitalQ: "ما عاصمة لبنان؟",
    hubFaqCapitalA: "بيروت هي العاصمة وأكبر مدينة، وتقع على الساحل في وسط البلاد.",
    hubFaqPlanQ: "كيف أخطّط ليوم في لبنان؟",
    placesCount: "{n} مكانًا",
    aboutTitle: "من نحن — مشوار، لبنان على مهلك",
    aboutDescription:
      "يساعد مشوار الناس على اكتشاف لبنان والتخطيط لأيامهم حول أماكن حقيقية موثّقة المصدر. من نحن، وكيف تعمل معلوماتنا، وكيف تتواصل معنا.",
    aboutH1: "من نحن",
    aboutLead: "يساعد مشوار المسافرين واللبنانيين في الاغتراب والمقيمين على اكتشاف لبنان والتخطيط ليوم يناسبهم.",
    aboutWhatTitle: "ماذا يفعل مشوار",
    aboutWhatBody:
      "تصفّح الوجهات والأماكن في كل البلد، واحفظ ما يعجبك، ودع المخطِّط يحوّلها إلى يوم: بترتيب منطقي، ضمن ساعات العمل، مع حساب مدّة القيادة بين المحطات.",
    aboutDataTitle: "كيف تعمل معلوماتنا",
    aboutDataBody:
      "لكل مكان مصدر نستطيع تسميته، مثل القوائم الرسمية أو OpenStreetMap، ويُذكر على صفحة المكان. الأسعار منشورة أو «عند الطلب» — لا نخمّنها أبدًا — والذكاء الاصطناعي يكتب الكلمات لا الحقائق.",
    aboutWhoTitle: "من وراء مشوار",
    aboutWhoBody: "يُبنى مشوار في لبنان على يد عبد الرحمن حجو.",
    aboutContact: "تواصل معنا",
    footerGuide: "دليل السفر إلى لبنان",
    footerAbout: "من نحن",
    footerBadge: "شارة للشركاء",
    badgeTitle: "اربط صفحتك على مشوار — مشوار",
    badgeH1: "أرِ المسافرين أين يجدونك",
    badgeBody:
      "هل أنت مُدرج على مشوار كمكان أو مرشد أو سائق؟ أضف هذه الشارة إلى موقعك ليطّلع المسافرون على ساعات العمل والموقع ويخطّطوا يومهم حولك.",
    badgeUrlLabel: "صفحتك على مشوار",
    badgeUrlHint: "افتح صفحتك على مشوار وانسخ عنوانها من المتصفّح.",
    badgeUrlError: "استخدم عنوان صفحة على mshwarlb.com.",
    badgeStyleLabel: "النمط",
    badgeLight: "فاتح",
    badgeDark: "داكن",
    badgeCodeLabel: "الرمز الذي تلصقه في موقعك",
    badgeCopy: "انسخ الرمز",
    badgeCopied: "تم النسخ",
    badgePreview: "معاينة",
    guideAbout: "عن {name}",
    guideBestTime: "أفضل وقت للزيارة",
    guideGettingThere: "كيف تصل",
    guideSources: "المصادر",
    guideAdvice: "راجع إرشادات السفر الحالية الصادرة عن حكومتك بشأن هذه المنطقة قبل الذهاب.",
    destFaqWhenQ: "ما أفضل وقت لزيارة {name}؟",
    destFaqHowQ: "كيف أصل إلى {name}؟",
    homeTitle: "مشوار — لبنان على مهلك",
    homeDescription: "اكتشف أماكن حقيقية موثّقة المصدر في كل لبنان، وخطّط ليوم يناسبك — من الأرز إلى البحر.",
    destinationsTitle: "الوجهات في لبنان — مشوار",
    destinationsDescription:
      "كل منطقة وبلدة على مشوار، من بيروت وجبيل إلى وادي قاديشا وبعلبك، مع الأماكن التي تستحق الزيارة في كلٍّ منها.",
    experiencesTitle: "ماذا تفعل وأين تذهب في لبنان — مشوار",
    experiencesDescription:
      "ابحث عن أماكن حقيقية في كل لبنان حسب النوع والمنطقة والوقت: معالم وتجارب ومطاعم، مع موقعها ومدّة زيارتها.",
  },
  fr: {
    crumbHome: "Accueil",
    crumbDestinations: "Destinations",
    crumbExperiences: "Expériences",
    crumbThingsToDo: "Que faire",
    crumbGuide: "Guide de voyage au Liban",
    crumbAbout: "À propos",
    crumbNav: "Fil d’Ariane",
    faqHeading: "Les questions des voyageurs",
    destTitle: "{name}, Liban : que faire et que visiter — Mshwar",
    destDescription:
      "Organisez une journée à {name}, {region} : de vrais lieux à voir, où manger et dormir, avec horaires et temps de route.",
    destFaqWhereQ: "Où se trouve {name} ?",
    destFaqWhereA: "{name} se trouve dans la région {region}, au Liban.",
    destFaqWhereRegionA: "{name} est l’une des régions (gouvernorats) du Liban.",
    destFaqDoQ: "Que faire à {name} ?",
    destFaqDoA: "Mshwar référence {n} lieux à {name}, dont {list}.",
    destFaqPlanQ: "Comment organiser une journée à {name} ?",
    planAnswer:
      "Choisissez vos lieux dans le planificateur de Mshwar. Il met les étapes dans un ordre logique, vérifie les horaires et calcule la route entre elles, et vous pouvez tout modifier avant d’enregistrer.",
    destRelatedTitle: "Plus dans la région {region}",
    expTitle: "{title}, {place} — Mshwar",
    listJoin: ", ",
    thingsTitle: "Que faire au Liban — Mshwar",
    thingsDescription:
      "Nature, côte, culture, aventure, vie urbaine et gastronomie dans tout le Liban — de vrais lieux, avec leur emplacement et leur durée.",
    thingsH1: "Que faire au Liban",
    thingsIntro: "Choisissez un type de journée. Chaque lieu est réel, avec son emplacement et une durée indicative.",
    thingsBrowse: "Parcourir",
    catWhereTitle: "Où aller",
    catPlacesTitle: "Lieux",
    catEmpty: "Aucun lieu n’est encore référencé ici.",
    catFaqQ: "Où aller au Liban pour {thing} ?",
    catFaqA: "Sur Mshwar, la plupart de ces lieux se trouvent à {list}.",
    catSeeAll: "Tout voir",
    cat_nature_name: "la nature",
    cat_nature_title: "Nature et randonnée au Liban",
    cat_nature_intro:
      "Forêts de cèdres, vallées profondes, sources et sentiers de montagne — au Liban, la montagne commence à quelques minutes de la côte.",
    cat_coast_name: "la côte",
    cat_coast_title: "Plages et villes côtières au Liban",
    cat_coast_intro: "Vieux ports, remparts marins et longs déjeuners au bord de la Méditerranée, du nord au sud.",
    cat_culture_name: "la culture et l’histoire",
    cat_culture_title: "Culture et histoire au Liban",
    cat_culture_intro:
      "Temples romains, ports phéniciens, châteaux croisés, vieux souks et monastères creusés dans la falaise.",
    cat_adventure_name: "l’aventure",
    cat_adventure_title: "Aventure au Liban",
    cat_adventure_intro: "Randonnées plus longues, grottes, gorges et journées un peu plus exigeantes.",
    cat_city_name: "la vie urbaine",
    cat_city_title: "La vie urbaine au Liban",
    cat_city_intro: "Musées, rues, marchés et soirées dans les villes du Liban.",
    cat_food_name: "la gastronomie",
    cat_food_title: "Où manger au Liban",
    cat_food_intro:
      "Des restaurants dans tout le pays, avec leur emplacement, pour que le repas s’intègre à votre journée.",
    hubTitle: "Guide de voyage au Liban : que visiter et que faire — Mshwar",
    hubDescription:
      "Où aller au Liban et que faire sur place : toutes les régions, de vrais lieux à visiter et un planificateur qui construit la journée pour vous.",
    hubH1: "Guide de voyage au Liban",
    hubAnswer:
      "Le Liban réunit montagnes, côte, histoire romaine et phénicienne et une cuisine réputée dans un petit pays : la plupart des lieux sont à quelques heures de route de Beyrouth. Mshwar référence {destinations} destinations et {places} lieux à visiter, chacun avec son emplacement et sa durée.",
    hubRegionsTitle: "Régions et destinations",
    hubThingsTitle: "Que faire au Liban",
    hubPlacesTitle: "Des lieux pour commencer",
    hubPlanTitle: "En faire une journée",
    hubPlanBody: "Choisissez des lieux ou décrivez la journée voulue. Mshwar ordonne les étapes et calcule la route.",
    hubPlanCta: "Planifier votre voyage",
    hubFaqSeeQ: "Quels sont les meilleurs endroits à visiter au Liban ?",
    hubFaqSeeA:
      "Les destinations qui comptent le plus de lieux sur Mshwar sont {list}. Chacune a sa page avec ce qu’on peut y faire.",
    hubFaqLangQ: "Quelles langues parle-t-on au Liban ?",
    hubFaqLangA:
      "L’arabe est la langue officielle. Le français et l’anglais sont très répandus, surtout à Beyrouth et dans le tourisme.",
    hubFaqCapitalQ: "Quelle est la capitale du Liban ?",
    hubFaqCapitalA: "Beyrouth est la capitale et la plus grande ville, sur la côte au centre du pays.",
    hubFaqPlanQ: "Comment organiser une journée au Liban ?",
    placesCount: "{n} lieux",
    aboutTitle: "À propos de Mshwar — le Liban à votre rythme",
    aboutDescription:
      "Mshwar aide à découvrir le Liban et à organiser ses journées autour de lieux réels et sourcés. Qui nous sommes, comment fonctionnent nos informations, comment nous joindre.",
    aboutH1: "À propos de Mshwar",
    aboutLead:
      "Mshwar (مشوار — « une sortie ») aide les voyageurs, la diaspora libanaise et les résidents à découvrir le Liban et à organiser une journée qui leur ressemble.",
    aboutWhatTitle: "Ce que fait Mshwar",
    aboutWhatBody:
      "Parcourez les destinations et les lieux du pays, enregistrez ceux qui vous plaisent et laissez le planificateur en faire une journée : dans un ordre logique, dans les horaires, avec la route calculée entre les étapes.",
    aboutDataTitle: "D’où viennent nos informations",
    aboutDataBody:
      "Chaque lieu vient d’une source que nous pouvons nommer, comme les listes officielles ou OpenStreetMap, créditée sur sa page. Les prix sont publiés ou « sur demande » — jamais devinés — et l’IA écrit les mots, pas les faits.",
    aboutWhoTitle: "Qui est derrière Mshwar",
    aboutWhoBody: "Mshwar est conçu au Liban par Abdalrahman Hajjo.",
    aboutContact: "Nous contacter",
    footerGuide: "Guide de voyage au Liban",
    footerAbout: "À propos de Mshwar",
    footerBadge: "Badge partenaires",
    badgeTitle: "Lien vers votre page Mshwar — Mshwar",
    badgeH1: "Montrez aux voyageurs où vous trouver",
    badgeBody:
      "Référencé sur Mshwar comme lieu, guide ou chauffeur ? Ajoutez ce badge à votre site pour que les voyageurs voient vos horaires, votre emplacement et organisent une journée autour de vous.",
    badgeUrlLabel: "Votre page Mshwar",
    badgeUrlHint: "Ouvrez votre page sur Mshwar et copiez son adresse depuis le navigateur.",
    badgeUrlError: "Utilisez l’adresse d’une page sur mshwarlb.com.",
    badgeStyleLabel: "Style",
    badgeLight: "Clair",
    badgeDark: "Foncé",
    badgeCodeLabel: "Code à coller dans votre site",
    badgeCopy: "Copier le code",
    badgeCopied: "Copié",
    badgePreview: "Aperçu",
    guideAbout: "À propos de {name}",
    guideBestTime: "Meilleure période",
    guideGettingThere: "Comment y aller",
    guideSources: "Sources",
    guideAdvice: "Consultez les conseils aux voyageurs de votre gouvernement pour cette zone avant de partir.",
    destFaqWhenQ: "Quelle est la meilleure période pour visiter {name} ?",
    destFaqHowQ: "Comment aller à {name} ?",
    homeTitle: "Mshwar — le Liban à votre rythme",
    homeDescription:
      "Découvrez de vrais lieux sourcés dans tout le Liban et organisez une journée qui vous ressemble — des cèdres à la mer.",
    destinationsTitle: "Destinations au Liban — Mshwar",
    destinationsDescription:
      "Chaque région et ville sur Mshwar, de Beyrouth et Byblos à la vallée de la Qadisha et Baalbek, avec les lieux à visiter.",
    experiencesTitle: "Que faire et que visiter au Liban — Mshwar",
    experiencesDescription:
      "Cherchez de vrais lieux dans tout le Liban par type, région et durée : sites, expériences et restaurants, avec leur emplacement et leur durée.",
  },
};

/** Fill {placeholders}; missing values are left visible so a gap is noticed, not hidden. */
export function seoText(locale: Locale, key: SeoKey, values: Record<string, string | number> = {}): string {
  return seoCopy[locale][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
