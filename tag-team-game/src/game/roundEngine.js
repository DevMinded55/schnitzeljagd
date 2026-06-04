import {
  CALL_ORDER,
  MAX_HUNTS_PER_DURCHGANG,
  getAnimal,
  canHunt,
} from "./animals.js";
import { distributeFood } from "./scoring.js";

export function alivePlayers(players) {
  return players.filter((p) => p.alive);
}

export function playersWithSelection(players, selections, animalId, aliveOnly = true) {
  return players.filter((p) => {
    if (aliveOnly && !p.alive) return false;
    return selections[p.id] === animalId;
  });
}

export function appendTableOpen(tableOpen, playerId, animalId) {
  const current = tableOpen[playerId] || [];
  if (current.includes(animalId)) return tableOpen;
  return { ...tableOpen, [playerId]: [...current, animalId] };
}

export function appendDurchgangPlay(durchgangPlays, playerId, animalId) {
  const current = durchgangPlays[playerId] || [];
  if (current.includes(animalId)) return durchgangPlays;
  return { ...durchgangPlays, [playerId]: [...current, animalId] };
}

export function commitHuntSelections(players, selections, tableOpen, durchgangPlays) {
  let open = { ...tableOpen };
  let plays = { ...durchgangPlays };

  players.forEach((p) => {
    const sel = selections[p.id];
    if (!sel) return;
    open = appendTableOpen(open, p.id, sel);
    plays = appendDurchgangPlay(plays, p.id, sel);
  });

  return { tableOpen: open, durchgangPlays: plays };
}

export function eliminatePlayers(players, ids) {
  const set = new Set(ids);
  return players.map((p) => (set.has(p.id) ? { ...p, alive: false } : p));
}

export function isHuntSelectionRevealed(playerId, selections, tableOpen) {
  const sel = selections[playerId];
  if (!sel) return true;
  return (tableOpen[playerId] || []).includes(sel);
}

export function allHuntSelectionsRevealed(players, selections, tableOpen) {
  return players.every((p) =>
    isHuntSelectionRevealed(p.id, selections, tableOpen),
  );
}

const ALL_REVEALED_SUFFIX = " Alle Karten aufgedeckt – Jagd beendet.";

export function maybeFinishHuntIfAllRevealed(room, message) {
  if (!allHuntSelectionsRevealed(room.players, room.selections, room.tableOpen)) {
    return null;
  }
  const fullMessage = message
    ? `${message}${ALL_REVEALED_SUFFIX}`
    : ALL_REVEALED_SUFFIX.trim();
  return finishHunt(room, { message: fullMessage });
}

function afterReveal(room, message) {
  return maybeFinishHuntIfAllRevealed(room, message) ?? room;
}

/**
 * Verarbeitet den Aufruf des Tieres an callIndex.
 */
export function processAnimalCall(room) {
  const { players, selections, callIndex, tableOpen } = room;
  const animalId = CALL_ORDER[callIndex];
  const animal = getAnimal(animalId);
  const matches = playersWithSelection(players, selections, animalId, true);

  if (matches.length === 0) {
    const next = callIndex + 1;
    if (next >= CALL_ORDER.length) {
      return finishHunt(room, {
        message: `${animal?.name ?? "Tier"}: niemand – Jagd beendet.`,
      });
    }
    return afterReveal(
      {
        ...room,
        callIndex: next,
        lastCall: { animalId, type: "none" },
        message: `${animal?.name}: niemand. Weiter mit ${getAnimal(CALL_ORDER[next])?.name}.`,
      },
      `${animal?.name}: niemand.`,
    );
  }

  if (matches.length >= 2) {
    let open = { ...tableOpen };
    matches.forEach((p) => {
      open = appendTableOpen(open, p.id, animalId);
    });
    const next = callIndex + 1;
    const names = matches.map((p) => p.name).join(", ");
    if (next >= CALL_ORDER.length) {
      return finishHunt({
        ...room,
        tableOpen: open,
        callIndex: next,
        lastCall: { animalId, type: "duplicate", playerIds: matches.map((p) => p.id) },
      }, {
        message: `${animal?.name}: ${names} – blockiert, keine Jagd. Jagd beendet.`,
      });
    }
    return afterReveal(
      {
        ...room,
        tableOpen: open,
        callIndex: next,
        lastCall: {
          animalId,
          type: "duplicate",
          playerIds: matches.map((p) => p.id),
        },
        message: `${animal?.name}: ${names} – blockiert. Weiter mit ${getAnimal(CALL_ORDER[next])?.name}.`,
      },
      `${animal?.name}: ${names} – blockiert.`,
    );
  }

  const hunter = matches[0];
  return {
    ...room,
    phase: "huntPick",
    currentHunterId: hunter.id,
    callingAnimalId: animalId,
    lastCall: { animalId, type: "hunter", hunterId: hunter.id },
    message: `${hunter.name} (${animal?.name}) wählt die Beute …`,
  };
}

/**
 * Jäger hat Beute gewählt; Gefressene ausscheiden oder nichts passiert.
 */
