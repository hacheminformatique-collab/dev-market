import { getCityBySlug, haversineKm } from '../data/idf-cities'
import { WEDDING_REVIEWS } from '../data/weddingReviews'

export const WEDDING_TEMPLATE_VERSION = 1

export const WEDDING_TEMPLATE_FAMILIES = [
  {
    id: 'presentation',
    label: 'Présentation et visite',
    headings: [
      'Découvrir {{business}} pour votre mariage depuis {{city}}',
      'Votre salle de mariage : une visite pour vous projeter',
      '{{business}}, un cadre pour réunir vos proches',
    ],
    introductions: [
      'Vous imaginez une réception élégante, une salle accueillante et une journée que vos proches garderont en mémoire ? Pour votre mariage depuis {{city}} ({{postalCode}}), découvrez {{business}} à Nanteuil-lès-Meaux. La visite est le meilleur point de départ pour apprécier les espaces, parler de votre projet et construire une réception à votre image.',
      'Le choix de la salle donne le ton de votre mariage. Ambiance, accueil et organisation doivent former un ensemble qui vous ressemble. Habitants de {{city}}, nous vous invitons à découvrir {{business}}, au 5 avenue Fridingen, 77100 Nanteuil-lès-Meaux, pour échanger autour de votre date et de vos attentes.',
      'Avant de choisir votre lieu de réception, prenez le temps de vous y projeter : où accueillir vos invités, comment organiser le repas et quelle place réserver à la soirée dansante ? Cette page s’adresse aux couples de {{city}}, en {{department}}, qui souhaitent découvrir la salle de mariage {{business}} et préparer une visite.',
    ],
    order: ['visit', 'capacity', 'decoration', 'catering', 'planning', 'budget'],
  },
  {
    id: 'organisation',
    label: 'Organisation du mariage',
    headings: [
      'Organiser votre mariage depuis {{city}}, étape par étape',
      'Du premier échange au jour J avec {{business}}',
      'Une réception bien préparée pour profiter de votre mariage',
    ],
    introductions: [
      'Préparer un mariage demande de coordonner plusieurs moments : cérémonie, arrivée des invités, repas et soirée. Depuis {{city}}, construisez votre projet autour de {{business}}, à Nanteuil-lès-Meaux. En clarifiant vos priorités dès le départ, vous pourrez avancer avec un déroulement lisible et des prestations définies.',
      'Une belle fête commence par une organisation qui laisse de la place au plaisir. Pour les futurs mariés de {{city}} ({{postalCode}}), {{business}} propose un lieu de réception où parler concrètement de votre journée : nombre de convives, ambiance, restauration et temps forts de la soirée.',
      'Votre mariage ne se résume pas au choix d’une date. Il faut aussi penser aux familles, aux prestataires et au rythme de la réception. Si vous préparez votre union depuis {{city}}, en {{department}}, voici une manière pratique d’aborder votre projet chez {{business}}, sans oublier les questions essentielles avant de réserver.',
    ],
    order: ['planning', 'capacity', 'catering', 'decoration', 'budget', 'visit'],
  },
  {
    id: 'reception',
    label: 'Accueil des invités',
    headings: [
      'Réunir vos invités chez {{business}} depuis {{city}}',
      'Une salle de mariage pensée autour de votre réception',
      'Préparer l’accueil de vos proches pour une belle célébration',
    ],
    introductions: [
      'La réussite d’une réception tient aussi au confort de ceux qui la partagent avec vous. Couples de {{city}}, pensez dès le début à votre liste d’invités, aux places à table et au déroulement du repas. {{business}}, situé à Nanteuil-lès-Meaux, permet de préparer une célébration réunissant jusqu’à 300 personnes selon l’aménagement retenu.',
      'Un mariage rassemble des générations, des familles et des amis venus pour célébrer votre union. Depuis {{city}} ({{postalCode}}), préparez leur accueil dans la salle de réception {{business}} : configuration des espaces, restauration et ambiance forment les bases d’un projet harmonieux.',
      'Vous souhaitez partager votre journée avec vos proches dans un cadre élégant ? Pour votre recherche de salle de mariage depuis {{city}}, en {{department}}, découvrez {{business}}. Commencez par préciser le nombre de convives et le type de réception, puis affinez les prestations avec l’équipe.',
    ],
    order: ['capacity', 'catering', 'planning', 'visit', 'decoration', 'budget'],
  },
  {
    id: 'personnalisation',
    label: 'Ambiance et personnalisation',
    headings: [
      'Un mariage à votre image chez {{business}}',
      'Donner une ambiance personnelle à votre réception',
      'Décoration, repas et soirée : préparez votre univers',
    ],
    introductions: [
      'Classique, festive ou intimiste dans son ambiance, votre réception doit raconter votre histoire. Depuis {{city}}, imaginez votre mariage chez {{business}}, à Nanteuil-lès-Meaux, en associant décoration, repas et animation. Un échange sur vos inspirations permettra de distinguer vos envies des options réellement retenues au devis.',
      'Une palette de couleurs, une musique d’entrée, une table soignée : les détails donnent une identité à votre mariage. Pour les couples de {{city}} ({{postalCode}}), {{business}} est un lieu où préparer ces choix ensemble, en tenant compte de la salle, des invités et du déroulement de la fête.',
      'Vous avez des idées pour votre mariage mais souhaitez les organiser dans un ensemble cohérent ? Cette page accompagne votre recherche depuis {{city}}, en {{department}}. Chez {{business}}, partez de vos priorités : l’ambiance que vous aimez, le repas à partager et les moments à vivre avec vos proches.',
    ],
    order: ['decoration', 'catering', 'capacity', 'planning', 'visit', 'budget'],
  },
  {
    id: 'budget',
    label: 'Budget et devis',
    headings: [
      'Préparer votre devis de mariage depuis {{city}}',
      'Comparer vos besoins avant de réserver {{business}}',
      'Construire une réception adaptée à votre projet',
    ],
    introductions: [
      'Un devis utile commence par un projet bien défini. Pour votre mariage depuis {{city}}, indiquez la période souhaitée, le nombre de personnes et les prestations qui comptent pour vous. {{business}}, à Nanteuil-lès-Meaux, vous permet de discuter de la réception avant de décider ce que vous souhaitez réserver.',
      'La salle, le repas et l’ambiance sont des postes importants de votre mariage. Plutôt que de comparer des promesses générales, préparez une demande détaillée pour {{business}}. Habitants de {{city}} ({{postalCode}}), rassemblez vos besoins afin de comprendre ce qui figure au devis et ce qui reste à organiser.',
      'Vous cherchez une salle de mariage depuis {{city}}, en {{department}}, et souhaitez avancer avec un budget clair ? Commencez par vos indispensables. Le nombre d’invités, la restauration et les prestations choisies guideront votre échange avec {{business}} et la préparation d’une proposition personnalisée.',
    ],
    order: ['budget', 'capacity', 'catering', 'decoration', 'planning', 'visit'],
  },
  {
    id: 'acces',
    label: 'Accès et déplacements',
    headings: [
      'Préparer votre réception à Nanteuil-lès-Meaux depuis {{city}}',
      'Un mariage chez {{business}} : organiser la venue des invités',
      'De {{city}} à votre lieu de réception : les points à prévoir',
    ],
    introductions: [
      'Lorsque la cérémonie et la réception se déroulent dans des lieux différents, les déplacements méritent une attention particulière. Depuis {{city}}, préparez votre venue chez {{business}}, au 5 avenue Fridingen, 77100 Nanteuil-lès-Meaux. Vérifiez votre itinéraire, partagez l’adresse et gardez une marge dans le programme.',
      'Pour réunir vos proches chez {{business}}, commencez par leur donner des informations simples : adresse exacte, heure d’accueil et déroulement de la soirée. Cette page s’adresse aux couples de {{city}} ({{postalCode}}) qui organisent une réception à Nanteuil-lès-Meaux et souhaitent anticiper les déplacements.',
      'Vous préparez un mariage depuis {{city}}, en {{department}} ? Choisir {{business}} signifie organiser votre réception à Nanteuil-lès-Meaux. Pensez au trajet de vos invités comme à une partie du projet : repérage lors de la visite, coordination après la cérémonie et organisation du retour en fin de soirée.',
    ],
    order: ['planning', 'visit', 'capacity', 'catering', 'budget', 'decoration'],
  },
]

