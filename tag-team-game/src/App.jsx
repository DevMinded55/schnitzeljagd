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
import {
  animals,
  CALL_ORDER,
  getAnimal,
  getValidPrey,
  formatValidPrey,
  isCardOnTable,
  WIN_FOOD,
} from "./game/animals.js";
import {
  processAnimalCall,
  resolveHuntPick,
  startCallingPhase,
  startNextDurchgang,
  initialRoomPlayer,
  emptyTableState,
} from "./game/roundEngine.js";
import { buildRevealDisplay, badgeClassName } from "./game/revealDisplay.js";

const HEARTBEAT_MS = 5000;

const REVEAL_PHASES = new Set(["calling", "huntPick", "durchgangScore"]);
const STALE_MS = 15000;

const ROOM_STATE_KEYS = [
  "players",
  "phase",
  "huntIndex",
  "durchgangIndex",
  "callIndex",
  "selections",
  "tableOpen",
  "durchgangPlays",
  "currentHunterId",
  "callingAnimalId",
  "gameWinnerId",
  "lastCall",
  "lastAwards",
  "message",
  "started",
  "hostId",
];

function roomPatchFromEngine(result) {
  const patch = {};
  ROOM_STATE_KEYS.forEach((key) => {
    if (result[key] !== undefined) patch[key] = result[key];
  });
  return patch;
}

function AnimalCardInfo({ animal, compact = false }) {
  return (
    <div className={compact ? "min-w-0 flex-1" : ""}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold">{animal.name}</span>
        <span className="shrink-0 rounded-full bg-black/30 px-2 py-0.5 text-xs">
          Wert {animal.value}
        </span>
      </div>
      {!compact && (
        <p className="mt-1 text-xs opacity-90">{animal.description}</p>
      )}
      <p className={`text-xs opacity-90 ${compact ? "mt-0.5" : "mt-1"}`}>
        <span className="font-semibold">Beute:</span> {formatValidPrey(animal.id)}
      </p>
    </div>
  );
}

function AnimalArt({ animal, className, fit = "cover" }) {
  const [broken, setBroken] = React.useState(false);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!broken ? (
        <img
          src={animal.image}
          alt={animal.name}
          onError={() => setBroken(true)}
          className={`h-full w-full ${
            fit === "contain" ? "object-contain" : "object-cover"
          }`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-black/30 text-sm font-semibold text-white/80">
          {animal.name}
        </div>
      )}
    </div>
  );
}

const navBtnClass =
  "rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-200 backdrop-blur transition hover:bg-white/15 hover:text-white";