export function resolveHuntPick(room, preyAnimalId) {
  const { players, selections, tableOpen, callIndex, currentHunterId, callingAnimalId } =
    room;
  const hunter = players.find((p) => p.id === currentHunterId);
  if (!hunter || !canHunt(callingAnimalId, preyAnimalId)) {
    return { error: "Ungültige Beute." };
  }

  const prey = getAnimal(preyAnimalId);
  const preyPlayers = playersWithSelection(players, selections, preyAnimalId, true);

  let open = appendTableOpen(tableOpen, currentHunterId, callingAnimalId);
  let updated = [...players];
  let msg;

  if (preyPlayers.length === 0) {
    msg = `${hunter.name} jagt ${prey?.name} – niemand erwischt.`;
  } else {
    const eatenIds = preyPlayers.map((p) => p.id);
    preyPlayers.forEach((p) => {
      open = appendTableOpen(open, p.id, preyAnimalId);
    });
    updated = eliminatePlayers(updated, eatenIds);
    const names = preyPlayers.map((p) => p.name).join(", ");
    msg = `${hunter.name} frisst ${prey?.name}: ${names} ${preyPlayers.length > 1 ? "sind" : "ist"} raus.`;
  }

  const next = callIndex + 1;
  const base = {
    ...room,
    players: updated,
    tableOpen: open,
    phase: "calling",
    currentHunterId: null,
    callingAnimalId: null,
    pendingPrey: null,
    callIndex: next,
    lastCall: {
      animalId: callingAnimalId,
      type: "hunt",
      hunterId: currentHunterId,
      preyId: preyAnimalId,
      eatenIds: preyPlayers.map((p) => p.id),
    },
  };

  const earlyFinish = maybeFinishHuntIfAllRevealed(base, msg);
  if (earlyFinish) return earlyFinish;

  if (next >= CALL_ORDER.length) {
    return finishHunt(base, { message: msg + " Jagd beendet." });
  }

  return {
    ...base,
    message: msg + ` Weiter: ${getAnimal(CALL_ORDER[next])?.name}.`,
  };
}

export function finishHunt(room, { message } = {}) {
  const { selections, tableOpen, durchgangPlays, huntIndex } = room;
  const { tableOpen: open, durchgangPlays: plays } = commitHuntSelections(
    room.players,
    selections,
    tableOpen,
    durchgangPlays,
  );

  const survivors = alivePlayers(room.players);
  const endDurchgang =
    survivors.length <= 1 || huntIndex >= MAX_HUNTS_PER_DURCHGANG;

  if (endDurchgang) {
    const scored = distributeFood(room.players, plays);
    const awardText = scored.awards
      .filter((a) => a.amount > 0)
      .map((a) => {
        const p = scored.players.find((x) => x.id === a.playerId);
        return `${p?.name}: +${a.amount}`;
      })
      .join(" · ");

    return {
      ...room,
      players: scored.players,
      selections: {},
      tableOpen: open,
      durchgangPlays: plays,
      phase: scored.gameWinnerId ? "gameOver" : "durchgangScore",
      gameWinnerId: scored.gameWinnerId ?? null,
      currentHunterId: null,
      callingAnimalId: null,
      callIndex: 0,
      lastAwards: scored.awards,
      message:
        message ||
        `Durchgang beendet.${awardText ? ` Futter: ${awardText}.` : ""}`,
    };
  }

  return {
    ...room,
    players: room.players,
    selections: {},
    tableOpen: open,
    durchgangPlays: plays,
    huntIndex: huntIndex + 1,
    phase: "select",
    callIndex: 0,
    currentHunterId: null,
    callingAnimalId: null,
    lastCall: null,
    message:
      message ||
      `Jagd ${huntIndex} fertig. Jagd ${huntIndex + 1}: wählt verdeckt eine Karte.`,
  };
}

export function startCallingPhase(room) {
  return {
    ...room,
    phase: "calling",
    callIndex: 0,
    lastCall: null,
    message: `Aufruf beginnt – ${getAnimal(CALL_ORDER[0])?.name}.`,
  };
}

export function startNextDurchgang(room) {
  const durchgangIndex = (room.durchgangIndex || 1) + 1;
  return {
    ...room,
    players: room.players.map((p) => ({ ...p, alive: true })),
    phase: "select",
    huntIndex: 1,
    durchgangIndex,
    callIndex: 0,
    selections: {},
    tableOpen: {},
    durchgangPlays: {},
    currentHunterId: null,
    callingAnimalId: null,
    pendingPrey: null,
    lastCall: null,
    lastAwards: null,
    gameWinnerId: null,
    message: `Durchgang ${durchgangIndex} – wählt verdeckt eine Karte.`,
  };
}

export function initialRoomPlayer(id, name) {
  return { id, name, alive: true, food: 0 };
}

export function emptyTableState(playerIds) {
  const tableOpen = {};
  const durchgangPlays = {};
  playerIds.forEach((id) => {
    tableOpen[id] = [];
    durchgangPlays[id] = [];
  });
  return { tableOpen, durchgangPlays };
}