const BLOCKS = {
  visit: {
    headings: ['Une visite pour découvrir la salle', 'Les bonnes questions à poser sur place', 'Se projeter dans votre lieu de réception', 'Préparer votre rendez-vous chez {{business}}'],
    paragraphs: [
      'Une visite vous aide à comprendre la disposition de la salle et à imaginer les temps forts de votre réception. Venez avec une première estimation du nombre d’invités et vos idées d’ambiance. Repérez les espaces pour le repas, l’accueil et la soirée, puis demandez quelles configurations peuvent être proposées pour votre date.',
      'Avant de réserver, prenez rendez-vous pour voir les lieux et discuter du projet. La visite permet de confronter vos inspirations à la réalité de la salle. Notez vos questions sur l’aménagement, les prestations et les horaires ; vous repartirez avec une vision plus précise de ce qui peut être préparé pour votre mariage.',
      'Photographies et descriptions donnent une première impression ; une rencontre sur place permet d’aller plus loin. Chez {{business}}, prenez le temps de regarder comment vos invités pourront être accueillis et comment les différents moments s’enchaîneront. Présentez aussi les besoins particuliers de votre famille pour les examiner avant la réservation.',
      'Pour rendre votre visite utile, préparez une courte liste : nombre de convives, période envisagée, type de repas et attentes pour la soirée. Demandez à visualiser la configuration qui correspond à votre projet. Cet échange est l’occasion de clarifier les détails pratiques et de vérifier les conditions écrites avant de vous engager.',
    ],
  },
  capacity: {
    headings: ['Jusqu’à 300 personnes pour votre mariage', 'Une configuration adaptée à vos convives', 'Penser l’espace autour de votre liste d’invités', 'Accueil, repas et danse : préparer l’aménagement'],
    paragraphs: [
      '{{business}} peut accueillir jusqu’à 300 personnes. La configuration doit être définie selon votre nombre d’invités et le format de la réception : repas, accueil et espace consacré à la danse. Avant de finaliser la liste, échangez sur l’aménagement envisagé pour que chaque moment trouve sa place dans la salle.',
      'La capacité annoncée de la salle est de 300 personnes maximum. Votre projet mérite cependant une configuration précise, pas seulement un chiffre : place des tables, circulation entre les espaces et organisation de la soirée sont à discuter. Une première liste d’invités aidera à préparer un aménagement correspondant à votre réception.',
      'Pour réunir vos proches, {{business}} dispose d’une salle pouvant recevoir jusqu’à 300 convives. Commencez par distinguer les personnes présentes au repas et celles attendues pour les autres moments. Vous pourrez ensuite préciser avec l’équipe la disposition des tables et les espaces nécessaires au bon déroulement de la célébration.',
      'Le nombre d’invités influence l’ensemble du projet. Avec une capacité allant jusqu’à 300 personnes, la salle permet d’envisager une grande réception, mais l’organisation reste à adapter à votre fête. Présentez le format souhaité et vérifiez la configuration retenue avant de confirmer les invitations et les prestations.',
    ],
  },
  catering: {
    headings: ['Le repas, un moment central de la réception', 'Traiteur et service : préparer vos attentes', 'Une restauration à définir avec l’équipe', 'Partager un repas à l’image de votre mariage'],
    paragraphs: [
      'Le service traiteur et le service en salle font partie des prestations à discuter chez {{business}}. Précisez vos goûts, le déroulement du repas et les besoins alimentaires de vos invités. Demandez quelles propositions sont disponibles pour votre projet et faites inscrire au devis le menu, le service et les options effectivement choisis.',
      'Du premier accueil au repas, la restauration contribue à l’ambiance de votre mariage. Échangez avec l’équipe sur la prestation traiteur et les modalités du service. Signalez les allergies et les demandes particulières suffisamment tôt ; leur prise en compte et les possibilités proposées doivent être confirmées avant la réception.',
      'Votre repas doit s’accorder avec le rythme de la journée. Pour préparer les prestations de traiteur et de service, indiquez le nombre de convives et les moments que vous souhaitez organiser. Prenez le temps de discuter des propositions, des boissons et des détails pratiques, sans supposer qu’une option est incluse avant confirmation.',
      'La qualité de l’accueil se prolonge à table. Chez {{business}}, abordez le repas comme une prestation à construire : composition du menu, déroulement du service et attentes de vos proches. Vérifiez les éléments retenus dans votre proposition afin de partager un moment convivial avec une organisation connue à l’avance.',
    ],
  },
  decoration: {
    headings: ['Une décoration qui vous ressemble', 'Préparer l’ambiance et les temps forts', 'Des choix cohérents pour une réception élégante', 'Du décor à la musique : personnaliser votre fête'],
    paragraphs: [
      'La décoration et l’animation donnent une identité à la réception. Présentez vos couleurs, vos inspirations et les moments musicaux importants pour vous. {{business}} propose des prestations de décoration et de DJ à préciser selon votre projet. Validez les choix disponibles, les horaires et ce qui figure effectivement dans votre formule.',
      'Une ambiance réussie ne repose pas sur l’accumulation de détails. Choisissez un fil conducteur pour la décoration et échangez sur l’animation de la soirée. Les prestations proposées chez {{business}} permettent d’aborder le décor et le DJ avec l’équipe, en définissant précisément les options que vous souhaitez retenir.',
      'Votre entrée, le repas et la soirée dansante n’ont pas nécessairement le même rythme. Préparez les morceaux et les ambiances qui vous tiennent à cœur, puis discutez de la prestation DJ. Pour le décor, apportez quelques inspirations : elles aideront à choisir des éléments cohérents avec la salle et votre réception.',
      'Pour personnaliser votre mariage, commencez par les éléments les plus visibles : ambiance des tables, couleurs et musique. Parlez des prestations de décoration et d’animation disponibles, puis établissez une sélection réaliste. Le devis doit distinguer les éléments compris dans la proposition et les demandes supplémentaires à confirmer.',
    ],
  },
  planning: {
    headings: ['Un déroulement clair pour le jour J', 'Anticiper la venue de vos proches', 'Coordonner les différents moments du mariage', 'Préparer la journée sans oublier le retour'],
    paragraphs: [
      'Établissez un programme qui relie la cérémonie, le trajet vers la salle et l’accueil des invités. Depuis {{city}}, vérifiez l’itinéraire jusqu’à Nanteuil-lès-Meaux et prévoyez une marge selon les conditions du jour. Partagez l’adresse exacte, puis coordonnez les heures d’arrivée avec les prestataires et les personnes qui vous accompagnent.',
      'La cérémonie, les photographies, le repas et la fête doivent s’enchaîner sans précipitation. Écrivez les horaires importants et confirmez-les avec les intervenants concernés. Pour les invités venant de {{city}}, donnez l’adresse de {{business}} et invitez chacun à vérifier son trajet ; pensez également à l’organisation du retour après la soirée.',
      'Pour profiter de votre réception, clarifiez les responsabilités avant le jour J : qui accueille les invités, qui contacte les prestataires et qui suit les horaires ? Préparez ces points avec vos proches et l’équipe. Les déplacements depuis {{city}} doivent être vérifiés sur un itinéraire actualisé, sans retenir un temps de route comme une garantie.',
      'Un programme simple est souvent plus utile qu’un planning trop serré. Notez les moments incontournables de votre mariage et les coordonnées des intervenants. Anticipez le déplacement entre la cérémonie et {{business}}, partagez les indications pratiques aux invités de {{city}} et organisez leur retour pour terminer la journée sereinement.',
    ],
  },
  budget: {
    headings: ['Un devis personnalisé pour votre réception', 'Préciser les prestations avant de réserver', 'Construire votre projet avec un budget clair', 'Comparer une proposition complète, pas seulement un tarif'],
    paragraphs: [
      'Pour obtenir un devis pertinent, indiquez votre date ou votre période, le nombre d’invités et les prestations souhaitées. Demandez le détail de la location, de la restauration et des options retenues. Vous pourrez comparer une proposition concrète et vérifier les conditions de réservation, plutôt que vous appuyer sur un prix général qui ne décrit pas votre mariage.',
      'Classez vos priorités : salle, repas, décoration et animation. Cette liste permet d’échanger sur ce qui compte vraiment pour votre réception et de demander une proposition adaptée. Avant tout engagement, relisez les prestations incluses, les éventuels suppléments et les modalités prévues au contrat. Aucun tarif uniforme ne remplace un devis pour votre projet.',
      'Le budget doit refléter vos choix, pas des prestations supposées incluses. Présentez à {{business}} votre nombre de convives, vos attentes et la période envisagée. Demandez ensuite une proposition détaillée, puis clarifiez les points encore ouverts. Les disponibilités et les conditions de réservation sont à confirmer directement avec l’établissement.',
      'Préparer le devis est aussi une façon de mettre votre projet au clair. Distinguez vos indispensables des options que vous aimeriez ajouter, puis demandez ce qui peut être proposé. Vérifiez le contenu écrit de la prestation et les modalités du contrat avant de confirmer : votre décision reposera ainsi sur des éléments précis.',
    ],
  },
}

