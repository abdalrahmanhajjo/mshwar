/**
 * Editorial overviews for the main destinations, in English and Arabic.
 *
 * These are written words, not catalogue data, so each one must be read and approved by a
 * person before it is shown: set `reviewed` to true (and fill `reviewedBy`) only after
 * checking every sentence. Until then the destination page shows the catalogue only.
 * Keep to facts that are well established and add a source for anything specific.
 * French falls back to English.
 */

type Text = { en: string; ar: string };

export type DestinationGuide = {
  /** Two or three short paragraphs: what the place is and why people go. */
  overview: { en: string[]; ar: string[] };
  bestTime: Text;
  gettingThere: Text;
  /** Shown for places where official travel advice changes often. */
  checkAdvice?: boolean;
  sources: { label: string; url: string }[];
  reviewed: boolean;
  reviewedBy?: string;
};

const UNESCO = (id: number, label: string) => ({
  label: `UNESCO World Heritage: ${label}`,
  url: `https://whc.unesco.org/en/list/${id}`,
});

export const DESTINATION_GUIDES: Record<string, DestinationGuide> = {
  beirut: {
    overview: {
      en: [
        "Beirut is Lebanon’s capital and largest city, built on a headland that juts into the Mediterranean. It is where most trips begin, and it rewards a day or two of its own.",
        "Walk the seafront Corniche to the Raouché (Pigeon) Rocks, spend a morning at the National Museum of Beirut, and look for Roman remains among the rebuilt streets of the city centre. In the evening, the neighbourhoods of Gemmayzeh, Mar Mikhael and Hamra fill with cafés, bars and restaurants.",
      ],
      ar: [
        "بيروت عاصمة لبنان وأكبر مدنه، تقوم على رأس يمتدّ في البحر المتوسط. منها تبدأ معظم الرحلات، وتستحق يومًا أو يومين وحدها.",
        "امشِ على الكورنيش البحري حتى صخرة الروشة، وأمضِ صباحًا في المتحف الوطني في بيروت، وابحث عن الآثار الرومانية بين شوارع الوسط المُعاد بناؤه. وفي المساء تمتلئ أحياء الجميزة ومار مخايل والحمرا بالمقاهي والحانات والمطاعم.",
      ],
    },
    bestTime: {
      en: "Spring (April to June) and autumn (September to November) are the most comfortable; summers are hot and humid.",
      ar: "الربيع (من نيسان إلى حزيران) والخريف (من أيلول إلى تشرين الثاني) هما الأنسب؛ أما الصيف فحارّ ورطب.",
    },
    gettingThere: {
      en: "Beirut–Rafic Hariri International Airport is on the southern edge of the city. Within Beirut, taxis and ride-hailing apps are the easiest way around.",
      ar: "يقع مطار رفيق الحريري الدولي على الطرف الجنوبي للمدينة. وداخل بيروت، سيارات الأجرة وتطبيقات النقل هي أسهل وسيلة للتنقّل.",
    },
    sources: [],
    reviewed: false,
  },
  byblos: {
    overview: {
      en: [
        "Byblos (Jbeil) is one of the oldest continuously inhabited towns in the world and a UNESCO World Heritage Site. The Phoenician port gave its name to the Greek word for papyrus — and through it, to the word “Bible”.",
        "The archaeological site layers Bronze Age temples, a Roman theatre and a Crusader castle above the sea. Around it, the restored old souk and the small fishing harbour make for an easy half-day, ideally ending with lunch by the water.",
      ],
      ar: [
        "جبيل من أقدم المدن المأهولة باستمرار في العالم، وهي مُدرجة على لائحة التراث العالمي لليونسكو. أعطى مرفؤها الفينيقي اسمه للكلمة اليونانية التي تعني ورق البردي، ومنها جاءت كلمة «الكتاب المقدّس» في اللغات الأوروبية.",
        "يجمع الموقع الأثري معابد من العصر البرونزي ومسرحًا رومانيًا وقلعة صليبية فوق البحر. وحوله يشكّل السوق القديم المرمَّم والمرفأ الصغير نصف نهار سهلًا، يُختَم عادةً بغداء قرب الماء.",
      ],
    },
    bestTime: {
      en: "April to June and September to October; summer weekends are busy.",
      ar: "من نيسان إلى حزيران ومن أيلول إلى تشرين الأول؛ وعطلات الصيف مزدحمة.",
    },
    gettingThere: {
      en: "About 40 km north of Beirut on the coastal highway — usually under an hour by car outside rush hour.",
      ar: "على بعد نحو 40 كلم شمال بيروت عبر الأوتوستراد الساحلي — أقل من ساعة بالسيارة عادةً خارج أوقات الذروة.",
    },
    sources: [UNESCO(295, "Byblos")],
    reviewed: false,
  },
  batroun: {
    overview: {
      en: [
        "Batroun is a small coastal town north of Byblos, known for its old stone souk, its churches by the sea and its fresh lemonade. Part of an ancient Phoenician sea wall still stands on the shore.",
        "Days here are slow: a walk through the old town, a swim, a long seafood lunch. In summer the beaches and bars along the coast make it one of the liveliest weekend spots in the country.",
      ],
      ar: [
        "البترون بلدة ساحلية صغيرة شمال جبيل، تشتهر بسوقها الحجري القديم وكنائسها على البحر وعصير الليموناضة. ولا يزال جزء من سور بحري فينيقي قديم قائمًا على الشاطئ.",
        "الأيام هنا هادئة: نزهة في البلدة القديمة، سباحة، وغداء طويل من ثمار البحر. وفي الصيف تجعلها الشواطئ والحانات على الساحل من أكثر وجهات نهاية الأسبوع حيوية في البلاد.",
      ],
    },
    bestTime: {
      en: "June to September for the sea; spring and autumn for walking the old town without crowds.",
      ar: "من حزيران إلى أيلول للبحر؛ والربيع والخريف للتجوّل في البلدة القديمة بعيدًا عن الزحام.",
    },
    gettingThere: {
      en: "About 50 km north of Beirut on the coastal highway, roughly an hour by car.",
      ar: "على بعد نحو 50 كلم شمال بيروت عبر الأوتوستراد الساحلي، أي ساعة تقريبًا بالسيارة.",
    },
    sources: [],
    reviewed: false,
  },
  bsharri: {
    overview: {
      en: [
        "Bsharri is a mountain town on the rim of the Qadisha Valley and the birthplace of the poet and artist Gibran Khalil Gibran, whose museum occupies the old Mar Sarkis monastery above the town.",
        "Higher up the road is the Cedars of God, one of the last groves of the ancient cedar forests, protected together with the Qadisha Valley as a UNESCO World Heritage Site. In winter the slopes above the grove become a ski area.",
      ],
      ar: [
        "بشرّي بلدة جبلية على حافة وادي قاديشا، ومسقط رأس الشاعر والفنان جبران خليل جبران، ويقع متحفه في دير مار سركيس القديم فوق البلدة.",
        "وفي أعلى الطريق غابة أرز الربّ، من آخر بقايا غابات الأرز القديمة، وهي محميّة مع وادي قاديشا ضمن التراث العالمي لليونسكو. وفي الشتاء تصبح المنحدرات فوق الغابة منطقة للتزلّج.",
      ],
    },
    bestTime: {
      en: "May to October for walking and the cedars; December to March for snow.",
      ar: "من أيار إلى تشرين الأول للمشي وزيارة الأرز؛ ومن كانون الأول إلى آذار للثلج.",
    },
    gettingThere: {
      en: "Around two and a half hours by car from Beirut: north along the coast, then up the mountain road. Mountain roads can close briefly after heavy snow.",
      ar: "نحو ساعتين ونصف بالسيارة من بيروت: شمالًا على الساحل ثم صعودًا عبر الطريق الجبلية. وقد تُقفل الطرق الجبلية لفترة قصيرة بعد تساقط الثلوج بكثافة.",
    },
    sources: [UNESCO(850, "Ouadi Qadisha and the Forest of the Cedars of God")],
    reviewed: false,
  },
  "qadisha-valley": {
    overview: {
      en: [
        "The Qadisha Valley — the “Holy Valley” — is a deep gorge in northern Lebanon where monks and hermits lived for centuries in monasteries and caves cut into the cliffs. With the nearby Cedars of God it is a UNESCO World Heritage Site.",
        "Footpaths along the valley floor link the monasteries of Qannoubine, long the seat of the Maronite patriarchs, and Saint Anthony of Qozhaya, home to one of the first printing presses in the Middle East. It is one of the most rewarding walks in the country.",
      ],
      ar: [
        "وادي قاديشا — «الوادي المقدّس» — وادٍ عميق في شمال لبنان عاش فيه الرهبان والنسّاك قرونًا في أديرة ومغاور محفورة في المنحدرات الصخرية. وهو مع غابة أرز الربّ القريبة مُدرج على لائحة التراث العالمي لليونسكو.",
        "تربط الدروب في قعر الوادي بين دير قنّوبين، الذي كان مقرّ البطاركة الموارنة زمنًا طويلًا، ودير مار أنطونيوس قزحيا حيث واحدة من أولى المطابع في الشرق الأوسط. وهو من أجمل مسارات المشي في البلاد.",
      ],
    },
    bestTime: {
      en: "April to June and September to November; paths can be muddy or closed in winter.",
      ar: "من نيسان إلى حزيران ومن أيلول إلى تشرين الثاني؛ وقد تكون الدروب موحلة أو مقفلة في الشتاء.",
    },
    gettingThere: {
      en: "Reached from the villages on its rim, such as Bsharri, Hadchit or Hasroun, about two and a half hours by car from Beirut. Wear proper shoes: the descent is steep.",
      ar: "يُدخَل إليه من القرى على حافته مثل بشرّي وحدشيت وحصرون، على بعد نحو ساعتين ونصف بالسيارة من بيروت. ارتدِ حذاءً مناسبًا فالنزول شديد الانحدار.",
    },
    sources: [UNESCO(850, "Ouadi Qadisha and the Forest of the Cedars of God")],
    reviewed: false,
  },
  baalbek: {
    overview: {
      en: [
        "Baalbek, the Roman Heliopolis, holds some of the largest and best-preserved Roman temples anywhere and is a UNESCO World Heritage Site. The Temple of Bacchus is almost complete; six towering columns remain of the Temple of Jupiter.",
        "Nearby, the ancient quarry holds enormous cut stones that were never moved, and each summer the Baalbek International Festival stages concerts among the ruins.",
      ],
      ar: [
        "بعلبك، هليوبوليس الرومانية، تضمّ من أكبر المعابد الرومانية وأفضلها حفظًا في العالم، وهي مُدرجة على لائحة التراث العالمي لليونسكو. معبد باخوس شبه مكتمل، وتبقى ستّ أعمدة شاهقة من معبد جوبيتر.",
        "وعلى مقربة منها مقلع قديم يضمّ حجارة هائلة مقطوعة لم تُنقَل قطّ، وفي كل صيف يقيم مهرجان بعلبك الدولي حفلاته بين الأعمدة.",
      ],
    },
    bestTime: {
      en: "April to June and September to October; summer days are hot and dry, winters cold.",
      ar: "من نيسان إلى حزيران ومن أيلول إلى تشرين الأول؛ نهارات الصيف حارّة وجافّة والشتاء بارد.",
    },
    gettingThere: {
      en: "About two hours by car from Beirut, over the mountains and across the Bekaa valley.",
      ar: "نحو ساعتين بالسيارة من بيروت، عبر الجبال ثم سهل البقاع.",
    },
    checkAdvice: true,
    sources: [UNESCO(294, "Baalbek")],
    reviewed: false,
  },
  "mount-lebanon": {
    overview: {
      en: [
        "Mount Lebanon runs from the coast north and south of Beirut up to the high peaks, so a single day can move from the sea to pine forests and mountain villages.",
        "Highlights include the limestone caves of Jeita Grotto, the shrine of Our Lady of Lebanon at Harissa above the Bay of Jounieh, the stone village of Deir el-Qamar and the palace of Beiteddine in the Chouf, and the Chouf Cedar Reserve. In winter, Faraya and Mzaar are the country’s best-known ski resorts.",
      ],
      ar: [
        "يمتدّ جبل لبنان من الساحل شمال بيروت وجنوبها صعودًا حتى القمم العالية، فيمكن في يوم واحد الانتقال من البحر إلى غابات الصنوبر والقرى الجبلية.",
        "من أبرز معالمه مغارة جعيتا الكلسية، ومزار سيدة لبنان في حريصا المطلّ على خليج جونية، وبلدة دير القمر الحجرية وقصر بيت الدين في الشوف، ومحمية أرز الشوف. وفي الشتاء تُعدّ فاريا ومزار أشهر منتجعات التزلّج في البلاد.",
      ],
    },
    bestTime: {
      en: "Spring and autumn for villages and walking; summer for cooler mountain air; December to March for skiing.",
      ar: "الربيع والخريف للقرى والمشي؛ والصيف لهواء الجبل الأبرد؛ ومن كانون الأول إلى آذار للتزلّج.",
    },
    gettingThere: {
      en: "Most places are within an hour or so of Beirut by car; mountain roads are slower than the distance suggests.",
      ar: "معظم الأماكن على بعد ساعة تقريبًا بالسيارة من بيروت؛ لكن الطرق الجبلية أبطأ مما توحي به المسافة.",
    },
    sources: [],
    reviewed: false,
  },
  "north-lebanon": {
    overview: {
      en: [
        "North Lebanon combines the coast, the high mountains and Tripoli, the country’s second-largest city, whose old souks, khans and Mamluk-era mosques are among the richest historic quarters in the region.",
        "Inland, the Qadisha Valley, Bsharri and the Cedars of God draw walkers and pilgrims, while Batroun and the coast south of Tripoli are made for slow days by the sea.",
      ],
      ar: [
        "يجمع الشمال الساحلَ والجبالَ العالية وطرابلس، ثاني أكبر مدن البلاد، التي تُعدّ أسواقها القديمة وخاناتها ومساجدها المملوكية من أغنى الأحياء التاريخية في المنطقة.",
        "وفي الداخل يجذب وادي قاديشا وبشرّي وأرز الربّ هواةَ المشي والزوّار، فيما تصلح البترون والساحل جنوب طرابلس لأيام هادئة على البحر.",
      ],
    },
    bestTime: {
      en: "April to June and September to October; summer for the coast, winter for snow in the mountains.",
      ar: "من نيسان إلى حزيران ومن أيلول إلى تشرين الأول؛ الصيف للساحل والشتاء لثلوج الجبال.",
    },
    gettingThere: {
      en: "Tripoli is about 85 km north of Beirut on the coastal highway, roughly an hour and a half by car.",
      ar: "تقع طرابلس على بعد نحو 85 كلم شمال بيروت عبر الأوتوستراد الساحلي، أي ساعة ونصف تقريبًا بالسيارة.",
    },
    sources: [UNESCO(850, "Ouadi Qadisha and the Forest of the Cedars of God")],
    reviewed: false,
  },
  "south-lebanon": {
    overview: {
      en: [
        "South Lebanon’s coast holds two of the great Phoenician cities. In Sidon (Saida), the Crusader Sea Castle stands on a small island joined to the shore, next to an old souk and the Khan el-Franj caravanserai.",
        "Further south, Tyre (Sour) is a UNESCO World Heritage Site with a Roman hippodrome, colonnaded streets and a long sandy coast protected as a nature reserve.",
      ],
      ar: [
        "يضمّ ساحل الجنوب اثنتين من كبرى المدن الفينيقية. ففي صيدا تقوم قلعة البحر الصليبية على جزيرة صغيرة موصولة بالشاطئ، قرب السوق القديم وخان الإفرنج.",
        "وأبعد جنوبًا، صور مُدرجة على لائحة التراث العالمي لليونسكو، وفيها ميدان سباق روماني وشوارع معمّدة وساحل رملي طويل محميّ كمحمية طبيعية.",
      ],
    },
    bestTime: {
      en: "April to June and September to October; July and August for the beaches.",
      ar: "من نيسان إلى حزيران ومن أيلول إلى تشرين الأول؛ وتموز وآب للشواطئ.",
    },
    gettingThere: {
      en: "Sidon is about 45 km south of Beirut and Tyre about 80 km, both on the coastal highway.",
      ar: "تقع صيدا على بعد نحو 45 كلم جنوب بيروت وصور على بعد نحو 80 كلم، وكلتاهما على الأوتوستراد الساحلي.",
    },
    checkAdvice: true,
    sources: [UNESCO(299, "Tyre")],
    reviewed: false,
  },
  bekaa: {
    overview: {
      en: [
        "The Bekaa is Lebanon’s high, fertile valley between the Mount Lebanon and Anti-Lebanon ranges — the country’s farmland and the heart of its wine-making.",
        "Zahle is known for its riverside restaurants along the Berdawni, the wineries around Chtaura and Ksara welcome visitors for tastings, and at Anjar the ruins of an Umayyad-era city are a UNESCO World Heritage Site.",
      ],
      ar: [
        "البقاع سهل لبنان المرتفع والخصب بين سلسلتَي جبال لبنان الغربية والشرقية — أرض البلاد الزراعية وقلب صناعة النبيذ فيها.",
        "تشتهر زحلة بمطاعمها على ضفاف نهر البردوني، وتستقبل الكروم حول شتورة وكسارة الزوّار للتذوّق، وفي عنجر آثار مدينة من العصر الأموي مُدرجة على لائحة التراث العالمي لليونسكو.",
      ],
    },
    bestTime: {
      en: "September and October for the grape harvest; spring for green fields; summers are hot, winters cold.",
      ar: "أيلول وتشرين الأول لموسم القطاف؛ والربيع للحقول الخضراء؛ الصيف حارّ والشتاء بارد.",
    },
    gettingThere: {
      en: "Zahle is about an hour and a half from Beirut by car, over the Dahr el-Baidar pass, which can close briefly in snow.",
      ar: "تقع زحلة على بعد ساعة ونصف تقريبًا بالسيارة من بيروت، عبر ضهر البيدر الذي قد يُقفل لفترة قصيرة بسبب الثلج.",
    },
    checkAdvice: true,
    sources: [UNESCO(293, "Anjar")],
    reviewed: false,
  },
};

// The catalogue has used both spellings for the valley's governorate.
DESTINATION_GUIDES.beqaa = DESTINATION_GUIDES.bekaa as DestinationGuide;

/** The approved guide for a destination, or undefined while it is still a draft. */
export function publishedGuide(slug: string): DestinationGuide | undefined {
  const guide = DESTINATION_GUIDES[slug];
  return guide?.reviewed ? guide : undefined;
}
