import type { LegalLibrary } from "./types";

/** Must match app.current_guide_agreement_version() in migration 038. */
export const GUIDE_AGREEMENT_VERSION = "2026-09-22";

/**
 * The guide agreement and code of conduct. It states the rules the product
 * already enforces (tiers, payment on the day, two-sided reviews, evidence for
 * place proposals) in plain words. Like the other trust documents it carries the
 * "pending legal review" notice until counsel signs it off.
 */
export const GUIDE_AGREEMENT: LegalLibrary = {
  en: {
    title: "Guide agreement and code of conduct",
    summary:
      "What Mshwar expects of licensed guides and local hosts, what Mshwar does for you, and what happens when things go wrong.",
    sections: [
      {
        id: "who",
        heading: "Who this is for",
        body: [
          "This agreement applies to everyone who guides through Mshwar: licensed guides, who hold a valid guiding licence and may charge, and local hosts, who show people around for free.",
          "It sits alongside the terms of service and the community guidelines, which also apply to you.",
        ],
      },
      {
        id: "tiers",
        heading: "Your tier",
        body: [
          {
            list: [
              "A licensed guide must keep a valid guiding licence on file. If it expires, your badge is removed automatically and travellers can no longer hire you from the planner until a renewed licence is verified.",
              "A local host may not charge for a walk, ask for payment outside Mshwar, or present themselves as a licensed guide. Tips given freely on the day are fine.",
              "Mshwar grants the badge after reviewing your documents. You cannot assign it to yourself.",
            ],
          },
        ],
      },
      {
        id: "payment",
        heading: "Payment on the day",
        body: [
          "Mshwar carries requests and confirmations. It does not take payment for tours or hired days. The price shown when a traveller asks is the price you collect on the day, in cash or by a local transfer you both agree on.",
          {
            list: [
              "Do not ask for more than the confirmed price, or for a deposit, without the traveller's agreement in writing on Mshwar.",
              "Give the traveller a receipt if they ask for one.",
            ],
          },
        ],
      },
      {
        id: "requests",
        heading: "Requests, changes and cancellations",
        body: [
          {
            list: [
              "Answer requests promptly. If you cannot run a day, decline it with a reason rather than leaving it open.",
              "If you would run a planned day differently, propose changes. The traveller sees exactly what changes and decides; you may not change a stop they locked.",
              "If you must cancel a confirmed day, do it as early as you can and say why. Repeated late cancellations can lead to suspension.",
              "Keep your calendar accurate: days off, the notice you need, and how many tours you can run in a day.",
            ],
          },
        ],
      },
      {
        id: "conduct",
        heading: "On the day",
        body: [
          {
            list: [
              "Be at the meeting point on time and keep the group informed of any change.",
              "Put safety first: do not take a group anywhere you consider unsafe, respect the limits of children, older travellers and anyone with access needs, and follow local rules at religious and heritage sites.",
              "Treat everyone with respect. Harassment, discrimination, and sectarian or religious insults are not tolerated.",
              "Keep travellers' phone numbers and notes to yourself and use them only for the day you were booked for.",
              "Mark the day complete when it is done, so both of you can review it.",
            ],
          },
        ],
      },
      {
        id: "reviews",
        heading: "Reviews in both directions",
        body: [
          "After a day, you and each traveller can review each other. Neither review is shown until both are written, or fourteen days have passed.",
          {
            list: [
              "Review only people who took part.",
              "Do not offer or accept anything in exchange for a review, and do not pressure anyone to change one.",
            ],
          },
        ],
      },
      {
        id: "places",
        heading: "Adding and correcting places",
        body: [
          {
            list: [
              "Propose only places that exist and are open to visitors, with at least one source that shows it.",
              "Upload only photos you took yourself. By uploading one you allow Mshwar to publish it with your name. Photos from Wikimedia Commons must carry a licence that allows reuse.",
              "A reviewer decides every proposal. Accepted proposals are credited to you and raise how many you can send each day.",
            ],
          },
        ],
      },
      {
        id: "safety",
        heading: "Reporting a problem",
        body: [
          "Either side of a day can report a problem from the day's page. Safety reports go straight to a person on our team. If anyone is in immediate danger, call the emergency services first.",
        ],
      },
      {
        id: "enforcement",
        heading: "When the rules are broken",
        body: [
          "Mshwar may pause your tours, remove your badge or suspend your account while a report is looked into, and will tell you why. When an account is suspended, its tours stop being bookable and its open requests and days are cancelled, with the travellers told.",
          "You can reply to any decision through the contact page, and we will review it.",
        ],
      },
    ],
  },
  ar: {
    title: "اتفاقية المرشد ومدوّنة السلوك",
    summary: "ما تتوقّعه مشوار من المرشدين المرخّصين والمضيفين المحليين، وما تقدّمه لك مشوار، وما يحدث عند حدوث خطأ.",
    sections: [
      {
        id: "who",
        heading: "لمن هذه الاتفاقية",
        body: [
          "تنطبق هذه الاتفاقية على كل من يرشد عبر مشوار: المرشدون المرخّصون الذين يحملون رخصة إرشاد سارية ويمكنهم تقاضي أجر، والمضيفون المحليون الذين يرافقون الناس مجانًا.",
          "وهي مكمّلة لشروط الخدمة وإرشادات المجتمع، التي تنطبق عليك أيضًا.",
        ],
      },
      {
        id: "tiers",
        heading: "فئتك",
        body: [
          {
            list: [
              "على المرشد المرخّص إبقاء رخصة إرشاد سارية في ملفه. إذا انتهت صلاحيتها، تُزال الشارة تلقائيًا ولا يعود بإمكان المسافرين استئجارك من المخطِّط حتى يُتحقّق من رخصة مجدّدة.",
              "لا يجوز للمضيف المحلي تقاضي أجر عن الجولة، أو طلب دفع خارج مشوار، أو تقديم نفسه كمرشد مرخّص. الإكراميات المقدَّمة طوعًا في اليوم نفسه مقبولة.",
              "تمنح مشوار الشارة بعد مراجعة وثائقك. لا يمكنك منحها لنفسك.",
            ],
          },
        ],
      },
      {
        id: "payment",
        heading: "الدفع في يوم الجولة",
        body: [
          "تنقل مشوار الطلبات والتأكيدات ولا تتقاضى مبالغ الجولات أو الأيام المحجوزة. السعر الظاهر عند طلب المسافر هو السعر الذي تحصّله في اليوم نفسه، نقدًا أو بتحويل محلي تتفقان عليه.",
          {
            list: [
              "لا تطلب أكثر من السعر المؤكَّد أو عربونًا دون موافقة المسافر كتابيًا على مشوار.",
              "أعطِ المسافر إيصالًا إن طلبه.",
            ],
          },
        ],
      },
      {
        id: "requests",
        heading: "الطلبات والتعديلات والإلغاء",
        body: [
          {
            list: [
              "ردّ على الطلبات بسرعة. إن لم تستطع القيام بيوم ما، ارفضه مع ذكر السبب بدل تركه مفتوحًا.",
              "إن كنت ستنظّم اليوم المخطَّط بشكل مختلف، اقترح تعديلات. يرى المسافر ما يتغيّر بدقّة ويقرّر، ولا يجوز لك تغيير محطة ثبّتها.",
              "إن اضطررت لإلغاء يوم مؤكَّد، فافعل ذلك في أبكر وقت ممكن واذكر السبب. قد يؤدي تكرار الإلغاء المتأخر إلى التعليق.",
              "حافظ على دقّة تقويمك: أيام العطلة، والمهلة التي تحتاجها، وعدد الجولات التي يمكنك القيام بها في اليوم.",
            ],
          },
        ],
      },
      {
        id: "conduct",
        heading: "في يوم الجولة",
        body: [
          {
            list: [
              "كن عند نقطة اللقاء في الموعد وأبلغ المجموعة بأي تغيير.",
              "السلامة أولًا: لا تأخذ المجموعة إلى مكان تعتبره غير آمن، واحترم قدرات الأطفال وكبار السن وذوي احتياجات الوصول، والتزم بالقواعد المحلية في المواقع الدينية والتراثية.",
              "عامل الجميع باحترام. لا يُتسامح مع التحرّش أو التمييز أو الإساءة الطائفية أو الدينية.",
              "احتفظ بأرقام هواتف المسافرين وملاحظاتهم لنفسك واستخدمها فقط لليوم الذي حُجزت له.",
              "حدّد اليوم كمكتمل عند انتهائه، ليتمكّن كلاكما من التقييم.",
            ],
          },
        ],
      },
      {
        id: "reviews",
        heading: "التقييمات في الاتجاهين",
        body: [
          "بعد كل يوم، يمكنك أنت وكل مسافر تقييم بعضكما. لا يظهر أي تقييم حتى يكتب الطرفان تقييمهما أو تمرّ أربعة عشر يومًا.",
          {
            list: ["قيّم فقط الأشخاص الذين شاركوا.", "لا تعرض أو تقبل أي مقابل لتقييم، ولا تضغط على أحد لتغييره."],
          },
        ],
      },
      {
        id: "places",
        heading: "إضافة الأماكن وتصحيحها",
        body: [
          {
            list: [
              "اقترح فقط أماكن موجودة ومفتوحة للزوار، مع مصدر واحد على الأقل يثبت ذلك.",
              "ارفع فقط صورًا التقطتها بنفسك. برفعها تسمح لمشوار بنشرها باسمك. يجب أن تحمل صور ويكيميديا كومنز ترخيصًا يسمح بإعادة الاستخدام.",
              "يقرّر مراجع في كل اقتراح. تُنسب الاقتراحات المقبولة إليك وترفع عدد ما يمكنك إرساله يوميًا.",
            ],
          },
        ],
      },
      {
        id: "safety",
        heading: "الإبلاغ عن مشكلة",
        body: [
          "يمكن لأي طرف في اليوم الإبلاغ عن مشكلة من صفحة اليوم. تصل بلاغات السلامة مباشرة إلى أحد أفراد فريقنا. إن كان أحد في خطر مباشر، اتصل بخدمات الطوارئ أولًا.",
        ],
      },
      {
        id: "enforcement",
        heading: "عند مخالفة القواعد",
        body: [
          "قد توقف مشوار جولاتك أو تزيل شارتك أو تعلّق حسابك أثناء النظر في بلاغ، وستخبرك بالسبب. عند تعليق حساب، تتوقّف جولاته عن قبول الحجوزات وتُلغى طلباته وأيامه المفتوحة مع إبلاغ المسافرين.",
          "يمكنك الردّ على أي قرار عبر صفحة التواصل، وسنعيد النظر فيه.",
        ],
      },
    ],
  },
  fr: {
    title: "Accord guide et code de conduite",
    summary:
      "Ce que Mshwar attend des guides agréés et des hôtes locaux, ce que Mshwar fait pour vous, et ce qui se passe en cas de problème.",
    sections: [
      {
        id: "who",
        heading: "À qui s’adresse cet accord",
        body: [
          "Cet accord s’applique à toute personne qui guide via Mshwar : les guides agréés, titulaires d’une licence de guide valide et autorisés à facturer, et les hôtes locaux, qui font visiter gratuitement.",
          "Il complète les conditions d’utilisation et les règles de la communauté, qui s’appliquent aussi à vous.",
        ],
      },
      {
        id: "tiers",
        heading: "Votre statut",
        body: [
          {
            list: [
              "Un guide agréé doit garder une licence valide à son dossier. Si elle expire, le badge est retiré automatiquement et les voyageurs ne peuvent plus vous engager depuis le planificateur tant qu’une licence renouvelée n’est pas vérifiée.",
              "Un hôte local ne peut pas faire payer une balade, demander un paiement hors de Mshwar, ni se présenter comme guide agréé. Les pourboires donnés librement sur place sont acceptés.",
              "Mshwar accorde le badge après examen de vos documents. Vous ne pouvez pas vous l’attribuer.",
            ],
          },
        ],
      },
      {
        id: "payment",
        heading: "Paiement le jour même",
        body: [
          "Mshwar transmet les demandes et les confirmations. Mshwar n’encaisse pas le prix des circuits ni des journées engagées. Le prix affiché lors de la demande est celui que vous encaissez le jour même, en espèces ou par un virement local convenu entre vous.",
          {
            list: [
              "Ne demandez pas plus que le prix confirmé, ni d’acompte, sans l’accord écrit du voyageur sur Mshwar.",
              "Remettez un reçu au voyageur s’il le demande.",
            ],
          },
        ],
      },
      {
        id: "requests",
        heading: "Demandes, changements et annulations",
        body: [
          {
            list: [
              "Répondez rapidement aux demandes. Si vous ne pouvez pas assurer une journée, refusez-la avec un motif au lieu de la laisser ouverte.",
              "Si vous feriez une journée planifiée autrement, proposez des changements. Le voyageur voit exactement ce qui change et décide ; vous ne pouvez pas modifier une étape qu’il a verrouillée.",
              "Si vous devez annuler une journée confirmée, faites-le le plus tôt possible et dites pourquoi. Des annulations tardives répétées peuvent entraîner une suspension.",
              "Tenez votre agenda à jour : jours de repos, délai de prévenance et nombre de circuits par jour.",
            ],
          },
        ],
      },
      {
        id: "conduct",
        heading: "Le jour même",
        body: [
          {
            list: [
              "Soyez au point de rendez-vous à l’heure et tenez le groupe informé de tout changement.",
              "La sécurité d’abord : n’emmenez pas le groupe là où vous jugez que ce n’est pas sûr, respectez les limites des enfants, des personnes âgées et des personnes ayant des besoins d’accessibilité, et suivez les règles locales sur les sites religieux et patrimoniaux.",
              "Traitez chacun avec respect. Le harcèlement, la discrimination et les insultes confessionnelles ou religieuses ne sont pas tolérés.",
              "Gardez pour vous les numéros et les notes des voyageurs et utilisez-les seulement pour la journée réservée.",
              "Marquez la journée comme terminée une fois finie, pour que chacun puisse laisser un avis.",
            ],
          },
        ],
      },
      {
        id: "reviews",
        heading: "Des avis dans les deux sens",
        body: [
          "Après une journée, vous et chaque voyageur pouvez vous évaluer. Aucun avis n’est affiché avant que les deux soient écrits, ou après quatorze jours.",
          {
            list: [
              "N’évaluez que les personnes qui ont participé.",
              "N’offrez ni n’acceptez rien en échange d’un avis, et ne faites pression sur personne pour qu’il le modifie.",
            ],
          },
        ],
      },
      {
        id: "places",
        heading: "Ajouter et corriger des lieux",
        body: [
          {
            list: [
              "Ne proposez que des lieux qui existent et sont ouverts aux visiteurs, avec au moins une source qui le montre.",
              "N’envoyez que des photos prises par vous. En l’envoyant, vous autorisez Mshwar à la publier avec votre nom. Les photos de Wikimedia Commons doivent porter une licence permettant la réutilisation.",
              "Un relecteur décide de chaque proposition. Les propositions acceptées vous sont créditées et augmentent le nombre que vous pouvez envoyer chaque jour.",
            ],
          },
        ],
      },
      {
        id: "safety",
        heading: "Signaler un problème",
        body: [
          "Chaque partie d’une journée peut signaler un problème depuis la page de la journée. Les signalements de sécurité vont directement à une personne de notre équipe. Si quelqu’un est en danger immédiat, appelez d’abord les secours.",
        ],
      },
      {
        id: "enforcement",
        heading: "En cas de manquement",
        body: [
          "Mshwar peut mettre vos circuits en pause, retirer votre badge ou suspendre votre compte pendant l’examen d’un signalement, et vous en dira la raison. Quand un compte est suspendu, ses circuits ne sont plus réservables et ses demandes et journées ouvertes sont annulées, les voyageurs étant prévenus.",
          "Vous pouvez répondre à toute décision via la page de contact, et nous la réexaminerons.",
        ],
      },
    ],
  },
};