const FAQS = [
  {
    headings: ['Où se trouve la salle ?', 'La réception se déroule-t-elle à {{city}} ?'],
    answers: ['{{business}} se trouve au 5 avenue Fridingen, 77100 Nanteuil-lès-Meaux. Cette page s’adresse aux habitants de {{city}} qui recherchent un lieu pour leur réception.', 'La salle est située à Nanteuil-lès-Meaux, en Seine-et-Marne. Les couples de {{city}} peuvent préparer leur mariage chez {{business}} en vérifiant le trajet depuis leur commune.'],
  },
  {
    headings: ['Combien d’invités peut-on accueillir ?', 'Quelle capacité prévoir pour le mariage ?'],
    answers: ['La salle peut accueillir jusqu’à 300 personnes. La configuration correspondant à votre repas et à votre soirée doit être discutée avant la réservation.', 'La capacité maximale annoncée est de 300 personnes ; l’aménagement précis dépend du format retenu pour votre réception et doit être confirmé avec l’équipe.'],
  },
  {
    headings: ['Comment préparer une demande de devis ?', 'Quelles informations transmettre pour votre projet ?'],
    answers: ['Indiquez la date ou la période souhaitée, votre nombre d’invités et les prestations envisagées. Demandez un devis détaillé et vérifiez les disponibilités auprès de {{business}}.', 'Rassemblez votre période, votre liste estimative de convives et vos attentes pour la salle, le repas et l’ambiance. Ces éléments serviront de base à une proposition personnalisée.'],
  },
  {
    headings: ['Peut-on visiter avant de réserver ?', 'Comment se projeter dans la salle ?'],
    answers: ['Contactez {{business}} pour convenir d’une visite. Ce rendez-vous permet de voir les espaces, d’aborder leur configuration et de poser vos questions avant de vous engager.', 'Prenez rendez-vous pour découvrir la salle et discuter de votre réception. Une visite vous aidera à préciser l’aménagement et les prestations à retenir.'],
  },
  {
    headings: ['Les prestations sont-elles toutes incluses ?', 'Comment choisir le traiteur, la décoration et le DJ ?'],
    answers: ['Les prestations retenues doivent figurer dans votre devis. Parlez du traiteur, du service, de la décoration et du DJ sans supposer que toutes les options sont automatiquement comprises.', 'Présentez vos attentes à l’équipe, demandez les possibilités proposées et vérifiez le détail écrit de votre formule avant de confirmer les options.'],
  },
]

