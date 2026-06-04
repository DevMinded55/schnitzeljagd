import { getAnimal } from "./animals.js";

function playerName(players, playerId) {
  return players.find((p) => p.id === playerId)?.name ?? "Spieler";
}

function cardEntry(players, playerId, animalId, badge) {
  const animal = getAnimal(animalId);
  if (!animal) return null;
  return {
    playerId,
    playerName: playerName(players, playerId),
    animal,
    badge,
  };
}

/**
 * @param {object|null} lastCall
 * @param {object[]} players
 * @param {Record<string, string>} selections
 * @returns {object|null}
 */
export function buildRevealDisplay(lastCall, players, selections) {
  if (!lastCall?.animalId) return null;

  const calledAnimal = getAnimal(lastCall.animalId);
  if (!calledAnimal) return null;

  const headline = `Aufgerufen: ${calledAnimal.name}`;
  const outcome = lastCall.type;

  if (outcome === "none") {
    return {
      calledAnimal,
      outcome,
      headline,
      subtitle: `Niemand hat ${calledAnimal.name} gespielt.`,
      cards: [],
    };
  }

  if (outcome === "duplicate") {
    const cards = (lastCall.playerIds || [])
      .map((id) => cardEntry(players, id, lastCall.animalId, "Blockiert"))
      .filter(Boolean);
    return {
      calledAnimal,
      outcome,
      headline,
      subtitle:
        cards.length > 1
          ? `${cards.length} Spieler – keine Jagd, Karten bleiben offen.`
          : "Keine Jagd.",
      cards,
    };
  }

  if (outcome === "hunter") {
    const cards = [
      cardEntry(players, lastCall.hunterId, lastCall.animalId, "Jägt"),
    ].filter(Boolean);
    const hunter = players.find((p) => p.id === lastCall.hunterId);
    return {
      calledAnimal,
      outcome,
      headline,
      subtitle: hunter
        ? `${hunter.name} wählt die Beute …`
        : "Jäger wählt die Beute …",
      cards,
    };
  }

  if (outcome === "hunt") {
    const cards = [];
    const hunterCard = cardEntry(
      players,
      lastCall.hunterId,
      lastCall.animalId,
      "Jägt",
    );
    if (hunterCard) cards.push(hunterCard);

    const preyId = lastCall.preyId;
    const eatenIds = lastCall.eatenIds || [];

    eatenIds.forEach((id) => {
      const entry = cardEntry(players, id, preyId, "Beute");
      if (entry) cards.push(entry);
    });

    const prey = getAnimal(preyId);
    let subtitle;
    if (eatenIds.length === 0) {
      subtitle = prey
        ? `Niemand hatte ${prey.name} – nichts passiert.`
        : "Niemand erwischt.";
    } else {
      const names = eatenIds
        .map((id) => playerName(players, id))
        .join(", ");
      subtitle = prey
        ? `${names} ${eatenIds.length > 1 ? "wurden" : "wurde"} gefressen.`
        : `${names} ausgeschieden.`;
    }

    return {
      calledAnimal,
      outcome,
      headline,
      subtitle,
      cards,
    };
  }

  return null;
}

export function badgeClassName(badge) {
  if (badge === "Blockiert") {
    return "bg-amber-500/25 text-amber-100 ring-amber-400/40";
  }
  if (badge === "Jägt") {
    return "bg-emerald-500/25 text-emerald-100 ring-emerald-400/40";
  }
  if (badge === "Beute") {
    return "bg-rose-500/25 text-rose-100 ring-rose-400/40";
  }
  return "bg-zinc-500/25 text-zinc-200 ring-white/20";
}
