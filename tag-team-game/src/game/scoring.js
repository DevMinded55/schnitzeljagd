import { WIN_FOOD, sumDurchgangValues } from "./animals.js";

/**
 * Verteilt Futter am Durchgangsende (Video-Regeln).
 * @returns {{ players: object[], awards: { playerId: string, amount: number, reason: string }[], gameWinnerId: string|null }}
 */
export function distributeFood(players, durchgangPlays) {
  const awards = [];
  const survivors = players.filter((p) => p.alive);
  const updated = players.map((p) => ({ ...p, food: p.food ?? 0 }));

  const applyFood = (playerId, amount) => {
    const idx = updated.findIndex((p) => p.id === playerId);
    if (idx >= 0) updated[idx].food += amount;
  };

  if (survivors.length === 1) {
    const s = survivors[0];
    applyFood(s.id, 2);
    awards.push({
      playerId: s.id,
      amount: 2,
      reason: "einziger Überlebender",
    });
  } else if (survivors.length >= 2) {
    const scored = survivors.map((p) => ({
      id: p.id,
      sum: sumDurchgangValues(durchgangPlays[p.id]),
    }));
    const maxSum = Math.max(...scored.map((s) => s.sum));
    const top = scored.filter((s) => s.sum === maxSum);

    survivors.forEach((p) => {
      const entry = scored.find((s) => s.id === p.id);
      const isTop = entry && entry.sum === maxSum;
      let amount = 0;
      let reason = "gefangen oder kein Futter";
      if (isTop) {
        amount = 2;
        reason =
          top.length > 1
            ? `Gleichstand (${entry.sum} Punkte)`
            : `meiste Punkte (${entry.sum})`;
      } else {
        amount = 1;
        reason = `überlebt (${entry?.sum ?? 0} Punkte)`;
      }
      applyFood(p.id, amount);
      awards.push({ playerId: p.id, amount, reason });
    });

    players
      .filter((p) => !p.alive)
      .forEach((p) => {
        awards.push({ playerId: p.id, amount: 0, reason: "gefangen" });
      });
  }

  let gameWinnerId = null;
  const leaders = updated.filter((p) => (p.food ?? 0) >= WIN_FOOD);
  if (leaders.length === 1) {
    gameWinnerId = leaders[0].id;
  } else if (leaders.length > 1) {
    const maxFood = Math.max(...leaders.map((p) => p.food));
    const top = leaders.filter((p) => p.food === maxFood);
    if (top.length === 1) gameWinnerId = top[0].id;
  }

  return { players: updated, awards, gameWinnerId };
}
