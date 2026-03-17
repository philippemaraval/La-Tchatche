export const NAV_ITEMS = ['Marchés', 'Cafés', 'Plages', 'Stade', 'Boutiques', 'Écoles']

export const LEXICON = {
  accent: 'L accent marseillais est chantant, solaire et tres identitaire.',
  minot: 'Un minot est un enfant du quartier, souvent plein de malice.',
  gabian: 'Gabian designe la mouette locale, omnipresente autour du port.',
  degun: 'Degun signifie personne. Exemple: "Y a degun sur la place."',
  fada: 'Fada veut dire un peu fou, souvent avec affection.',
  pitchoun: 'Pitchoun decrit un petit enfant, terme affectif du Sud.',
  emboucaner: 'Emboucaner, c est se meler d une affaire et creer du remous.',
}

export const BASE_EPISODES = [
  {
    id: 'ep-001',
    slug: 'marius-roi-panier',
    title: 'Marius : Le Roi du Panier',
    category: 'Stade',
    location: { label: 'Le Panier', lat: 43.3002, lng: 5.3698 },
    duration: 225,
    keywords: ['accent', 'degun', 'fada'],
    summary:
      'Il parle de petanque comme d une religion, entre rire gras et tacle glisse. Un [[accent]] qui sent le soleil et les gradins ou il n y a [[degun]] quand l OM est en deplacement.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    id: 'ep-002',
    slug: 'samia-cours-julien-neons',
    title: 'Samia : Neons du Cours Julien',
    category: 'Boutiques',
    location: { label: 'Cours Julien', lat: 43.2933, lng: 5.3836 },
    duration: 248,
    keywords: ['minot', 'fada', 'emboucaner'],
    summary:
      'Dans les rues qui vibrent jusqu a tard, chaque facade raconte un couplet. Les [[minot]] dansent et les anciens disent que c est un peu [[fada]], mais la ville aime cette energie.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  {
    id: 'ep-003',
    slug: 'jeanine-vieux-port-matin',
    title: 'Jeanine : Matin du Vieux-Port',
    category: 'Cafés',
    location: { label: 'Vieux-Port', lat: 43.2951, lng: 5.3743 },
    duration: 201,
    keywords: ['gabian', 'accent'],
    summary:
      'Avant la foule, il y a les bateaux, le cafe et les [[gabian]] qui tournent. Sa voix tire des images nettes, presque en noir et rouge, avec un [[accent]] de cinema.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  },
  {
    id: 'ep-004',
    slug: 'amelie-plage-soir',
    title: 'Amelie : L Ecume de Prado',
    category: 'Plages',
    location: { label: 'Plages du Prado', lat: 43.2694, lng: 5.3756 },
    duration: 232,
    keywords: ['pitchoun', 'gabian'],
    summary:
      'Le vent ramene les histoires de famille sur le sable. On entend les [[pitchoun]] courir, les [[gabian]] crier, et la ville prendre une respiration plus lente.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  },
  {
    id: 'ep-005',
    slug: 'nadir-noailles-marche',
    title: 'Nadir : Le Marche qui Deborde',
    category: 'Marchés',
    location: { label: 'Noailles', lat: 43.2968, lng: 5.3796 },
    duration: 239,
    keywords: ['emboucaner', 'degun'],
    summary:
      'A Noailles, tout est negocie, improvise, partage. Quand quelqu un veut [[emboucaner]] la discussion, Nadir replace le cadre: ici, on ecoute avant de juger.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
  },
  {
    id: 'ep-006',
    slug: 'leila-stade-bouillant',
    title: 'Leila : Virage en Feu',
    category: 'Stade',
    location: { label: 'Orange Velodrome', lat: 43.2699, lng: 5.3959 },
    duration: 216,
    keywords: ['fada', 'accent'],
    summary:
      'Elle raconte la tribune comme une chorale brute. C est [[fada]], massif, tendre aussi. Le chant monte, l [[accent]] coupe l air, et tout le quartier tient debout.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
  },
  {
    id: 'ep-007',
    slug: 'paolo-port-ferrys',
    title: 'Paolo : Ferrys et Brouillard',
    category: 'Cafés',
    location: { label: 'Quai du Port', lat: 43.2969, lng: 5.3718 },
    duration: 255,
    keywords: ['gabian', 'degun'],
    summary:
      'Entre les annonces de depart et l odeur de metal, Paolo garde un calme rare. Il dit qu a 6h, il n y a presque [[degun]], juste les [[gabian]] et le bruit sourd des coques.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
  },
  {
    id: 'ep-008',
    slug: 'ines-plage-crepuscule',
    title: 'Ines : Crepuscule a Corbieres',
    category: 'Écoles',
    location: { label: 'Corbieres', lat: 43.3282, lng: 5.2921 },
    duration: 244,
    keywords: ['pitchoun', 'accent'],
    summary:
      'Le soleil tombe derriere les rochers, et la parole devient lente, precise. Ines parle de ses [[pitchoun]] et de cet [[accent]] qui reste meme loin de Marseille.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  },
]

export const MAX_BATCHES = 14
export const MARSEILLE_CENTER = [43.2965, 5.3698]
export const MARSEILLE_BOUNDS = [
  [43.16, 5.03],
  [43.5, 5.62],
]

export function buildEpisodeBatch(page, count = 4) {
  const items = []
  for (let index = 0; index < count; index += 1) {
    const base = BASE_EPISODES[(page * count + index) % BASE_EPISODES.length]
    items.push({
      ...base,
      id: `${base.id}-p${page + 1}-${index + 1}`,
      slug: `${base.slug}-p${page + 1}-${index + 1}`,
      title: page === 0 ? base.title : `${base.title} (Session ${page + 1})`,
      duration: base.duration + ((page + index) % 3) * 6,
      location: {
        ...base.location,
        lat: base.location.lat + ((index % 2 === 0 ? 1 : -1) * 0.0018 * page) / 10,
        lng: base.location.lng + ((index % 3 === 0 ? -1 : 1) * 0.0016 * page) / 10,
      },
    })
  }
  return items
}