function RevealStage({ display }) {
  if (!display) return null;

  const { calledAnimal, headline, subtitle, cards } = display;
  const cardFlipMs = 520;
  const cardStaggerMs = 140;

  return (
    <section
      aria-live="polite"
      aria-label="Aufgedeckte Karten"
      className="reveal-animate-stage mx-auto w-full max-w-2xl [animation:revealStageIn_0.45s_cubic-bezier(0.22,1,0.36,1)_both]"
    >
      <div className="flex flex-col items-center justify-center rounded-3xl border border-white/15 bg-zinc-900/80 px-4 py-6 shadow-2xl backdrop-blur [animation:revealGlowPulse_1.2s_ease-in-out_0.2s_both] sm:px-8 sm:py-8">
        <h2 className="reveal-animate-headline text-center text-lg font-bold text-white [animation:revealHeadlineIn_0.4s_ease-out_0.08s_both] sm:text-xl">
          {headline}
        </h2>
        {subtitle && (
          <p className="reveal-animate-headline mt-2 max-w-md text-center text-sm text-zinc-300 [animation:revealHeadlineIn_0.4s_ease-out_0.16s_both]">
            {subtitle}
          </p>
        )}

        {cards.length > 0 ? (
          <ul className="mt-6 flex w-full flex-wrap items-start justify-center gap-4 sm:gap-6">
            {cards.map((entry, index) => {
              const cardDelay = 0.12 + index * (cardStaggerMs / 1000);
              const badgeDelay = cardDelay + cardFlipMs / 1000 + 0.05;
              return (
                <li
                  key={`${entry.playerId}-${entry.animal.id}-${entry.badge}`}
                  className="flex w-[min(100%,10.5rem)] flex-col items-center sm:w-44"
                  style={{ perspective: "900px" }}
                >
                  <span
                    className="reveal-animate-headline mb-2 max-w-full truncate text-center text-sm font-semibold text-zinc-100"
                    style={{
                      animation: `revealHeadlineIn 0.35s ease-out ${cardDelay - 0.06}s both`,
                    }}
                  >
                    {entry.playerName}
                  </span>
                  <div
                    className={`reveal-animate-card w-full overflow-hidden rounded-2xl bg-gradient-to-br ${entry.animal.color} p-2 shadow-lg ring-1 ring-white/10 [animation:revealCardFlip_${cardFlipMs}ms_cubic-bezier(0.34,1.2,0.64,1)_both] [transform-style:preserve-3d] [backface-visibility:hidden]`}
                    style={{ animationDelay: `${cardDelay}s` }}
                  >
                    <AnimalArt
                      animal={entry.animal}
                      fit="contain"
                      className="mx-auto aspect-[5/7] w-full max-w-[11rem] rounded-xl bg-black/25"
                    />
                  </div>
                  {entry.badge && (
                    <span
                      className={`reveal-animate-badge mt-2 rounded-full px-3 py-1 text-xs font-bold ring-1 [animation:revealBadgePop_0.45s_cubic-bezier(0.34,1.4,0.64,1)_both] ${badgeClassName(entry.badge)}`}
                      style={{ animationDelay: `${badgeDelay}s` }}
                    >
                      {entry.badge}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          calledAnimal && (
            <div
              className={`reveal-animate-empty mt-6 w-36 overflow-hidden rounded-2xl bg-gradient-to-br p-2 sm:w-40 ${calledAnimal.color} [animation:revealCardFlip_0.55s_cubic-bezier(0.34,1.2,0.64,1)_0.2s_both] [transform-style:preserve-3d]`}
            >
              <AnimalArt
                animal={calledAnimal}
                fit="contain"
                className="aspect-[5/7] w-full rounded-xl bg-black/25"
              />
            </div>
          )
        )}
      </div>
    </section>
  );
}

function MobileSideNav({ open, onClose, onShowRules, onLeave, showLeave }) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Menü schließen"
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />
      <nav
        aria-label="Navigation"
        className="fixed right-0 top-0 z-50 flex h-full w-[min(280px,85vw)] flex-col gap-2 border-l border-white/10 bg-zinc-900/95 p-4 pt-5 shadow-2xl backdrop-blur md:hidden"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-lg font-bold">Menü</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-zinc-300 transition hover:bg-white/20 hover:text-white"
          >
            ×
          </button>
        </div>
        <button
          type="button"
          className={`${navBtnClass} w-full text-left`}
          onClick={() => {
            onShowRules();
            onClose();
          }}
        >
          Spielregeln
        </button>
        {showLeave && (
          <button
            type="button"
            className={`${navBtnClass} w-full text-left`}
            onClick={() => {
              onLeave();
              onClose();
            }}
          >
            Verlassen
          </button>
        )}
      </nav>
    </>
  );
}

function RulesOverlay({ onClose }) {
  const bear = getAnimal("bear");

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
              Sammle als Erster <span className="font-semibold text-white">5
              Futtermarker</span>. Du erhältst Futter am Ende jedes Durchgangs,
              wenn du überlebst.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-bold text-white">Durchgang & Jagd</h3>
            <ol className="list-inside list-decimal space-y-1">
              <li>Ein Durchgang hat 1–3 Jagden.</li>
              <li>
                Pro Jagd: alle wählen gleichzeitig verdeckt eine Karte (offen
                liegende Karten aus dem Durchgang sind gesperrt).
              </li>
              <li>
                Tiere werden aufgerufen: Bär → Wolf → Luchs → Eule → Maus.
              </li>
              <li>
                Gleiche Karte bei mehreren: keine Jagd, Karten bleiben offen.
              </li>
              <li>
                Einzelner Jäger benennt ein <span className="font-semibold text-white">schwächeres</span>{" "}
                Tier (höherer Kartenwert).
              </li>
            </ol>
          </section>

          <section>
            <h3 className="mb-2 font-bold text-white">Kartenwerte</h3>
            {bear && (
              <div
                className={`rounded-2xl bg-gradient-to-br ${bear.color} p-2`}
              >
                <AnimalArt
                  animal={bear}
                  fit="contain"
                  className="aspect-[5/7] w-full max-w-[140px] rounded-xl bg-black/20"
                />
                <div className="mt-2">
                  <AnimalCardInfo animal={bear} compact />
                </div>
              </div>
            )}
            <p className="mt-3 text-xs">
              Bär 1 … Maus 5. Der Bär kann alle höheren Werte als Beute wählen.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-bold text-white">Gastgeber</h3>
            <p>
              Startet das Spiel, führt den Tier-Aufruf durch und startet nach
              der Futterverteilung den nächsten Durchgang.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function SchnitzeljagdInspiredGame() {
  const [players, setPlayers] = React.useState([]);
  const [phase, setPhase] = React.useState("select");
  const [huntIndex, setHuntIndex] = React.useState(1);
  const [durchgangIndex, setDurchgangIndex] = React.useState(0);
  const [callIndex, setCallIndex] = React.useState(0);
  const [gameStarted, setGameStarted] = React.useState(false);
  const [selections, setSelections] = React.useState({});
  const [tableOpen, setTableOpen] = React.useState({});
  const [durchgangPlays, setDurchgangPlays] = React.useState({});
  const [currentHunterId, setCurrentHunterId] = React.useState(null);
  const [callingAnimalId, setCallingAnimalId] = React.useState(null);
  const [gameWinnerId, setGameWinnerId] = React.useState(null);
  const [lastCall, setLastCall] = React.useState(null);
  const [lastAwards, setLastAwards] = React.useState(null);
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
  const [showMobileNav, setShowMobileNav] = React.useState(false);

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
      [`tableOpen.${myId}`]: deleteField(),
      [`durchgangPlays.${myId}`]: deleteField(),
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
          updates[`tableOpen.${p.id}`] = deleteField();
          updates[`durchgangPlays.${p.id}`] = deleteField();
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
      setPhase(data.phase || "select");
      setHuntIndex(data.huntIndex || 1);
      setDurchgangIndex(data.durchgangIndex || 0);
      setCallIndex(data.callIndex ?? 0);
      setGameStarted(!!data.started);
      setSelections(data.selections || {});
      setTableOpen(data.tableOpen || {});
      setDurchgangPlays(data.durchgangPlays || {});
      setCurrentHunterId(data.currentHunterId || null);
      setCallingAnimalId(data.callingAnimalId || null);
      setGameWinnerId(data.gameWinnerId || null);
      setLastCall(data.lastCall || null);
      setLastAwards(data.lastAwards || null);
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

      const { tableOpen, durchgangPlays } = emptyTableState([myId]);

      await setDoc(doc(db, "rooms", newRoomId), {
        players: [initialRoomPlayer(myId, playerName.trim())],
        selections: {},
        tableOpen,
        durchgangPlays,
        presence: { [myId]: Date.now() },
        phase: "select",
        huntIndex: 1,
        durchgangIndex: 0,
        callIndex: 0,
        started: false,
        hostId: myId,
        gameWinnerId: null,
        currentHunterId: null,
        callingAnimalId: null,
        lastCall: null,
        lastAwards: null,
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

      if (data.started) {
        setNotice("In diesem Raum wurde bereits ein Spiel gestartet.");
        return;
      }

      const myId = crypto.randomUUID();

      const updatedPlayers = [
        ...(data.players || []),
        initialRoomPlayer(myId, playerName.trim()),
      ];

      await updateDoc(roomRef, {
        players: updatedPlayers,
        [`tableOpen.${myId}`]: [],
        [`durchgangPlays.${myId}`]: [],
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
    setTableOpen({});
    setDurchgangPlays({});
    setGameWinnerId(null);
    setMessage("");
    setGameStarted(false);
    setPhase("select");
    setHuntIndex(1);
    setDurchgangIndex(0);
    setCallIndex(0);
    setCurrentHunterId(null);
    setCallingAnimalId(null);
    setLastCall(null);
    setLastAwards(null);
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
          [`tableOpen.${myId}`]: deleteField(),
          [`durchgangPlays.${myId}`]: deleteField(),
        };
        if (d.hostId === myId) updates.hostId = remaining[0].id;
        tx.update(roomRef, updates);
      });
    } catch {
      // ignore; heartbeat reaper will clean up stale entry
    }
  }

  async function applyEngineUpdate(mutator) {
    if (!roomId || !myPlayerId) return;
    const roomRef = doc(db, "rooms", roomId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      const data = snap.data();
      if (!data || data.hostId !== myPlayerId) return;
      const next = mutator(data);
      if (!next || next.error) return;
      tx.update(roomRef, roomPatchFromEngine(next));
    });
  }

  async function startGame() {
    if (!roomId) return;
    if (players.length < 2) {
      setNotice("Mindestens 2 Spieler werden für die Jagd gebraucht.");
      return;
    }
    setNotice("");
    const ids = players.map((p) => p.id);
    const { tableOpen, durchgangPlays } = emptyTableState(ids);
    await updateDoc(doc(db, "rooms", roomId), {
      started: true,
      phase: "select",
      huntIndex: 1,
      durchgangIndex: 1,
      callIndex: 0,
      players: players.map((p) => ({ ...p, alive: true, food: 0 })),
      selections: {},
      tableOpen,
      durchgangPlays,
      gameWinnerId: null,
      currentHunterId: null,
      callingAnimalId: null,
      lastCall: null,
      lastAwards: null,
      message: "Durchgang 1 – wählt verdeckt eine Karte.",
    });
  }

  async function selectAnimal(animalId) {
    if (phase !== "select" || !roomId || !myPlayerId) return;
    const me = players.find((p) => p.id === myPlayerId);
    if (!me?.alive) return;

    if (selections[myPlayerId] === animalId) {
      setNotice("");
      await updateDoc(doc(db, "rooms", roomId), {
        [`selections.${myPlayerId}`]: deleteField(),
      });
      return;
    }

    if (isCardOnTable(tableOpen, myPlayerId, animalId)) {
      setNotice("Diese Karte liegt bereits offen in diesem Durchgang.");
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

  async function hostStartCalling() {
    if (!isHost) {
      setNotice("Nur der Gastgeber kann das.");
      return;
    }
    if (!everyoneSelected()) {
      setNotice("Alle aktiven Spieler müssen erst eine Karte wählen.");
      return;
    }
    setNotice("");
    await applyEngineUpdate((data) => startCallingPhase(data));
  }

  async function hostProcessCall() {
    if (!isHost) {
      setNotice("Nur der Gastgeber kann das.");
      return;
    }
    if (phase !== "calling") return;
    setNotice("");
    await applyEngineUpdate((data) => processAnimalCall(data));
  }

  async function pickPrey(preyAnimalId) {
    if (phase !== "huntPick" || !roomId || myPlayerId !== currentHunterId) return;
    setNotice("");
    const roomRef = doc(db, "rooms", roomId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      const data = snap.data();
      if (!data || data.phase !== "huntPick") return;
      if (data.currentHunterId !== myPlayerId) return;
      const next = resolveHuntPick(data, preyAnimalId);
      if (next.error) return;
      tx.update(roomRef, roomPatchFromEngine(next));
    });
  }

  async function hostNextDurchgang() {
    if (!isHost) {
      setNotice("Nur der Gastgeber kann das.");
      return;
    }
    if (phase !== "durchgangScore") return;
    setNotice("");
    await applyEngineUpdate((data) => startNextDurchgang(data));
  }

  async function resetGame() {
    if (!roomId) return;
    if (!isHost) {
      setNotice("Nur der Gastgeber kann das.");
      return;
    }
    setNotice("");
    const ids = players.map((p) => p.id);
    const { tableOpen, durchgangPlays } = emptyTableState(ids);
    await updateDoc(doc(db, "rooms", roomId), {
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        alive: true,
        food: 0,
      })),
      selections: {},
      tableOpen,
      durchgangPlays,
      phase: "select",
      huntIndex: 1,
      durchgangIndex: 0,
      callIndex: 0,
      started: false,
      gameWinnerId: null,
      currentHunterId: null,
      callingAnimalId: null,
      lastCall: null,
      lastAwards: null,
      message: "Neue Session – wartet in der Lobby.",
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
  const gameWinner = gameWinnerId
    ? players.find((p) => p.id === gameWinnerId)
    : null;
  const foodRanking = [...players].sort(
    (a, b) =>
      (b.food || 0) - (a.food || 0) || a.name.localeCompare(b.name, "de"),
  );
  const callingAnimal = CALL_ORDER[callIndex]
    ? getAnimal(CALL_ORDER[callIndex])
    : null;
  const hunterAnimal = callingAnimalId ? getAnimal(callingAnimalId) : null;
  const validPrey = callingAnimalId ? getValidPrey(callingAnimalId) : [];
  const canPickCards = phase === "select" && myPlayer?.alive && !gameWinnerId;
  const isHunter =
    phase === "huntPick" && myPlayerId === currentHunterId;

  const revealDisplay = React.useMemo(() => {
    if (!lastCall || phase === "select" || !REVEAL_PHASES.has(phase)) {
      return null;
    }
    return buildRevealDisplay(lastCall, players, selections);
  }, [lastCall, players, selections, phase]);

  const revealAnimationKey = React.useMemo(() => {
    if (!lastCall) return "";
    const ids = (lastCall.playerIds || lastCall.eatenIds || []).join(",");
    return `${lastCall.type}-${lastCall.animalId}-${lastCall.hunterId ?? ""}-${lastCall.preyId ?? ""}-${ids}`;
  }, [lastCall]);

  const hideListMiniCards = (revealDisplay?.cards?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-zinc-950 to-emerald-950 text-white">
      <div className="fixed inset-x-0 top-0 z-40 border-b border-white/5 bg-zinc-950/80 backdrop-blur md:hidden">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 px-3 py-2.5">
          <div className="justify-self-start">
            {connected && gameStarted && isHost && (
              <button type="button" onClick={resetGame} className={navBtnClass}>
                Zurücksetzen
              </button>
            )}
          </div>

          <div className="min-w-0 text-center">
            <h1 className="truncate bg-gradient-to-r from-amber-300 via-orange-400 to-emerald-300 bg-clip-text text-lg font-black tracking-tight text-transparent">
              Schnitzeljagd
            </h1>
            {!gameStarted && (
              <p className="mt-0.5 truncate text-[10px] text-zinc-400 sm:text-xs">
                Online-Multiplayer • Bluffen & Jagen
              </p>
            )}
          </div>

          <div className="justify-self-end">
            <button
              type="button"
              onClick={() => setShowMobileNav(true)}
              aria-label="Menü öffnen"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-zinc-200 transition hover:bg-white/15 hover:text-white"
            >
              <span className="flex flex-col gap-1">
                <span className="block h-0.5 w-5 rounded-full bg-current" />
                <span className="block h-0.5 w-5 rounded-full bg-current" />
                <span className="block h-0.5 w-5 rounded-full bg-current" />
              </span>
            </button>
          </div>
        </div>
      </div>

      <MobileSideNav
        open={showMobileNav}
        onClose={() => setShowMobileNav(false)}
        onShowRules={() => setShowRules(true)}
        onLeave={leaveRoom}
        showLeave={connected && gameStarted}
      />

      <button
        type="button"
        onClick={() => setShowRules(true)}
        className={`${navBtnClass} fixed left-4 top-4 z-40 hidden md:block`}
      >
        Spielregeln
      </button>

      {connected && gameStarted && (
        <div className="fixed right-4 top-4 z-40 hidden gap-2 md:flex">
          {isHost && (
            <button type="button" onClick={resetGame} className={navBtnClass}>
              Zurücksetzen
            </button>
          )}
          <button type="button" onClick={leaveRoom} className={navBtnClass}>
            Verlassen
          </button>
        </div>
      )}

      {showRules && <RulesOverlay onClose={() => setShowRules(false)} />}

      <div
        className={`mx-auto max-w-[1500px] px-4 sm:px-8 md:pt-0 ${
          connected && gameStarted
            ? "pt-14 pb-3 sm:pb-4 md:py-3 md:sm:py-4"
            : "pt-[4.5rem] pb-6 sm:pb-10 md:py-6 md:sm:py-10"
        }`}
      >
        <header
          className={`${connected && gameStarted ? "mb-4 md:mb-4" : "mb-8 md:mb-8"} hidden text-center md:block`}
        >
          <h1
            className={`bg-gradient-to-r from-amber-300 via-orange-400 to-emerald-300 bg-clip-text pb-1.5 font-black leading-normal tracking-tight text-transparent drop-shadow-sm sm:pb-2 ${
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
          <div className="space-y-3">
            {message && !revealDisplay && (
              <div className="rounded-2xl bg-zinc-900/60 px-5 py-4 text-center text-sm font-medium sm:text-lg">
                {message}
              </div>
            )}

            {revealDisplay && (
              <RevealStage
                key={revealAnimationKey}
                display={revealDisplay}
              />
            )}

            {isHost && phase === "select" && everyoneSelected() && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={hostStartCalling}
                  className="rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 px-5 py-3 text-sm font-bold shadow-lg shadow-rose-900/40 transition hover:scale-[1.03] active:scale-95"
                >
                  Aufruf starten (Jagd {huntIndex})
                </button>
              </div>
            )}

            {isHost && phase === "calling" && callingAnimal && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={hostProcessCall}
                  className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-3 text-sm font-bold shadow-lg shadow-orange-900/40 transition hover:scale-[1.03] active:scale-95"
                >
                  Aufdecken: {callingAnimal.name}
                </button>
              </div>
            )}

            {isHost && phase === "durchgangScore" && !gameWinnerId && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={hostNextDurchgang}
                  className="rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-3 text-sm font-bold shadow-lg shadow-blue-900/40 transition hover:scale-[1.03] active:scale-95"
                >
                  Nächster Durchgang
                </button>
              </div>
            )}

            {phase === "durchgangScore" && lastAwards?.length > 0 && (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm">
                <div className="mb-1 font-bold text-amber-100">Futter diese Runde</div>
                <ul className="space-y-0.5 text-zinc-300">
                  {lastAwards.map((a) => {
                    const p = players.find((x) => x.id === a.playerId);
                    return (
                      <li key={a.playerId}>
                        {p?.name}: {a.amount > 0 ? `+${a.amount}` : "0"} ({a.reason})
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {gameWinner && (
              <div className="rounded-3xl border border-emerald-400/40 bg-emerald-500/15 p-8 text-center shadow-2xl">
                <div className="text-3xl font-black">
                  {gameWinner.name} gewinnt!
                </div>
                <div className="mt-1 text-zinc-300">
                  {gameWinner.food} Futtermarker (Ziel: {WIN_FOOD})
                </div>
                <div className="mx-auto mt-6 max-w-md rounded-2xl bg-black/20 px-4 py-3 text-left">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Futtermarker
                  </div>
                  <ul className="space-y-1">
                    {foodRanking.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="font-bold text-emerald-200">
                          {p.food || 0}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {canPickCards && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-3 shadow-2xl backdrop-blur sm:p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <h2 className="text-xl font-bold">Deine geheime Wahl</h2>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        Tippe eine Karte erneut an, um sie abzuwählen.
                      </p>
                    </div>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-300">
                      Durchgang {durchgangIndex} · Jagd {huntIndex}
                    </span>
                  </div>
                  {!isHost && (
                    <span className="text-sm text-zinc-400">
                      Warte auf den Aufruf durch den Gastgeber …
                    </span>
                  )}
                </div>
                <div className="mx-auto grid w-full max-w-[1180px] grid-cols-2 gap-3 md:grid-cols-5 xl:gap-4">
                  {animals.map((animal) => {
                    const selected = mySelection === animal.id;
                    const onTable = isCardOnTable(
                      tableOpen,
                      myPlayerId,
                      animal.id,
                    );
                    return (
                      <button
                        key={animal.id}
                        type="button"
                        onClick={() => selectAnimal(animal.id)}
                        disabled={onTable}
                        className={`group flex w-full flex-col rounded-2xl bg-gradient-to-br ${animal.color} p-2 text-left shadow-lg transition ${
                          onTable
                            ? "cursor-not-allowed opacity-40 grayscale"
                            : "hover:opacity-100 active:scale-[0.98]"
                        } ${selected ? `ring-4 ${animal.ring}` : onTable ? "" : "opacity-90"}`}
                      >
                        <AnimalArt
                          animal={animal}
                          fit="contain"
                          className="aspect-[5/7] w-full rounded-lg"
                        />
                        <div className="mt-1.5 w-full rounded-lg bg-black/25 px-2 py-1.5">
                          <AnimalCardInfo animal={animal} compact />
                        </div>
                        <div className="mt-1.5 flex h-6 items-center">
                          {onTable ? (
                            <div className="w-full rounded-full bg-black/40 px-2 py-1 text-center text-xs font-bold">
                              Offen auf dem Tisch
                            </div>
                          ) : (
                            <div
                              className={`w-full rounded-full bg-white/20 px-2 py-1 text-center text-xs font-bold transition-opacity ${
                                selected ? "opacity-100" : "opacity-0"
                              }`}
                            >
                              ✓ Abwählen
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {isHunter && hunterAnimal && (
              <div className="rounded-3xl border border-amber-400/40 bg-amber-500/10 p-4 shadow-2xl">
                <h2 className="text-xl font-bold">
                  Du jagst als {hunterAnimal.name}
                </h2>
                <p className="mt-1 text-sm text-zinc-300">
                  Wähle deine Beute (schwächeres Tier):
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {validPrey.map((prey) => (
                    <button
                      key={prey.id}
                      type="button"
                      onClick={() => pickPrey(prey.id)}
                      className={`rounded-xl bg-gradient-to-br ${prey.color} px-3 py-3 text-sm font-bold shadow-md transition hover:scale-[1.02] active:scale-95`}
                    >
                      {prey.emoji} {prey.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {phase === "huntPick" && !isHunter && currentHunterId && (
              <div className="rounded-2xl bg-zinc-900/60 px-4 py-3 text-center text-sm text-zinc-300">
                {players.find((p) => p.id === currentHunterId)?.name} wählt die
                Beute …
              </div>
            )}

            {(phase === "calling" || phase === "select") &&
              myPlayer &&
              !myPlayer.alive && (
                <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-center text-sm font-semibold text-red-200">
                  Du wurdest gefressen – du spielst diesen Durchgang nicht mehr
                  mit.
                </div>
              )}

            <div>
              <h2 className="mb-1 text-base font-bold">Spieler</h2>
              <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                {players.map((player) => {
                  const choice = getAnimal(selections[player.id]);
                  const hasChosen = !!selections[player.id];
                  const isMe = player.id === myPlayerId;
                  const openCards = (tableOpen[player.id] || [])
                    .map(getAnimal)
                    .filter(Boolean);
                  const showChoice =
                    !hideListMiniCards &&
                    phase !== "select" &&
                    choice &&
                    (lastCall?.type === "duplicate"
                      ? lastCall.playerIds?.includes(player.id)
                      : lastCall?.hunterId === player.id ||
                        lastCall?.eatenIds?.includes(player.id));

                  return (
                    <div
                      key={player.id}
                      className={`min-w-0 rounded-xl border p-2 shadow-md transition ${
                        player.alive
                          ? "border-white/10 bg-white/5"
                          : "border-red-800/50 bg-red-950/30 opacity-70"
                      } ${isMe ? "ring-2 ring-emerald-400/50" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex min-w-0 items-center gap-1">
                          <span className="truncate text-sm font-bold">
                            {player.name}
                          </span>
                          {isMe && (
                            <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                              du
                            </span>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            player.alive
                              ? "bg-emerald-500/80"
                              : "bg-red-700/80"
                          }`}
                        >
                          {player.alive ? "Lebt" : "Gejagt"}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-tight text-zinc-400">
                        <span>
                          🌾{" "}
                          <span className="text-white">{player.food || 0}</span>
                        </span>
                        {showChoice && choice ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md bg-gradient-to-br ${choice.color} px-1.5 py-0.5 text-[10px] font-bold text-white`}
                          >
                            {choice.emoji && (
                              <span aria-hidden="true">{choice.emoji}</span>
                            )}
                            {choice.name}
                          </span>
                        ) : (
                          <span
                            className={
                              player.alive
                                ? hasChosen && phase === "select"
                                  ? "text-emerald-300"
                                  : "text-zinc-400"
                                : "text-red-300"
                            }
                          >
                            {player.alive
                              ? hasChosen && phase === "select"
                                ? "✓ Bereit"
                                : phase === "select"
                                  ? "Wählt…"
                                  : "Aktiv"
                              : "Gefressen"}
                          </span>
                        )}
                      </div>

                      {openCards.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {openCards.map((animal) => (
                            <span
                              key={animal.id}
                              title={`Offen: ${animal.name}`}
                              className="inline-flex items-center gap-0.5 rounded-full bg-zinc-800/90 px-1.5 py-0.5 text-[10px] font-medium text-zinc-200"
                            >
                              {animal.emoji && (
                                <span aria-hidden="true" className="text-xs leading-none">
                                  {animal.emoji}
                                </span>
                              )}
                              {animal.name}
                            </span>
                          ))}
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