const CONCLUSIONS = [
  'Votre projet prend forme ? Contactez {{business}} pour discuter de votre date, préparer une visite et demander un devis personnalisé pour votre mariage depuis {{city}}.',
  'Pour passer des idées à une réception concrète, échangez avec {{business}}. Présentez votre projet depuis {{city}} et prenez rendez-vous pour découvrir la salle avant de réserver.',
  'Un premier échange permet de clarifier les disponibilités, les prestations et les prochaines étapes. Les futurs mariés de {{city}} peuvent contacter {{business}} pour avancer sur leur projet.',
  'Préparez votre liste d’invités, vos dates possibles et vos envies, puis contactez {{business}}. Vous pourrez préciser votre réception et les conditions de réservation avec l’équipe.',
]

function randomFromSeed(seed) {
  let state = seed
  return () => {
    state += 0x6D2B79F5
    let value = Math.imul(state ^ (state >>> 15), state | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(values, random) {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function generateWeddingPage({ slug, businessName = 'Le Paradise', seed, familyId }) {
  const city = getCityBySlug(slug)
  if (!city || !/^\d{5}$/.test(city.postalCode || '')) throw new Error(`Ville ou code postal invalide : ${slug}`)
  if (!businessName.trim()) throw new Error('Le nom de la salle doit être renseigné.')
  const chosenSeed = seed ?? crypto.getRandomValues(new Uint32Array(1))[0]
  if (!Number.isInteger(chosenSeed) || chosenSeed < 0 || chosenSeed > 0xFFFFFFFF) throw new Error('Graine de génération invalide.')
  const random = randomFromSeed(chosenSeed)
  const pick = (values) => values[Math.floor(random() * values.length)]
  const randomFamily = pick(WEDDING_TEMPLATE_FAMILIES)
  const family = familyId ? WEDDING_TEMPLATE_FAMILIES.find((item) => item.id === familyId) : randomFamily
  if (!family) throw new Error(`Modèle inconnu : ${familyId}`)
  const inline = (text) => text.replace(/[\r\n]+/g, ' ').replace(/[\\*#<>[\]`]/g, '').trim()
  const values = { city: city.name, postalCode: city.postalCode, department: city.deptName, business: inline(businessName) }
  const fill = (text) => text.replace(/\{\{(city|postalCode|department|business)\}\}/g, (_match, key) => values[key])
  const sections = [`## ${fill(pick(family.headings))}\n\n${fill(pick(family.introductions))}`]
  const blockChoices = {}
  for (const id of family.order) {
    const block = BLOCKS[id]
    const heading = Math.floor(random() * block.headings.length)
    const paragraph = Math.floor(random() * block.paragraphs.length)
    blockChoices[id] = { heading, paragraph }
    sections.push(`## ${fill(block.headings[heading])}\n\n${fill(block.paragraphs[paragraph])}`)
  }
  const km = Math.round(haversineKm(city, { lat: 48.9617, lng: 2.8985 }))
  sections.push(`## Votre projet depuis ${city.name} (${city.postalCode})\n\n${city.name} se trouve en ${city.deptName} (${city.deptCode}). La distance entre le centre de cette commune et la salle à Nanteuil-lès-Meaux est d’environ ${km} km à vol d’oiseau : ce n’est ni une distance routière ni une durée de trajet. Vérifiez l’itinéraire adapté à votre point de départ avant la visite ou le jour de votre mariage.`)
  const faqs = shuffle(FAQS, random).slice(0, 3).map((faq) => `### ${fill(pick(faq.headings))}\n\n${fill(pick(faq.answers))}`)
  sections.push(`## Questions pour préparer votre réception\n\n${faqs.join('\n\n')}`)
  sections.push(`## Parler de votre mariage avec ${values.business}\n\n${fill(pick(CONCLUSIONS))}`)
  const reviewIds = shuffle(WEDDING_REVIEWS, random).slice(0, 2).map((review) => review.id)
  return {
    content: sections.join('\n\n'),
    generatedAt: new Date().toISOString(),
    template: { version: WEDDING_TEMPLATE_VERSION, familyId: family.id, seed: chosenSeed, blockChoices, reviewIds },
  }
}

export function validateWeddingTemplate(template) {
  if (template === undefined) return undefined
  if (!template || template.version !== WEDDING_TEMPLATE_VERSION
    || !WEDDING_TEMPLATE_FAMILIES.some((family) => family.id === template.familyId)
    || !Number.isInteger(template.seed) || template.seed < 0 || template.seed > 0xFFFFFFFF
    || !Array.isArray(template.reviewIds) || template.reviewIds.length !== 2
    || new Set(template.reviewIds).size !== 2
    || template.reviewIds.some((id) => !WEDDING_REVIEWS.some((review) => review.id === id))) {
    throw new Error('Modèle ou sélection des avis invalide. Régénérez cette page avant de la publier.')
  }
  return {
    version: template.version,
    familyId: template.familyId,
    seed: template.seed,
    reviewIds: [...template.reviewIds],
  }
}
