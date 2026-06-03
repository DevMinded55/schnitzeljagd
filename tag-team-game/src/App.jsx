import React from "react";

const animals = [
  {
    id: "bear",
    name: "Bear",
    image: "/cards/baer.png",
    power: 5,
    hunts: ["wolf", "lynx"],
    color: "bg-amber-700",
    description: "Strong and fearless hunter",
  },
  {
    id: "wolf",
    name: "Wolf",
    image: "/cards/wolf.png",
    power: 4,
    hunts: ["lynx", "owl"],
    color: "bg-zinc-600",
    description: "Fast pack predator",
  },
  {
    id: "lynx",
    name: "Lynx",
    image: "/cards/luchs.png",
    power: 3,
    hunts: ["owl", "mouse"],
    color: "bg-orange-600",
    description: "Silent forest stalker",
  },
  {
    id: "owl",
    name: "Owl",
    image: "/cards/eule.png",
    power: 2,
    hunts: ["mouse"],
    color: "bg-purple-700",
    description: "Night hunter",
  },
  {
    id: "mouse",
    name: "Mouse",
    image: "/cards/maus.png",
    power: 1,
    hunts: [],
    color: "bg-emerald-600",
    description: "Tiny survivor",
  },
];

function getAnimal(id) {
  return animals.find((a) => a.id === id);
}

