import type { Locale } from "@/lib/locale";

export type HelpEntry = { id: string; question: string; answer: string; link?: { href: string; label: string } };
export type HelpSection = { id: string; title: string; entries: HelpEntry[] };
export type HelpCentre = { title: string; body: string; search: string; empty: string; sections: HelpSection[] };

/** The guide help centre. Every answer describes what the product does today. */
export const GUIDE_HELP: Record<Locale, HelpCentre> = {
  en: {
    title: "Guide help centre",
    body: "Short answers about applying, running tours, being hired and getting paid.",
    search: "Search the help centre",
    empty: "Nothing matches. Try another word, or write to us from the contact page.",
    sections: [
      {
        id: "joining",
        title: "Joining",
        entries: [
          {
            id: "tiers",
            question: "What is the difference between a licensed guide and a local host?",
            answer:
              "A licensed guide holds a guiding licence, can charge for tours and can be hired for a whole planned day. A local host shows people around for free and cannot charge through Mshwar. Both publish tours, add places and are reviewed.",
          },
          {
            id: "documents",
            question: "Which documents do I need?",
            answer:
              "Licensed guides need an ID and a guiding licence. Local hosts need an ID. First aid, insurance and a driving licence are optional. Only our reviewers see your documents; they never appear on your page.",
          },
          {
            id: "badge",
            question: "How do I get the licensed badge?",
            answer:
              "A reviewer verifies your licence and approves your application. The badge is never self-assigned, and it is removed automatically if your licence expires until a renewal is verified.",
          },
          {
            id: "agreement",
            question: "Why must I accept the guide agreement?",
            answer:
              "It sets out payment on the day, cancellations, safety and reviews. An application can only be sent once the current version is accepted.",
            link: { href: "/guides/agreement", label: "Read the guide agreement" },
          },
        ],
      },
      {
        id: "tours",
        title: "Tours and your calendar",
        entries: [
          {
            id: "publish",
            question: "What does a tour need before it can go live?",
            answer:
              "A title, a description, a meeting point in Lebanon, a price (free for hosts), a cancellation note and one photo. The tours page lists anything still missing.",
          },
          {
            id: "dates",
            question: "How do dates appear on my tours?",
            answer:
              "Set a weekly rhythm, the notice you need and how many tours you can run in a day in your calendar, then open dates on a tour. Days off and days you are hired are skipped.",
          },
          {
            id: "requests",
            question: "Do travellers book instantly?",
            answer:
              "No. Every tour is a request. You confirm or decline it with a note, and the traveller hears either way.",
          },
        ],
      },
      {
        id: "hire",
        title: "Being hired from the planner",
        entries: [
          {
            id: "who-can",
            question: "Who can be hired for a planned day?",
            answer:
              "Licensed guides with a verified, in-date licence and a day rate set on their home screen. Travellers see guides who cover the plan's places, speak their language and are free that day.",
          },
          {
            id: "changes",
            question: "Can I change a traveller's plan?",
            answer:
              "You can propose changes: move, retime, drop or add stops. The traveller sees exactly what changes and decides. Stops they locked cannot be changed.",
          },
        ],
      },
      {
        id: "day",
        title: "On the day",
        entries: [
          {
            id: "payment",
            question: "How do I get paid?",
            answer:
              "Travellers pay you on the day, in cash or by a local transfer you agree on. Mshwar never takes the money, and the amount to collect is on your day sheet.",
          },
          {
            id: "sheet",
            question: "What is on the day sheet, and does it work offline?",
            answer:
              "Stops and times, the meeting point, the group with phones once confirmed, and notes about food, access and children. It prints cleanly, and the last copy you opened stays on your device for when there is no signal.",
          },
          {
            id: "reviews",
            question: "How do reviews work?",
            answer:
              "Finish the day on the day sheet. You and each traveller then review each other; neither review is shown until both are written or fourteen days pass.",
          },
          {
            id: "problem",
            question: "Something went wrong. What do I do?",
            answer:
              "Report it from the day sheet. Safety reports go straight to a person on our team. If anyone is in danger, call the emergency services first.",
          },
        ],
      },
      {
        id: "places",
        title: "Adding places",
        entries: [
          {
            id: "propose",
            question: "How do I add a place or fix a listing?",
            answer:
              "Use the Places screen. Every proposal needs at least one source link, and a reviewer decides. Accepted places carry your name on their page.",
          },
          {
            id: "limit",
            question: "Why can I only send a few proposals a day?",
            answer: "New guides can send two a day. Each accepted proposal adds two more, up to twenty.",
          },
        ],
      },
    ],
  },
  ar: {
    title: "مركز مساعدة المرشدين",
    body: "إجابات قصيرة عن التقديم وتنظيم الجولات والاستئجار وتحصيل الأجر.",
    search: "ابحث في مركز المساعدة",
    empty: "لا نتائج. جرّب كلمة أخرى أو راسلنا من صفحة التواصل.",
    sections: [
      {
        id: "joining",
        title: "الانضمام",
        entries: [
          {
            id: "tiers",
            question: "ما الفرق بين المرشد المرخّص والمضيف المحلي؟",
            answer:
              "يحمل المرشد المرخّص رخصة إرشاد، ويمكنه تقاضي أجر عن الجولات ويمكن استئجاره ليوم مخطَّط كامل. أما المضيف المحلي فيرافق الناس مجانًا ولا يمكنه تقاضي أجر عبر مشوار. كلاهما ينشر جولات ويضيف أماكن ويُقيَّم.",
          },
          {
            id: "documents",
            question: "ما الوثائق التي أحتاجها؟",
            answer:
              "يحتاج المرشد المرخّص إلى هوية ورخصة إرشاد، ويحتاج المضيف المحلي إلى هوية. الإسعافات الأولية والتأمين ورخصة القيادة اختيارية. لا يرى وثائقك إلا المراجعون، ولا تظهر أبدًا في صفحتك.",
          },
          {
            id: "badge",
            question: "كيف أحصل على شارة المرخّص؟",
            answer:
              "يتحقّق مراجع من رخصتك ويوافق على طلبك. لا تُمنح الشارة ذاتيًا أبدًا، وتُزال تلقائيًا إذا انتهت رخصتك حتى يُتحقّق من تجديدها.",
          },
          {
            id: "agreement",
            question: "لماذا يجب أن أوافق على اتفاقية المرشد؟",
            answer:
              "تحدّد الاتفاقية الدفع في اليوم نفسه والإلغاء والسلامة والتقييمات. لا يمكن إرسال الطلب إلا بعد الموافقة على النسخة الحالية.",
            link: { href: "/guides/agreement", label: "اقرأ اتفاقية المرشد" },
          },
        ],
      },
      {
        id: "tours",
        title: "الجولات وتقويمك",
        entries: [
          {
            id: "publish",
            question: "ماذا تحتاج الجولة قبل نشرها؟",
            answer:
              "عنوانًا ووصفًا ونقطة لقاء في لبنان وسعرًا (مجانًا للمضيفين) وملاحظة عن الإلغاء وصورة واحدة. تعرض صفحة الجولات ما يزال ناقصًا.",
          },
          {
            id: "dates",
            question: "كيف تظهر المواعيد على جولاتي؟",
            answer:
              "حدّد في تقويمك إيقاعًا أسبوعيًا والمهلة التي تحتاجها وعدد الجولات في اليوم، ثم افتح المواعيد على الجولة. تُتخطّى أيام العطلة والأيام المحجوزة.",
          },
          {
            id: "requests",
            question: "هل يحجز المسافرون فورًا؟",
            answer: "لا. كل جولة هي طلب. تؤكّده أو ترفضه مع ملاحظة، ويصل ردّك إلى المسافر في الحالتين.",
          },
        ],
      },
      {
        id: "hire",
        title: "الاستئجار من المخطِّط",
        entries: [
          {
            id: "who-can",
            question: "من يمكن استئجاره ليوم مخطَّط؟",
            answer:
              "المرشدون المرخّصون ذوو الرخصة الموثّقة السارية الذين حدّدوا أجرًا لليوم في صفحتهم الرئيسية. يرى المسافرون المرشدين الذين يغطّون أماكن الخطة ويتحدّثون لغتهم ومتاحين في ذلك اليوم.",
          },
          {
            id: "changes",
            question: "هل يمكنني تغيير خطة المسافر؟",
            answer:
              "يمكنك اقتراح تعديلات: نقل المحطات أو تغيير أوقاتها أو حذفها أو إضافة غيرها. يرى المسافر ما يتغيّر بدقّة ويقرّر. لا يمكن تغيير المحطات التي ثبّتها.",
          },
        ],
      },
      {
        id: "day",
        title: "في يوم الجولة",
        entries: [
          {
            id: "payment",
            question: "كيف أتقاضى أجري؟",
            answer:
              "يدفع لك المسافرون في اليوم نفسه، نقدًا أو بتحويل محلي تتفقون عليه. لا تتقاضى مشوار المال أبدًا، والمبلغ المطلوب تحصيله موجود في ورقة اليوم.",
          },
          {
            id: "sheet",
            question: "ماذا تتضمّن ورقة اليوم، وهل تعمل دون اتصال؟",
            answer:
              "المحطات والأوقات ونقطة اللقاء والمجموعة مع أرقام الهواتف بعد التأكيد، وملاحظات عن الطعام والوصول والأطفال. تُطبع بشكل مرتّب، وتبقى آخر نسخة فتحتها على جهازك لحين انقطاع الشبكة.",
          },
          {
            id: "reviews",
            question: "كيف تعمل التقييمات؟",
            answer:
              "أنهِ اليوم من ورقة اليوم. بعدها يقيّم كلٌّ منك ومن كل مسافر الآخر، ولا يظهر أي تقييم حتى يكتب الطرفان أو تمرّ أربعة عشر يومًا.",
          },
          {
            id: "problem",
            question: "حدث خطأ ما. ماذا أفعل؟",
            answer:
              "أبلغ عنه من ورقة اليوم. تصل بلاغات السلامة مباشرة إلى أحد أفراد فريقنا. إن كان أحد في خطر، اتصل بخدمات الطوارئ أولًا.",
          },
        ],
      },
      {
        id: "places",
        title: "إضافة الأماكن",
        entries: [
          {
            id: "propose",
            question: "كيف أضيف مكانًا أو أصحّح عرضًا؟",
            answer:
              "استخدم شاشة الأماكن. يحتاج كل اقتراح إلى رابط مصدر واحد على الأقل، ويقرّر مراجع. تحمل الأماكن المقبولة اسمك في صفحتها.",
          },
          {
            id: "limit",
            question: "لماذا يمكنني إرسال عدد قليل من الاقتراحات يوميًا؟",
            answer: "يمكن للمرشدين الجدد إرسال اقتراحين في اليوم. يضيف كل اقتراح مقبول اثنين آخرين، حتى عشرين.",
          },
        ],
      },
    ],
  },
  fr: {
    title: "Centre d’aide des guides",
    body: "Des réponses courtes sur la candidature, les circuits, l’engagement et le paiement.",
    search: "Rechercher dans le centre d’aide",
    empty: "Aucun résultat. Essayez un autre mot, ou écrivez-nous depuis la page de contact.",
    sections: [
      {
        id: "joining",
        title: "Rejoindre Mshwar",
        entries: [
          {
            id: "tiers",
            question: "Quelle différence entre un guide agréé et un hôte local ?",
            answer:
              "Un guide agréé détient une licence, peut facturer ses circuits et peut être engagé pour une journée planifiée. Un hôte local fait visiter gratuitement et ne peut pas facturer via Mshwar. Tous deux publient des circuits, ajoutent des lieux et sont évalués.",
          },
          {
            id: "documents",
            question: "Quels documents fournir ?",
            answer:
              "Les guides agréés fournissent une pièce d’identité et une licence de guide. Les hôtes locaux, une pièce d’identité. Secourisme, assurance et permis de conduire sont facultatifs. Seuls nos relecteurs voient vos documents ; ils n’apparaissent jamais sur votre page.",
          },
          {
            id: "badge",
            question: "Comment obtenir le badge de guide agréé ?",
            answer:
              "Un relecteur vérifie votre licence et approuve votre candidature. Le badge ne s’attribue jamais soi-même, et il est retiré automatiquement si la licence expire, jusqu’à la vérification d’un renouvellement.",
          },
          {
            id: "agreement",
            question: "Pourquoi accepter l’accord guide ?",
            answer:
              "Il fixe le paiement sur place, les annulations, la sécurité et les avis. Une candidature ne peut être envoyée qu’après acceptation de la version en vigueur.",
            link: { href: "/guides/agreement", label: "Lire l’accord guide" },
          },
        ],
      },
      {
        id: "tours",
        title: "Circuits et agenda",
        entries: [
          {
            id: "publish",
            question: "Que faut-il pour mettre un circuit en ligne ?",
            answer:
              "Un titre, une description, un point de rendez-vous au Liban, un prix (gratuit pour les hôtes), une note d’annulation et une photo. La page des circuits indique ce qui manque encore.",
          },
          {
            id: "dates",
            question: "Comment les dates apparaissent-elles sur mes circuits ?",
            answer:
              "Réglez dans l’agenda un rythme hebdomadaire, le délai de prévenance et le nombre de circuits par jour, puis ouvrez des dates sur un circuit. Les jours de repos et les journées engagées sont sautés.",
          },
          {
            id: "requests",
            question: "Les voyageurs réservent-ils instantanément ?",
            answer:
              "Non. Chaque circuit est une demande. Vous confirmez ou refusez avec une note, et le voyageur est prévenu dans les deux cas.",
          },
        ],
      },
      {
        id: "hire",
        title: "Être engagé depuis le planificateur",
        entries: [
          {
            id: "who-can",
            question: "Qui peut être engagé pour une journée planifiée ?",
            answer:
              "Les guides agréés dont la licence est vérifiée et valide, et qui ont indiqué un tarif journalier sur leur accueil. Les voyageurs voient les guides qui couvrent les lieux du plan, parlent leur langue et sont libres ce jour-là.",
          },
          {
            id: "changes",
            question: "Puis-je modifier le plan d’un voyageur ?",
            answer:
              "Vous pouvez proposer des changements : déplacer, décaler, retirer ou ajouter des étapes. Le voyageur voit exactement ce qui change et décide. Les étapes qu’il a verrouillées ne peuvent pas changer.",
          },
        ],
      },
      {
        id: "day",
        title: "Le jour même",
        entries: [
          {
            id: "payment",
            question: "Comment suis-je payé ?",
            answer:
              "Les voyageurs vous paient le jour même, en espèces ou par virement local convenu. Mshwar n’encaisse jamais l’argent, et le montant à encaisser figure sur votre feuille de route.",
          },
          {
            id: "sheet",
            question: "Que contient la feuille de route, et fonctionne-t-elle hors ligne ?",
            answer:
              "Les étapes et horaires, le point de rendez-vous, le groupe avec les téléphones une fois confirmé, et les notes sur l’alimentation, l’accessibilité et les enfants. Elle s’imprime proprement, et la dernière copie ouverte reste sur votre appareil pour les zones sans réseau.",
          },
          {
            id: "reviews",
            question: "Comment fonctionnent les avis ?",
            answer:
              "Terminez la journée depuis la feuille de route. Vous et chaque voyageur vous évaluez ensuite ; aucun avis n’est affiché avant que les deux soient écrits ou après quatorze jours.",
          },
          {
            id: "problem",
            question: "Un problème est survenu. Que faire ?",
            answer:
              "Signalez-le depuis la feuille de route. Les signalements de sécurité vont directement à une personne de l’équipe. Si quelqu’un est en danger, appelez d’abord les secours.",
          },
        ],
      },
      {
        id: "places",
        title: "Ajouter des lieux",
        entries: [
          {
            id: "propose",
            question: "Comment ajouter un lieu ou corriger une fiche ?",
            answer:
              "Utilisez l’écran Lieux. Chaque proposition demande au moins un lien source, et un relecteur décide. Les lieux acceptés portent votre nom sur leur page.",
          },
          {
            id: "limit",
            question: "Pourquoi ne puis-je envoyer que quelques propositions par jour ?",
            answer:
              "Les nouveaux guides peuvent en envoyer deux par jour. Chaque proposition acceptée en ajoute deux, jusqu’à vingt.",
          },
        ],
      },
    ],
  },
};
