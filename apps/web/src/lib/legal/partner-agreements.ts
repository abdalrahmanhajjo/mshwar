import type { PartnerKind } from "@/lib/partners";
import type { LegalLibrary } from "./types";

/** Must match app.current_partner_agreement_version() in migration 039 (the same for both kinds). */
export const PARTNER_AGREEMENT_VERSION = "2026-09-23";

/**
 * Versions counsel has approved, with the date of sign-off. Recorded in code rather than an
 * environment flag so the approval travels with the exact text it covers: a new version shows
 * the "pending legal review" notice again until it is added here.
 * See docs/legal/partner-agreements-review.md.
 */
export const PARTNER_AGREEMENT_REVIEWS: Readonly<Record<string, string>> = {
  "2026-09-23": "2026-09-24",
};

export function partnerAgreementReviewed(version: string): boolean {
  return version in PARTNER_AGREEMENT_REVIEWS;
}

/**
 * The driver agreement and the money-changer agreement. They state, in plain words,
 * the rules the product already enforces.
 */
export const DRIVER_AGREEMENT: LegalLibrary = {
  en: {
    title: "Driver agreement and code of conduct",
    summary:
      "What Mshwar expects of the drivers it lists, what Mshwar does for you, and what happens when things go wrong.",
    sections: [
      {
        id: "who",
        heading: "Who can drive with Mshwar",
        body: [
          "Mshwar lists only drivers who may legally carry paying passengers in Lebanon: a valid public driving licence and a vehicle with a red public plate. White-plate vehicles are not listed for paid rides.",
          "This agreement sits alongside the terms of service and the community guidelines, which also apply to you.",
        ],
      },
      {
        id: "documents",
        heading: "Your documents stay true and current",
        body: [
          {
            list: [
              "Every document you upload must be yours, genuine and in date: your identity, your public licence, your judicial record, and for each vehicle its registration, passenger insurance and inspection (and the plate rental contract if the plate is rented).",
              "When a document runs out, travellers stop seeing you that day. Upload the renewed one before it does; we remind you 30 and 7 days ahead.",
              "The judicial record is renewed every year.",
              "Tell us straight away if anything changes: a new plate, a new vehicle, a suspended licence.",
            ],
          },
        ],
      },
      {
        id: "rides",
        heading: "Quotes, pickups and the day",
        body: [
          {
            list: [
              "The price you quote is fixed. Do not ask for more on the day unless the traveller agreed to a change in writing on Mshwar.",
              "Drive the vehicle and show the plate the traveller booked. Another driver or another car is not allowed.",
              "Be on time. If you must cancel, do it as early as you can and say why. Repeated late cancellations can lead to suspension.",
              "Close the ride in the app when it is done, or mark a no-show honestly.",
            ],
          },
        ],
      },
      {
        id: "payment",
        heading: "Payment in the car",
        body: [
          "Mshwar carries requests and confirmations. It does not take payment for rides. The traveller pays you directly, in the car, in cash or by a local transfer you both agree on. Give a receipt if you are asked for one.",
        ],
      },
      {
        id: "safety",
        heading: "Safety and conduct",
        body: [
          {
            list: [
              "Drive safely and within the law. Never drive after drinking or while unfit to drive.",
              "Treat every passenger with respect. Harassment or discrimination of any kind is grounds for removal.",
              "Keep the vehicle clean, roadworthy and insured for passengers.",
            ],
          },
        ],
      },
      {
        id: "trust",
        heading: "Reviews, reports and suspension",
        body: [
          "Travellers and drivers review each other after a ride; neither sees the other's review until both have written or 14 days pass. Either side can report a problem. Safety, wrong-driver, wrong-plate and unsafe-vehicle reports reach a person at once.",
          "Mshwar may suspend you while a serious report is looked into. A suspension cancels your future rides, and the travellers are told.",
        ],
      },
      {
        id: "data",
        heading: "Your documents and your data",
        body: [
          "Your documents are stored privately and seen only by our reviewers through links that expire. Travellers see what was checked and when, your first name, photo, languages, areas, car and plate, and your phone only once they have booked you.",
        ],
      },
    ],
  },
  ar: {
    title: "اتفاقية السائق وقواعد السلوك",
    summary: "ما يتوقّعه مشوار من السائقين المدرجين لديه، وما يقدّمه لك، وما يحدث حين تسوء الأمور.",
    sections: [
      {
        id: "who",
        heading: "من يمكنه القيادة مع مشوار",
        body: [
          "لا يُدرج مشوار إلا السائقين المسموح لهم قانونًا بنقل ركّاب بأجر في لبنان: رخصة سوق عمومية سارية ومركبة تحمل لوحة عمومية حمراء. لا تُدرج المركبات ذات اللوحات البيضاء للرحلات المدفوعة.",
          "تُطبَّق هذه الاتفاقية إلى جانب شروط الخدمة وإرشادات المجتمع، وهي تنطبق عليك أيضًا.",
        ],
      },
      {
        id: "documents",
        heading: "مستنداتك صحيحة وسارية دائمًا",
        body: [
          {
            list: [
              "يجب أن يكون كلّ مستند ترفعه لك وأصليًا وساري المفعول: هويتك، رخصتك العمومية، سجلّك العدلي، ولكل مركبة تسجيلها وتأمين الركّاب والمعاينة (وعقد استئجار اللوحة إن كانت مستأجرة).",
              "حين تنتهي صلاحية مستند، يتوقّف المسافرون عن رؤيتك في اليوم نفسه. ارفع المستند المجدَّد قبل ذلك؛ نذكّرك قبل 30 يومًا و7 أيام.",
              "يُجدَّد السجلّ العدلي كل عام.",
              "أخبرنا فورًا بأي تغيير: لوحة جديدة، مركبة جديدة، رخصة موقوفة.",
            ],
          },
        ],
      },
      {
        id: "rides",
        heading: "العروض والانطلاق ويوم الرحلة",
        body: [
          {
            list: [
              "السعر الذي تعرضه ثابت. لا تطلب أكثر منه يوم الرحلة إلا إذا وافق المسافر على التغيير كتابةً عبر مشوار.",
              "قُد المركبة وأظهر اللوحة اللتين حجزهما المسافر. لا يُسمح بسائق آخر أو سيارة أخرى.",
              "كن في الموعد. إن اضطررت إلى الإلغاء فافعل ذلك في أبكر وقت ممكن واذكر السبب. قد يؤدي تكرار الإلغاء المتأخر إلى الإيقاف.",
              "أغلق الرحلة في التطبيق عند انتهائها، أو سجّل عدم حضور المسافر بصدق.",
            ],
          },
        ],
      },
      {
        id: "payment",
        heading: "الدفع في السيارة",
        body: [
          "ينقل مشوار الطلبات والتأكيدات، ولا يتقاضى ثمن الرحلات. يدفع لك المسافر مباشرةً في السيارة، نقدًا أو بتحويل محلي تتفقان عليه. أعطِ إيصالًا إذا طُلب منك.",
        ],
      },
      {
        id: "safety",
        heading: "السلامة والسلوك",
        body: [
          {
            list: [
              "قُد بأمان وضمن القانون. لا تقُد أبدًا بعد تناول الكحول أو وأنت غير مؤهّل للقيادة.",
              "عامل كلّ راكب باحترام. التحرّش أو التمييز بأي شكل سبب للإبعاد.",
              "حافظ على نظافة المركبة وصلاحيتها للسير وتأمينها للركّاب.",
            ],
          },
        ],
      },
      {
        id: "trust",
        heading: "التقييمات والبلاغات والإيقاف",
        body: [
          "يقيّم المسافرون والسائقون بعضهم بعضًا بعد الرحلة، ولا يرى أيّ طرف تقييم الآخر حتى يكتب الطرفان أو تمرّ 14 يومًا. يمكن لأيّ طرف الإبلاغ عن مشكلة. تصل بلاغات السلامة والسائق الخطأ واللوحة الخطأ والمركبة غير الآمنة إلى شخص فورًا.",
          "قد يوقفك مشوار ريثما يُنظر في بلاغ جدّي. يُلغي الإيقاف رحلاتك المقبلة ويُبلَّغ المسافرون بذلك.",
        ],
      },
      {
        id: "data",
        heading: "مستنداتك وبياناتك",
        body: [
          "تُحفظ مستنداتك بشكل خاص ولا يراها إلا المراجعون عبر روابط تنتهي صلاحيتها. يرى المسافرون ما تم التحقّق منه ومتى، واسمك الأول وصورتك ولغاتك ومناطقك وسيارتك ولوحتك، ورقم هاتفك فقط بعد أن يحجزوا معك.",
        ],
      },
    ],
  },
  fr: {
    title: "Accord chauffeur et code de conduite",
    summary:
      "Ce que Mshwar attend des chauffeurs qu’il référence, ce que Mshwar fait pour vous, et ce qui se passe en cas de problème.",
    sections: [
      {
        id: "who",
        heading: "Qui peut conduire avec Mshwar",
        body: [
          "Mshwar ne référence que les chauffeurs autorisés à transporter des passagers payants au Liban : un permis de conduire public valide et un véhicule à plaque publique rouge. Les véhicules à plaque blanche ne sont pas proposés pour des courses payantes.",
          "Cet accord s’ajoute aux conditions d’utilisation et aux règles de la communauté, qui s’appliquent aussi à vous.",
        ],
      },
      {
        id: "documents",
        heading: "Des documents exacts et à jour",
        body: [
          {
            list: [
              "Chaque document envoyé doit être le vôtre, authentique et valide : identité, permis public, casier judiciaire, et pour chaque véhicule la carte grise, l’assurance passagers et le contrôle technique (et le contrat de location si la plaque est louée).",
              "Quand un document expire, les voyageurs ne vous voient plus le jour même. Envoyez le document renouvelé avant ; nous vous le rappelons 30 et 7 jours avant.",
              "Le casier judiciaire est renouvelé chaque année.",
              "Prévenez-nous tout de suite de tout changement : nouvelle plaque, nouveau véhicule, permis suspendu.",
            ],
          },
        ],
      },
      {
        id: "rides",
        heading: "Devis, prise en charge et jour de la course",
        body: [
          {
            list: [
              "Le prix proposé est fixe. Ne demandez pas davantage le jour même, sauf accord écrit du voyageur sur Mshwar.",
              "Conduisez le véhicule et montrez la plaque réservés par le voyageur. Un autre chauffeur ou une autre voiture n’est pas autorisé.",
              "Soyez à l’heure. Si vous devez annuler, faites-le le plus tôt possible en expliquant pourquoi. Des annulations tardives répétées peuvent entraîner une suspension.",
              "Clôturez la course dans l’application une fois terminée, ou signalez honnêtement une absence.",
            ],
          },
        ],
      },
      {
        id: "payment",
        heading: "Paiement dans la voiture",
        body: [
          "Mshwar transmet les demandes et les confirmations. Il n’encaisse pas le prix des courses. Le voyageur vous paie directement dans la voiture, en espèces ou par un virement local convenu. Remettez un reçu si on vous le demande.",
        ],
      },
      {
        id: "safety",
        heading: "Sécurité et conduite",
        body: [
          {
            list: [
              "Conduisez prudemment et dans le respect de la loi. Ne conduisez jamais après avoir bu ou si vous n’êtes pas en état.",
              "Traitez chaque passager avec respect. Tout harcèlement ou discrimination entraîne le retrait.",
              "Gardez le véhicule propre, en bon état et assuré pour les passagers.",
            ],
          },
        ],
      },
      {
        id: "trust",
        heading: "Avis, signalements et suspension",
        body: [
          "Voyageurs et chauffeurs se notent après la course ; aucun ne voit l’avis de l’autre avant que les deux aient écrit ou que 14 jours soient passés. Chacun peut signaler un problème. Les signalements de sécurité, de mauvais chauffeur, de mauvaise plaque ou de véhicule dangereux parviennent immédiatement à une personne.",
          "Mshwar peut vous suspendre pendant l’examen d’un signalement grave. La suspension annule vos courses à venir et les voyageurs sont prévenus.",
        ],
      },
      {
        id: "data",
        heading: "Vos documents et vos données",
        body: [
          "Vos documents sont conservés de façon privée et vus uniquement par nos relecteurs, via des liens qui expirent. Les voyageurs voient ce qui a été vérifié et quand, votre prénom, photo, langues, zones, voiture et plaque, et votre téléphone seulement après réservation.",
        ],
      },
    ],
  },
};

