import React from "react";
import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  getDoc,
  runTransaction,
  deleteDoc,
  deleteField,
} from "firebase/firestore";
import { db } from "./firebase";

const HEARTBEAT_MS = 5000;
const STALE_MS = 15000;

const animals = [
  {
    id: "bear",
    name: "Bär",
    emoji: "🐻",
    image: "/cards/baer.png",
    power: 5,
    hunts: ["wolf", "lynx"],
    color: "from-amber-600 to-amber-800",
    ring: "ring-amber-300",
    description: "Stark und furchtlos auf der Jagd",
  },
  {
    id: "wolf",
    name: "Wolf",
    emoji: "🐺",
    image: "/cards/wolf.png",
    power: 4,
    hunts: ["lynx", "owl"],
    color: "from-zinc-500 to-zinc-700",
    ring: "ring-zinc-200",
    description: "Schneller Rudeljäger",
  },
  {
    id: "lynx",
    name: "Luchs",
    emoji: "🐆",
    image: "/cards/luchs.png",
    power: 3,
    hunts: ["owl", "mouse"],
    color: "from-orange-500 to-orange-700",
    ring: "ring-orange-200",
    description: "Leiser Waldbewohner",
  },
  {
    id: "owl",
    name: "Eule",
    emoji: "🦉",
    image: "/cards/eule.png",
    power: 2,
    hunts: ["mouse"],
    color: "from-purple-600 to-purple-800",
    ring: "ring-purple-200",
    description: "Jäger der Nacht",
  },
  {
    id: "mouse",
    name: "Maus",
    emoji: "🐭",
    image: "/cards/maus.png",
    power: 1,
    hunts: [],
    color: "from-emerald-500 to-emerald-700",
    ring: "ring-emerald-200",
    description: "Kleiner Überlebenskünstler",
  },
];

function getAnimal(id) {
  return animals.find((a) => a.id === id);
}

function formatHunts(animal) {
  if (!animal.hunts.length) return "Niemanden";
  return animal.hunts.map((h) => getAnimal(h)?.name ?? h).join(", ");
}

function AnimalCardInfo({ animal, compact = false }) {
  return (
    <div className={compact ? "min-w-0 flex-1" : ""}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold">{animal.name}</span>
        <span className="shrink-0 rounded-full bg-black/30 px-2 py-0.5 text-xs">
          Stärke {animal.power}
        </span>
      </div>
      {!compact && (
        <p className="mt-1 text-xs opacity-90">{animal.description}</p>
      )}
      <p className={`text-xs opacity-90 ${compact ? "mt-0.5" : "mt-1"}`}>
        <span className="font-semibold">Jagt:</span> {formatHunts(animal)}
      </p>
    </div>
  );
}

function computeReveal(players, selections) {
  const updatedPlayers = players.map((p) => ({ ...p }));
  const eliminated = [];

  updatedPlayers.forEach((hunter) => {
    if (!hunter.alive) return;

    const hunterAnimal = getAnimal(selections[hunter.id]);
    if (!hunterAnimal) return;

    updatedPlayers.forEach((target) => {
      if (hunter.id === target.id || !target.alive) return;

      const targetAnimal = getAnimal(selections[target.id]);
      if (!targetAnimal) return;

      if (hunterAnimal.hunts.includes(targetAnimal.id)) {
        if (!eliminated.includes(target.id)) {
          eliminated.push(target.id);
          hunter.score += 1;
        }
      }
    });
  });

  updatedPlayers.forEach((player) => {
    if (eliminated.includes(player.id)) player.alive = false;
  });

  const survivors = updatedPlayers.filter((p) => p.alive);
  let winnerId = null;
  let message;

  if (survivors.length <= 1) {
    const w = survivors[0] || updatedPlayers[0];
    winnerId = w ? w.id : null;
    message = `${w?.name || "Niemand"} gewinnt die Jagd!`;
  } else {
    message =
      eliminated.length > 0
        ? `${eliminated.length} Spieler wurden in dieser Runde gejagt.`
        : "In dieser Runde wurde niemand gejagt.";
  }

  return { updatedPlayers, eliminated, winnerId, message };
}