export default function SchnitzeljagdInspiredGame() {
  const [playerCount, setPlayerCount] = React.useState(3);
  const [gameStarted, setGameStarted] = React.useState(false);
  const [players, setPlayers] = React.useState([]);
  const [round, setRound] = React.useState(1);
  const [revealed, setRevealed] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [winner, setWinner] = React.useState(null);

  function startGame() {
    const initialPlayers = Array.from({ length: playerCount }).map(
      (_, index) => ({
        id: index + 1,
        name: `Player ${index + 1}`,
        selected: null,
        alive: true,
        score: 0,
      }),
    );

    setPlayers(initialPlayers);
    setGameStarted(true);
    setRound(1);
    setWinner(null);
    setMessage("Choose your animals secretly.");
  }

  function selectAnimal(playerId, animalId) {
    if (revealed) return;

    setPlayers((prev) =>
      prev.map((player) =>
        player.id === playerId ? { ...player, selected: animalId } : player,
      ),
    );
  }

  function everyoneSelected() {
    return players.filter((p) => p.alive).every((p) => p.selected !== null);
  }

  function revealRound() {
    if (!everyoneSelected()) {
      setMessage("All alive players must choose an animal.");
      return;
    }

    const updatedPlayers = [...players];
    const eliminated = [];

    updatedPlayers.forEach((hunter) => {
      if (!hunter.alive) return;

      const hunterAnimal = getAnimal(hunter.selected);

      updatedPlayers.forEach((target) => {
        if (hunter.id === target.id || !target.alive) return;

        const targetAnimal = getAnimal(target.selected);

        if (hunterAnimal.hunts.includes(targetAnimal.id)) {
          if (!eliminated.includes(target.id)) {
            eliminated.push(target.id);
            hunter.score += 1;
          }
        }
      });
    });

    updatedPlayers.forEach((player) => {
      if (eliminated.includes(player.id)) {
        player.alive = false;
      }
    });

    const survivors = updatedPlayers.filter((p) => p.alive);

    if (survivors.length <= 1) {
      setWinner(survivors[0] || updatedPlayers[0]);
      setMessage(`${survivors[0]?.name || "Nobody"} wins the hunt!`);
    } else {
      setMessage(
        eliminated.length > 0
          ? `${eliminated.length} player(s) were hunted this round.`
          : "Nobody was hunted this round.",
      );
    }

    setPlayers(updatedPlayers);
    setRevealed(true);
  }

  function nextRound() {
    setPlayers((prev) =>
      prev.map((player) => ({
        ...player,
        selected: player.alive ? null : player.selected,
      })),
    );

    setRound((r) => r + 1);
    setRevealed(false);
    setMessage("Choose your next animal.");
  }

  function resetGame() {
    setGameStarted(false);
    setPlayers([]);
    setRound(1);
    setWinner(null);
    setRevealed(false);
    setMessage("");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-5xl font-bold tracking-tight">
            Schnitzeljagd Inspired
          </h1>
          <p className="text-zinc-400 text-lg">
            Multiplayer bluffing and hunting game for local browser play.
          </p>
        </header>

        {!gameStarted && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-xl space-y-6">
            <div>
              <label className="block text-lg mb-3 font-semibold">
                Number of Players
              </label>

              <select
                value={playerCount}
                onChange={(e) => setPlayerCount(Number(e.target.value))}
                className="bg-zinc-800 rounded-xl px-4 py-3 w-full"
              >
                {[2, 3, 4, 5, 6].map((count) => (
                  <option key={count} value={count}>
                    {count} Players
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={startGame}
              className="bg-green-600 hover:bg-green-500 transition px-6 py-4 rounded-2xl text-lg font-semibold w-full"
            >
              Start Game
            </button>
          </div>
        )}

        {gameStarted && (
          <>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className="text-zinc-400">Current Round</div>
                    <div className="text-4xl font-bold">{round}</div>
                  </div>

                  <div className="flex gap-3">
                    {!revealed && !winner && (
                      <button
                        onClick={revealRound}
                        className="bg-red-600 hover:bg-red-500 transition px-5 py-3 rounded-2xl font-semibold"
                      >
                        Reveal Hunt
                      </button>
                    )}

                    {revealed && !winner && (
                      <button
                        onClick={nextRound}
                        className="bg-blue-600 hover:bg-blue-500 transition px-5 py-3 rounded-2xl font-semibold"
                      >
                        Next Round
                      </button>
                    )}

                    <button
                      onClick={resetGame}
                      className="bg-zinc-700 hover:bg-zinc-600 transition px-5 py-3 rounded-2xl font-semibold"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-800 rounded-2xl p-4 text-lg">
                  {message}
                </div>

                {winner && (
                  <div className="bg-green-600/20 border border-green-500 rounded-2xl p-6 text-center">
                    <div className="text-2xl font-bold">
                      {winner.name} wins!
                    </div>
                    <div className="text-zinc-300 mt-2">
                      Final Score: {winner.score}
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-5">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className={`rounded-3xl p-5 border ${
                        player.alive
                          ? "bg-zinc-800 border-zinc-700"
                          : "bg-red-950/40 border-red-800 opacity-70"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <div className="text-2xl font-bold">
                            {player.name}
                          </div>
                          <div className="text-zinc-400">
                            Score: {player.score}
                          </div>
                        </div>

                        <div
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            player.alive ? "bg-green-600" : "bg-red-700"
                          }`}
                        >
                          {player.alive ? "Alive" : "Hunted"}
                        </div>
                      </div>

                      {player.alive && (
                        <div className="grid grid-cols-2 gap-3">
                          {animals.map((animal) => {
                            const selected = player.selected === animal.id;

                            return (
                              <button
                                key={animal.id}
                                onClick={() =>
                                  selectAnimal(player.id, animal.id)
                                }
                                className={`rounded-2xl p-3 text-left transition border ${animal.color} ${
                                  selected
                                    ? "border-white scale-105"
                                    : "border-transparent opacity-80 hover:opacity-100"
                                }`}
                              >
                                <div className="font-bold text-lg">
                                  <>
                                    <img
                                      src={animal.image}
                                      alt={animal.name}
                                      className="w-full h-120px object-cover"
                                    />

                                    <div className="font-bold text-lg">
                                      {animal.name}
                                    </div>

                                    <div className="text-xs opacity-90 mt-1">
                                      {animal.description}
                                    </div>

                                    {revealed && (
                                      <div className="mt-2 text-xs">
                                        Hunts: {animal.hunts.length || "Nobody"}
                                      </div>
                                    )}
                                  </>
                                </div>

                                {revealed && (
                                  <div className="mt-2 text-xs">
                                    Hunts: {animal.hunts.length || "Nobody"}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5 h-fit">
                <h2 className="text-2xl font-bold">Animal Guide</h2>

                {animals.map((animal) => (
                  <div
                    key={animal.id}
                    className={`rounded-2xl p-4 ${animal.color}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xl font-bold">{animal.name}</div>

                      <div className="bg-black/30 px-3 py-1 rounded-full text-sm">
                        Power {animal.power}
                      </div>
                    </div>

                    <div className="mt-2 text-sm opacity-90">
                      {animal.description}
                    </div>

                    <div className="mt-3 text-sm font-semibold">Hunts:</div>

                    <div className="flex flex-wrap gap-2 mt-2">
                      {animal.hunts.length > 0 ? (
                        animal.hunts.map((hunt) => (
                          <div
                            key={hunt}
                            className="bg-black/30 px-2 py-1 rounded-lg text-xs"
                          >
                            {getAnimal(hunt).name}
                          </div>
                        ))
                      ) : (
                        <div className="bg-black/30 px-2 py-1 rounded-lg text-xs">
                          No prey
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