export const CHANGER_AGREEMENT: LegalLibrary = {
  en: {
    title: "Money changer agreement and code of conduct",
    summary: "What Mshwar expects of the exchange institutions it lists, and what travellers are told about you.",
    sections: [
      {
        id: "who",
        heading: "Who can be listed",
        body: [
          "Under Law 347/2001 only exchange institutions registered with Banque du Liban may work as money changers. Mshwar lists you only while your registration number and category match BDL's current list, which we reload every month. If you are missing from it, you are hidden that day.",
        ],
      },
      {
        id: "documents",
        heading: "Your documents and branches",
        body: [
          {
            list: [
              "Keep your identity, BDL registration and commercial register extract genuine and current.",
              "Each branch is visited or video-called and has its shop front checked before it shows. Moving a branch means a new check.",
              "Show your BDL registration number at every branch, as the law requires.",
            ],
          },
        ],
      },
      {
        id: "rates",
        heading: "Rates you post",
        body: [
          {
            list: [
              'A rate you post is yours, shown as "posted by the changer" with its time, and travellers are told to confirm it at the counter. Honour it at the counter.',
              "Rates stop showing after 12 hours. A rate far from what other verified changers post that day is held for review before it shows.",
              "Two upheld reports that the rate at the counter was different, within 30 days, pause rate posting for 30 days.",
              "Mshwar never ranks changers by rate.",
            ],
          },
        ],
      },
      {
        id: "counter",
        heading: "At the counter",
        body: [
          {
            list: [
              "Count notes in front of the traveller and give a receipt when asked.",
              "Never hand out counterfeit or damaged notes. A counterfeit report reaches a person at once and can lead to immediate suspension.",
              "Treat every traveller with respect, whatever language they speak.",
            ],
          },
        ],
      },
      {
        id: "money",
        heading: "What Mshwar does not do",
        body: [
          "Mshwar never exchanges money, takes deposits, sends transfers or takes a commission on exchanges. It shows travellers where licensed changers are and what was checked.",
        ],
      },
      {
        id: "data",
        heading: "Your documents and your data",
        body: [
          "Documents are stored privately and seen only by our reviewers through links that expire. Travellers see your name, BDL number and category, branches, hours, languages, posted rates and what was checked.",
        ],
      },
    ],
  },
  ar: {
    title: "اتفاقية الصرّاف وقواعد السلوك",
    summary: "ما يتوقّعه مشوار من مؤسسات الصرافة المدرجة لديه، وما يُقال للمسافرين عنك.",
    sections: [
      {
        id: "who",
        heading: "من يمكن إدراجه",
        body: [
          "بموجب القانون 347/2001 لا يحقّ العمل في الصرافة إلا للمؤسسات المسجّلة لدى مصرف لبنان. لا يُدرجك مشوار إلا ما دام رقم تسجيلك وفئتك مطابقين لأحدث لائحة يصدرها مصرف لبنان، ونعيد تحميلها كل شهر. إن لم تكن فيها، تُخفى في اليوم نفسه.",
        ],
      },
      {
        id: "documents",
        heading: "مستنداتك وفروعك",
        body: [
          {
            list: [
              "حافظ على صحة هويتك وتسجيلك لدى مصرف لبنان وإفادة السجل التجاري وسريانها.",
              "يُزار كل فرع أو يُتحقّق منه بمكالمة فيديو وتُفحص واجهته قبل ظهوره. نقل الفرع يعني تحقّقًا جديدًا.",
              "اعرض رقم تسجيلك لدى مصرف لبنان في كل فرع كما يفرض القانون.",
            ],
          },
        ],
      },
      {
        id: "rates",
        heading: "الأسعار التي تنشرها",
        body: [
          {
            list: [
              'السعر الذي تنشره سعرك أنت، ويظهر على أنه "منشور من الصرّاف" مع وقته، ويُنصح المسافرون بتأكيده عند الشبّاك. التزم به عند الشبّاك.',
              "تتوقّف الأسعار عن الظهور بعد 12 ساعة. السعر البعيد عمّا ينشره الصرّافون الموثّقون الآخرون في اليوم نفسه يُعلَّق للمراجعة قبل ظهوره.",
              "بلاغان مثبتان خلال 30 يومًا بأن السعر عند الشبّاك كان مختلفًا يوقفان نشر الأسعار 30 يومًا.",
              "لا يرتّب مشوار الصرّافين حسب السعر أبدًا.",
            ],
          },
        ],
      },
      {
        id: "counter",
        heading: "عند الشبّاك",
        body: [
          {
            list: [
              "عُدّ الأوراق النقدية أمام المسافر وأعطِ إيصالًا عند الطلب.",
              "لا تسلّم أبدًا أوراقًا مزوّرة أو تالفة. يصل بلاغ التزوير إلى شخص فورًا وقد يؤدي إلى إيقاف فوري.",
              "عامل كلّ مسافر باحترام، أيًّا كانت لغته.",
            ],
          },
        ],
      },
      {
        id: "money",
        heading: "ما لا يفعله مشوار",
        body: [
          "لا يصرف مشوار العملات ولا يتلقّى ودائع ولا يرسل تحويلات ولا يتقاضى عمولة على الصرف. يُري المسافرين أماكن الصرّافين المرخّصين وما تم التحقّق منه.",
        ],
      },
      {
        id: "data",
        heading: "مستنداتك وبياناتك",
        body: [
          "تُحفظ المستندات بشكل خاص ولا يراها إلا المراجعون عبر روابط تنتهي صلاحيتها. يرى المسافرون اسمك ورقمك وفئتك لدى مصرف لبنان وفروعك وساعات العمل واللغات والأسعار المنشورة وما تم التحقّق منه.",
        ],
      },
    ],
  },
  fr: {
    title: "Accord bureau de change et code de conduite",
    summary:
      "Ce que Mshwar attend des établissements de change qu’il référence, et ce qui est dit de vous aux voyageurs.",
    sections: [
      {
        id: "who",
        heading: "Qui peut être référencé",
        body: [
          "Selon la loi 347/2001, seuls les établissements de change enregistrés auprès de la Banque du Liban peuvent exercer. Mshwar vous référence tant que votre numéro et votre catégorie correspondent à la liste en vigueur de la BDL, rechargée chaque mois. Si vous n’y figurez plus, vous êtes masqué le jour même.",
        ],
      },
      {
        id: "documents",
        heading: "Vos documents et vos agences",
        body: [
          {
            list: [
              "Gardez votre identité, votre enregistrement BDL et l’extrait du registre du commerce authentiques et à jour.",
              "Chaque agence est visitée ou vérifiée en visio, devanture comprise, avant d’apparaître. Déplacer une agence implique une nouvelle vérification.",
              "Affichez votre numéro d’enregistrement BDL dans chaque agence, comme la loi l’exige.",
            ],
          },
        ],
      },
      {
        id: "rates",
        heading: "Les taux que vous publiez",
        body: [
          {
            list: [
              "Un taux publié est le vôtre, affiché « publié par le changeur » avec son heure, et les voyageurs sont invités à le confirmer au guichet. Respectez-le au guichet.",
              "Les taux disparaissent après 12 heures. Un taux très éloigné de ceux des autres changeurs vérifiés ce jour-là est retenu pour vérification avant affichage.",
              "Deux signalements confirmés de taux différent au guichet en 30 jours suspendent la publication pendant 30 jours.",
              "Mshwar ne classe jamais les changeurs par taux.",
            ],
          },
        ],
      },
      {
        id: "counter",
        heading: "Au guichet",
        body: [
          {
            list: [
              "Comptez les billets devant le voyageur et remettez un reçu sur demande.",
              "Ne remettez jamais de billets faux ou abîmés. Un signalement de faux billet parvient immédiatement à une personne et peut entraîner une suspension immédiate.",
              "Traitez chaque voyageur avec respect, quelle que soit sa langue.",
            ],
          },
        ],
      },
      {
        id: "money",
        heading: "Ce que Mshwar ne fait pas",
        body: [
          "Mshwar ne change jamais d’argent, ne reçoit pas de dépôts, n’envoie pas de virements et ne prend aucune commission sur le change. Il montre aux voyageurs où se trouvent les changeurs agréés et ce qui a été vérifié.",
        ],
      },
      {
        id: "data",
        heading: "Vos documents et vos données",
        body: [
          "Les documents sont conservés de façon privée et vus uniquement par nos relecteurs, via des liens qui expirent. Les voyageurs voient votre nom, votre numéro et catégorie BDL, vos agences, horaires, langues, taux publiés et ce qui a été vérifié.",
        ],
      },
    ],
  },
};

export const PARTNER_AGREEMENTS: Record<PartnerKind, LegalLibrary> = {
  driver: DRIVER_AGREEMENT,
  changer: CHANGER_AGREEMENT,
};
