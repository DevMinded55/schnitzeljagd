export const WIN_FOOD = 5;
export const MAX_HUNTS_PER_DURCHGANG = 3;

export const CALL_ORDER = ["bear", "wolf", "lynx", "owl", "mouse"];

export const animals = [
  {
    id: "bear",
    name: "Bär",
    emoji: "🐻",
    image: "/cards/baer.png",
    value: 1,
    color: "from-amber-600 to-amber-800",
    ring: "ring-amber-300",
    description: "An der Spitze der Nahrungskette",
  },
  {
    id: "wolf",
    name: "Wolf",
    emoji: "🐺",
    image: "/cards/wolf.png",
    value: 2,
    color: "from-zinc-500 to-zinc-700",
    ring: "ring-zinc-200",
    description: "Rudeljäger",
  },
  {
    id: "lynx",
    name: "Luchs",
    emoji: "🐆",
    image: "/cards/luchs.png",
    value: 3,
    color: "from-orange-500 to-orange-700",
    ring: "ring-orange-200",
    description: "Leiser Waldbewohner",
  },
  {
    id: "owl",
    name: "Eule",
    emoji: "🦉",
    image: "/cards/eule.png",
    value: 4,
    color: "from-purple-600 to-purple-800",
    ring: "ring-purple-200",
    description: "Jäger der Nacht",
  },
  {
    id: "mouse",
    name: "Maus",
    emoji: "🐭",
    image: "/cards/maus.png",
    value: 5,
    color: "from-emerald-500 to-emerald-700",
    ring: "ring-emerald-200",
    description: "Kann niemanden jagen",
  },
];

export function getAnimal(id) {
  return animals.find((a) => a.id === id) ?? null;
}

/** Beute: höherer Kartenwert = schwächer */
export function getValidPrey(hunterAnimalId) {
  const hunter = getAnimal(hunterAnimalId);
  if (!hunter) return [];
  return animals.filter((a) => a.value > hunter.value);
}

export function canHunt(hunterAnimalId, preyAnimalId) {
  const prey = getAnimal(preyAnimalId);
  const hunter = getAnimal(hunterAnimalId);
  if (!prey || !hunter) return false;
  return prey.value > hunter.value;
}

export function formatValidPrey(hunterAnimalId) {
  const prey = getValidPrey(hunterAnimalId);
  if (!prey.length) return "Niemanden";
  return prey.map((a) => a.name).join(", ");
}

export function isCardOnTable(tableOpen, playerId, animalId) {
  return (tableOpen[playerId] || []).includes(animalId);
}

export function sumDurchgangValues(playIds) {
  return (playIds || []).reduce((sum, id) => sum + (getAnimal(id)?.value ?? 0), 0);
}