function AnimalArt({ animal, className }) {
  const [broken, setBroken] = React.useState(false);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
    >
      {!broken ? (
        <img
          src={animal.image}
          alt={animal.name}
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-black/30 text-sm font-semibold text-white/80">
          {animal.name}
        </div>
      )}
    </div>
  );
}

function RulesOverlay({ onClose }) {
  const wolf = getAnimal("wolf");
  const lynx = getAnimal("lynx");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-zinc-300 transition hover:bg-white/20 hover:text-white"
        >
          ×
        </button>

        <h2 className="mb-5 pr-8 text-2xl font-black">Spielregeln</h2>

        <div className="space-y-5 text-sm leading-relaxed text-zinc-300">
          <section>
            <h3 className="mb-1 font-bold text-white">Ziel</h3>
            <p>
              Sei der letzte Überlebende und sammle Punkte, indem du andere
              Spieler mit deinem Tier jagst.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-bold text-white">Ablauf pro Runde</h3>
            <ol className="list-inside list-decimal space-y-1">
              <li>Jeder wählt heimlich ein Tier aus seinen Karten.</li>
              <li>
                Du kannst deine Wahl jederzeit ändern oder abwählen, solange der
                Gastgeber die Jagd noch nicht aufgedeckt hat.
              </li>
              <li>
                Der Gastgeber deckt auf, wenn alle lebenden Spieler bereit sind.
              </li>
              <li>
                Jagt dein Tier ein anderes Tier, scheidet der gejagte Spieler
                aus – du bekommst einen Punkt.
              </li>
              <li>
                In der nächsten Runde wählt ihr erneut. Bereits gespielte Karten
                sind erst wieder verfügbar, wenn du alle fünf einmal gespielt
                hast.
              </li>
            </ol>
          </section>

          <section>
            <h3 className="mb-2 font-bold text-white">Beispiel</h3>
            <div className="grid grid-cols-2 gap-3">
              {[wolf, lynx].map((animal) => (
                <div
                  key={animal.id}
                  className={`rounded-2xl bg-gradient-to-br ${animal.color} p-2`}
                >
                  <AnimalArt
                    animal={animal}
                    className="h-20 w-full rounded-xl bg-black/20"
                  />
                  <div className="mt-2">
                    <AnimalCardInfo animal={animal} compact />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 rounded-2xl bg-white/5 px-4 py-3 text-xs sm:text-sm">
              Spieler A wählt den{" "}
              <span className="font-semibold text-white">Wolf</span>, Spieler B
              den <span className="font-semibold text-white">Luchs</span>. Der
              Wolf jagt den Luchs → B scheidet aus, A bekommt 1 Punkt.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-bold text-white">Gastgeber</h3>
            <p>
              Der Gastgeber startet das Spiel, deckt die Jagd auf und startet
              die nächste Runde.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function SchnitzeljagdInspiredGame() {
  const [players, setPlayers] = React.useState([]);
  const [round, setRound] = React.useState(1);
  const [revealed, setRevealed] = React.useState(false);
  const [gameStarted, setGameStarted] = React.useState(false);
  const [selections, setSelections] = React.useState({});
  const [playedCards, setPlayedCards] = React.useState({});
  const [winnerId, setWinnerId] = React.useState(null);
  const [message, setMessage] = React.useState("");
  const [hostId, setHostId] = React.useState(null);

  const [roomId, setRoomId] = React.useState("");
  const [playerName, setPlayerName] = React.useState("");
  const [myPlayerId, setMyPlayerId] = React.useState(null);
  const [connected, setConnected] = React.useState(false);
  const [isHost, setIsHost] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [showRules, setShowRules] = React.useState(false);

  const unsubRef = React.useRef(null);
  const heartbeatRef = React.useRef(null);
  const stateRef = React.useRef({});

  React.useEffect(() => {
    stateRef.current = { roomId, myPlayerId, players, hostId };
  });

  function stopHeartbeat() {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }

  function startHeartbeat(roomCode, myId) {
    stopHeartbeat();
    heartbeatRef.current = setInterval(() => {
      updateDoc(doc(db, "rooms", roomCode), {
        [`presence.${myId}`]: Date.now(),
      }).catch(() => {});
    }, HEARTBEAT_MS);
  }

  function removeSelfBeacon() {
    const { roomId: code, myPlayerId: myId, players: ps, hostId: host } =
      stateRef.current;
    if (!code || !myId) return;
    const remaining = (ps || []).filter((p) => p.id !== myId);
    const roomRef = doc(db, "rooms", code);
    if (remaining.length === 0) {
      deleteDoc(roomRef).catch(() => {});
      return;
    }
    const updates = {
      players: remaining,
      [`presence.${myId}`]: deleteField(),
      [`selections.${myId}`]: deleteField(),
      [`playedCards.${myId}`]: deleteField(),
    };
    if (host === myId) updates.hostId = remaining[0].id;
    updateDoc(roomRef, updates).catch(() => {});
  }

  React.useEffect(() => {
    const onPageHide = () => removeSelfBeacon();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      if (unsubRef.current) unsubRef.current();
      stopHeartbeat();
    };
  }, []);

  async function maybeReap(roomCode, myId, data) {
    const playersArr = data.players || [];
    if (playersArr.length === 0) return;

    const presence = data.presence || {};
    const now = Date.now();

    const sortedIds = playersArr.map((p) => p.id).sort();
    if (sortedIds[0] !== myId) return;

    const hasStale = playersArr.some(
      (p) => now - (presence[p.id] ?? 0) > STALE_MS,
    );
    if (!hasStale) return;

    const roomRef = doc(db, "rooms", roomCode);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) return;

        const d = snap.data();
        const cur = d.players || [];
        const curPresence = d.presence || {};
        const tnow = Date.now();

        const remaining = cur.filter(
          (p) => tnow - (curPresence[p.id] ?? 0) <= STALE_MS,
        );
        const removed = cur.filter(
          (p) => !remaining.some((r) => r.id === p.id),
        );
        if (removed.length === 0) return;

        if (remaining.length === 0) {
          tx.delete(roomRef);
          return;
        }

        const updates = { players: remaining };
        removed.forEach((p) => {
          updates[`presence.${p.id}`] = deleteField();
          updates[`selections.${p.id}`] = deleteField();
          updates[`playedCards.${p.id}`] = deleteField();
        });
        if (removed.some((p) => p.id === d.hostId)) {
          updates.hostId = remaining[0].id;
        }
        tx.update(roomRef, updates);
      });
    } catch {
      // ignore transient transaction failures; next snapshot retries
    }
  }

  function subscribe(id, myId) {
    if (unsubRef.current) unsubRef.current();

    unsubRef.current = onSnapshot(doc(db, "rooms", id), (snapshot) => {
      const data = snapshot.data();
      if (!data) return;

      setPlayers(data.players || []);
      setRound(data.round || 1);
      setRevealed(!!data.revealed);
      setGameStarted(!!data.started);
      setSelections(data.selections || {});
      setPlayedCards(data.playedCards || {});
      setWinnerId(data.winner || null);
      setMessage(data.message || "");
      setHostId(data.hostId || null);
      setIsHost(data.hostId === myId);

      maybeReap(id, myId, data);
    });
  }

  async function createRoom() {
    if (!playerName.trim()) {
      setNotice("Bitte gib zuerst deinen Namen ein.");
      return;
    }

    setBusy(true);
    try {
      const newRoomId = Math.random().toString(36).substring(2, 7);
      const myId = crypto.randomUUID();

      await setDoc(doc(db, "rooms", newRoomId), {
        players: [
          { id: myId, name: playerName.trim(), alive: true, score: 0 },
        ],
        selections: {},
        playedCards: { [myId]: [] },
        presence: { [myId]: Date.now() },
        revealed: false,
        round: 1,
        started: false,
        hostId: myId,
        winner: null,
        message: "Warte auf Mitspieler ...",
      });

      setMyPlayerId(myId);
      setRoomId(newRoomId);
      setIsHost(true);
      setConnected(true);
      setNotice("");
      subscribe(newRoomId, myId);
      startHeartbeat(newRoomId, myId);
    } catch (err) {
      setNotice("Raum konnte nicht erstellt werden. " + err.message);
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    if (!playerName.trim()) {
      setNotice("Bitte gib zuerst deinen Namen ein.");
      return;
    }

    const code = roomId.trim().toLowerCase();
    if (!code) {
      setNotice("Bitte gib einen Raumcode ein.");
      return;
    }

    setBusy(true);
    try {
      const roomRef = doc(db, "rooms", code);
      const roomSnap = await getDoc(roomRef);

      if (!roomSnap.exists()) {
        setNotice("Raum nicht gefunden.");
        return;
      }

      const data = roomSnap.data();
      const myId = crypto.randomUUID();

      const updatedPlayers = [
        ...(data.players || []),
        { id: myId, name: playerName.trim(), alive: true, score: 0 },
      ];

      await updateDoc(roomRef, {
        players: updatedPlayers,
        [`playedCards.${myId}`]: [],
        [`presence.${myId}`]: Date.now(),
      });

      setMyPlayerId(myId);
      setRoomId(code);
      setIsHost(data.hostId === myId);
      setConnected(true);
      setNotice("");
      subscribe(code, myId);
      startHeartbeat(code, myId);
    } catch (err) {
      setNotice("Beitritt fehlgeschlagen. " + err.message);
    } finally {
      setBusy(false);
    }
  }

  async function leaveRoom() {
    const code = roomId;
    const myId = myPlayerId;

    stopHeartbeat();
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    setConnected(false);
    setIsHost(false);
    setMyPlayerId(null);
    setRoomId("");
    setPlayers([]);
    setSelections({});
    setPlayedCards({});
    setWinnerId(null);
    setMessage("");
    setGameStarted(false);
    setRevealed(false);
    setRound(1);
    setNotice("");

    if (!code || !myId) return;
    try {
      const roomRef = doc(db, "rooms", code);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) return;

        const d = snap.data();
        const remaining = (d.players || []).filter((p) => p.id !== myId);

        if (remaining.length === 0) {
          tx.delete(roomRef);
          return;
        }

        const updates = {
          players: remaining,
          [`presence.${myId}`]: deleteField(),
          [`selections.${myId}`]: deleteField(),
          [`playedCards.${myId}`]: deleteField(),
        };
        if (d.hostId === myId) updates.hostId = remaining[0].id;
        tx.update(roomRef, updates);
      });
    } catch {
      // ignore; heartbeat reaper will clean up stale entry
    }
  }

  async function startGame() {
    if (!roomId) return;
    if (players.length < 2) {
      setNotice("Mindestens 2 Spieler werden für die Jagd gebraucht.");
      return;
    }
    setNotice("");
    await updateDoc(doc(db, "rooms", roomId), {
      started: true,
      message: "Wählt euer Tier – geheim!",
    });
  }

  async function selectAnimal(animalId) {
    if (revealed || !roomId || !myPlayerId) return;

    if (selections[myPlayerId] === animalId) {
      setNotice("");
      await updateDoc(doc(db, "rooms", roomId), {
        [`selections.${myPlayerId}`]: deleteField(),
      });
      return;
    }

    const myPlayed = playedCards[myPlayerId] || [];
    if (myPlayed.includes(animalId)) {
      setNotice("Diese Karte hast du in diesem Spiel schon gespielt.");
      return;
    }
    setNotice("");

    await updateDoc(doc(db, "rooms", roomId), {
      [`selections.${myPlayerId}`]: animalId,
    });
  }

  function everyoneSelected() {
    const alive = players.filter((p) => p.alive);
    return alive.length > 0 && alive.every((p) => selections[p.id]);
  }

  async function revealRound() {
    if (!roomId || !myPlayerId) return;

    if (!isHost) {
      setNotice("Nur der Gastgeber kann das.");
      return;
    }

    if (!everyoneSelected()) {
      setNotice("Alle lebenden Spieler müssen erst ein Tier wählen.");
      return;
    }
    setNotice("");

    const roomRef = doc(db, "rooms", roomId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      const data = snap.data();
      if (!data || data.revealed || data.hostId !== myPlayerId) return;

      const sel = data.selections || {};
      const aliveNotSelected = (data.players || []).filter(
        (p) => p.alive && !sel[p.id],
      );
      if (aliveNotSelected.length > 0) return;

      const result = computeReveal(data.players, sel);

      const played = { ...(data.playedCards || {}) };
      (data.players || []).forEach((p) => {
        const choice = sel[p.id];
        if (!choice) return;
        const current = played[p.id] || [];
        const updated = current.includes(choice)
          ? current
          : [...current, choice];
        played[p.id] = updated.length >= animals.length ? [] : updated;
      });

      tx.update(roomRef, {
        players: result.updatedPlayers,
        revealed: true,
        winner: result.winnerId,
        message: result.message,
        playedCards: played,
      });
    });
  }

  async function nextRound() {
    if (!roomId) return;
    if (!isHost) {
      setNotice("Nur der Gastgeber kann das.");
      return;
    }
    setNotice("");
    await updateDoc(doc(db, "rooms", roomId), {
      selections: {},
      revealed: false,
      round: (round || 1) + 1,
      message: "Wählt euer nächstes Tier.",
    });
  }

  async function resetGame() {
    if (!roomId) return;
    if (!isHost) {
      setNotice("Nur der Gastgeber kann das.");
      return;
    }
    setNotice("");
    const resetPlayers = players.map((p) => ({
      ...p,
      alive: true,
      score: 0,
    }));
    await updateDoc(doc(db, "rooms", roomId), {
      players: resetPlayers,
      selections: {},
      playedCards: {},
      revealed: false,
      round: 1,
      started: false,
      winner: null,
      message: "Neue Runde – wartet in der Lobby.",
    });
  }

  function copyRoomCode() {
    if (navigator.clipboard && roomId) {
      navigator.clipboard.writeText(roomId);
      setNotice("Raumcode kopiert!");
    }
  }

  const myPlayer = players.find((p) => p.id === myPlayerId);
  const mySelection = selections[myPlayerId];
  const winner = winnerId ? players.find((p) => p.id === winnerId) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-zinc-950 to-emerald-950 text-white">
      <button
        type="button"
        onClick={() => setShowRules(true)}
        className="fixed left-4 top-4 z-40 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-200 backdrop-blur transition hover:bg-white/15 hover:text-white"
      >
        Spielregeln
      </button>

      {showRules && <RulesOverlay onClose={() => setShowRules(false)} />}

      <div
        className={`mx-auto max-w-[1500px] px-4 sm:px-8 ${
          connected && gameStarted ? "py-4 sm:py-5" : "py-6 sm:py-10"
        }`}
      >
        <header className={`${connected && gameStarted ? "mb-4" : "mb-8"} text-center`}>
          <h1
            className={`bg-gradient-to-r from-amber-300 via-orange-400 to-emerald-300 bg-clip-text font-black tracking-tight text-transparent drop-shadow-sm ${
              connected && gameStarted ? "text-3xl sm:text-5xl" : "text-4xl sm:text-6xl"
            }`}
          >
            Schnitzeljagd
          </h1>
          {!gameStarted && (
            <p className="mt-2 text-base text-zinc-300 sm:text-lg">
              Online-Multiplayer • Bluffen & Jagen
            </p>
          )}
        </header>

        {notice && (
          <div className="mx-auto mb-6 max-w-2xl rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-center text-sm font-medium text-amber-100">
            {notice}
          </div>
        )}

        {!connected && (
          <div className="mx-auto max-w-md space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur sm:p-8">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-zinc-300">
                Dein Name
              </label>
              <input
                placeholder="z.B. Alex"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-zinc-900/70 px-4 py-3 text-lg outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/30"
              />
            </div>

            <button
              onClick={createRoom}
              disabled={busy}
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-4 text-lg font-bold shadow-lg shadow-emerald-900/40 transition hover:scale-[1.02] hover:shadow-emerald-800/50 active:scale-95 disabled:opacity-50"
            >
              Neuen Raum erstellen
            </button>

            <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-zinc-500">
              <span className="h-px flex-1 bg-white/10" />
              oder beitreten
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="space-y-3">
              <input
                placeholder="Raumcode"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-zinc-900/70 px-4 py-3 text-center text-lg font-mono tracking-[0.3em] outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/30"
              />
              <button
                onClick={joinRoom}
                disabled={busy}
                className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-4 text-lg font-bold shadow-lg shadow-blue-900/40 transition hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                Raum beitreten
              </button>
            </div>
          </div>
        )}

        {connected && !gameStarted && (
          <div className="mx-auto max-w-xl space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center shadow-2xl backdrop-blur">
              <div className="text-sm uppercase tracking-widest text-zinc-400">
                Raumcode
              </div>
              <button
                onClick={copyRoomCode}
                title="Kopieren"
                className="mt-2 inline-flex flex-col items-center gap-1 rounded-2xl bg-zinc-900/70 px-6 py-3 font-mono text-3xl font-black tracking-[0.4em] text-emerald-300 transition hover:bg-zinc-800/70 sm:text-4xl"
              >
                {roomId.toUpperCase()}
                <span className="text-xs font-sans font-semibold tracking-normal text-zinc-400">
                  Kopieren
                </span>
              </button>
              <p className="mt-3 text-sm text-zinc-400">
                Teile den Code mit deinen Freunden, damit sie beitreten können.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
              <h2 className="mb-4 text-xl font-bold">
                Spieler ({players.length})
              </h2>
              <div className="space-y-2">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-2xl bg-zinc-900/60 px-4 py-3"
                  >
                    <span className="flex items-center gap-3 font-semibold">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-sky-600 text-sm font-black">
                        {p.name.slice(0, 2).toUpperCase()}
                      </span>
                      {p.name}
                      {p.id === myPlayerId && (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                          du
                        </span>
                      )}
                    </span>
                    {p.id === hostId && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                        Gastgeber
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {isHost ? (
                <button
                  onClick={startGame}
                  className="mt-5 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 text-lg font-bold shadow-lg shadow-orange-900/40 transition hover:scale-[1.02] active:scale-95"
                >
                  Spiel starten
                </button>
              ) : (
                <p className="mt-5 text-center text-sm text-zinc-400">
                  Warte, bis der Gastgeber das Spiel startet …
                </p>
              )}

              <button
                onClick={leaveRoom}
                className="mt-3 w-full rounded-2xl bg-zinc-800/70 px-6 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-700/70"
              >
                Raum verlassen
              </button>
            </div>
          </div>
        )}

        {connected && gameStarted && (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-end gap-2">
              {isHost && revealed && !winner && (
                <button
                  onClick={nextRound}
                  className="rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-bold shadow-lg shadow-blue-900/40 transition hover:scale-[1.03] active:scale-95"
                >
                  Nächste Runde
                </button>
              )}

              {isHost && (
                <button
                  onClick={resetGame}
                  className="rounded-2xl bg-zinc-800/70 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700/70"
                >
                  Zurücksetzen
                </button>
              )}

              <button
                onClick={leaveRoom}
                className="rounded-2xl bg-zinc-800/70 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700/70"
              >
                Verlassen
              </button>
            </div>

            {revealed && message && !winner && (
              <div className="rounded-2xl bg-zinc-900/60 px-5 py-4 text-center text-lg font-medium">
                {message}
              </div>
            )}

            {winner && (
              <div className="rounded-3xl border border-emerald-400/40 bg-emerald-500/15 p-8 text-center shadow-2xl">
                <div className="mt-2 text-3xl font-black">
                  {winner.name} gewinnt!
                </div>
                <div className="mt-1 text-zinc-300">
                  Endpunktzahl: {winner.score}
                </div>
              </div>
            )}

            {myPlayer && myPlayer.alive && !revealed && !winner && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <h2 className="text-xl font-bold">Deine geheime Wahl</h2>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        Tippe eine Karte erneut an, um sie abzuwählen.
                      </p>
                    </div>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-300">
                      Runde {round}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {isHost ? (
                      <button
                        onClick={revealRound}
                        className="rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 px-5 py-3 font-bold shadow-lg shadow-rose-900/40 transition hover:scale-[1.03] active:scale-95"
                      >
                        Jagd aufdecken
                      </button>
                    ) : (
                      <span className="text-sm text-zinc-400">
                        Warte, bis der Gastgeber die Jagd aufdeckt …
                      </span>
                    )}
                    <span className="rounded-full bg-zinc-900/70 px-3 py-1 text-xs font-semibold text-zinc-300">
                      Noch {animals.length - (playedCards[myPlayerId] || []).length}{" "}
                      Karten
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5 xl:gap-4">
                  {animals.map((animal) => {
                    const selected = mySelection === animal.id;
                    const isPlayed = (playedCards[myPlayerId] || []).includes(
                      animal.id,
                    );
                    return (
                      <button
                        key={animal.id}
                        onClick={() => selectAnimal(animal.id)}
                        disabled={isPlayed}
                        aria-disabled={isPlayed}
                        className={`group min-w-0 rounded-3xl bg-gradient-to-br ${animal.color} p-2 text-left shadow-lg transition sm:p-3 ${
                          isPlayed
                            ? "cursor-not-allowed opacity-40 grayscale"
                            : "hover:scale-[1.04] active:scale-95"
                        } ${
                          selected
                            ? `ring-4 ${animal.ring} scale-[1.04]`
                            : isPlayed
                              ? ""
                              : "opacity-90 hover:opacity-100"
                        }`}
                      >
                        <AnimalArt
                          animal={animal}
                          className="h-48 w-full rounded-2xl bg-black/20 sm:h-56 xl:h-64"
                        />
                        <div className="mt-2">
                          <AnimalCardInfo animal={animal} />
                        </div>
                        {isPlayed ? (
                          <div className="mt-2 rounded-full bg-black/40 px-2 py-1 text-center text-xs font-bold">
                            Bereits gespielt
                          </div>
                        ) : (
                          selected && (
                            <div className="mt-2 rounded-full bg-white/20 px-2 py-1 text-center text-xs font-bold">
                              ✓ Abwählen
                            </div>
                          )
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {myPlayer && !myPlayer.alive && (
              <div className="rounded-3xl border border-red-500/40 bg-red-950/40 p-6 text-center text-lg font-semibold text-red-200">
                Du wurdest gejagt – du schaust beim Rest der Jagd zu.
              </div>
            )}

            <div>
              <h2 className="mb-3 text-xl font-bold">Spieler</h2>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:gap-4">
                {players.map((player) => {
                  const choice = getAnimal(selections[player.id]);
                  const hasChosen = !!selections[player.id];
                  const isMe = player.id === myPlayerId;
                  return (
                    <div
                      key={player.id}
                      className={`min-w-0 rounded-3xl border p-3 shadow-xl transition xl:p-4 ${
                        player.alive
                          ? "border-white/10 bg-white/5"
                          : "border-red-800/50 bg-red-950/30 opacity-70"
                      } ${isMe ? "ring-2 ring-emerald-400/50" : ""}`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="truncate text-base font-bold xl:text-lg">
                            {player.name}
                          </span>
                          {isMe && (
                            <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                              du
                            </span>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold xl:px-3 ${
                            player.alive
                              ? "bg-emerald-500/80"
                              : "bg-red-700/80"
                          }`}
                        >
                          {player.alive ? "Lebt" : "Gejagt"}
                        </span>
                      </div>

                      <div className="mb-3 text-sm text-zinc-400">
                        Punkte: <span className="text-white">{player.score}</span>
                      </div>

                      {revealed && choice ? (
                        <div
                          className={`rounded-2xl bg-gradient-to-br ${choice.color} p-2 xl:p-3`}
                        >
                          <AnimalArt
                            animal={choice}
                            className="h-24 w-full rounded-xl bg-black/20"
                          />
                          <div className="mt-2">
                            <AnimalCardInfo animal={choice} compact />
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-zinc-900/60 px-3 py-3 text-center text-sm">
                          {player.alive ? (
                            hasChosen ? (
                              <span className="text-emerald-300">
                                ✓ Bereit
                              </span>
                            ) : (
                              <span className="text-zinc-400">
                                Wählt ...
                              </span>
                            )
                          ) : (
                            <span className="text-red-300">Ausgeschieden</span>
                          )}
                        </div>
                      )}

                      {(playedCards[player.id] || []).length > 0 && (
                        <div className="mt-3 border-t border-white/10 pt-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                            Gespielte Karten
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(playedCards[player.id] || []).map((id) => {
                              const animal = getAnimal(id);
                              return (
                                <span
                                  key={id}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200"
                                >
                                  {animal?.emoji && (
                                    <span
                                      aria-hidden="true"
                                      className="text-base leading-none"
                                    >
                                      {animal.emoji}
                                    </span>
                                  )}
                                  {animal?.name ?? id}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
