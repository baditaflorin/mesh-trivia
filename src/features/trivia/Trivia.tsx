import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { createRoomSync } from "../sync/yjsRoom";
import { createClockSync } from "../sync/clockSync";
import { maybeFetchTurnCredentials } from "../sync/iceConfig";
import { BUILTIN_PACKS, type ChoiceIndex, type QuestionPack, validatePack } from "./packs";
import { basePoints, FIRST_CORRECT_BONUS } from "./scoring";

const REVEAL_DELAY_MS = 1200; // delay between press and "answer buttons appear"
const ANSWER_WINDOW_MS = 30_000;

type Props = {
  roomId: string;
  myName: string;
  myPeerId: string;
  customPackJson: string;
};

type GameState = {
  pack: QuestionPack;
  currentIdx: number;
  revealAtMesh: number | null;
  showAnswer: boolean;
};

type AnswerEntry = { choice: ChoiceIndex; atMesh: number };

type Scoreboard = Record<string, { name: string; score: number }>;

const COLORS = ["red", "blue", "yellow", "green"] as const;

export function Trivia({ roomId, myName, myPeerId, customPackJson }: Props) {
  const [armed, setArmed] = useState(false);
  const [game, setGame] = useState<GameState | null>(null);
  const [scoreboard, setScoreboard] = useState<Scoreboard>({});
  const [myAnswer, setMyAnswer] = useState<ChoiceIndex | null>(null);
  const [answersByPeer, setAnswersByPeer] = useState<Record<string, AnswerEntry>>({});
  const [now, setNow] = useState(Date.now());

  const customPack = useMemo<QuestionPack | null>(() => {
    if (!customPackJson.trim()) return null;
    try {
      const parsed = JSON.parse(customPackJson);
      const r = validatePack(parsed);
      if ("error" in r) return null;
      return r;
    } catch {
      return null;
    }
  }, [customPackJson]);

  const availablePacks = useMemo<QuestionPack[]>(() => {
    return customPack ? [...BUILTIN_PACKS, customPack] : BUILTIN_PACKS;
  }, [customPack]);

  const mesh = useMemo(() => {
    if (!armed) return null;
    const room = createRoomSync(roomId);
    const clock = createClockSync(room.provider);
    const gameMap = room.doc.getMap<GameState>("game");
    const answers = room.doc.getMap<Y.Map<AnswerEntry>>("answers");
    const board = room.doc.getMap<{ name: string; score: number }>("scoreboard");
    return { room, clock, gameMap, answers, board };
  }, [armed, roomId]);

  useEffect(() => {
    if (!armed) return undefined;
    void maybeFetchTurnCredentials();
    return undefined;
  }, [armed]);

  useEffect(() => {
    return () => {
      mesh?.clock.destroy();
      mesh?.room.provider?.destroy();
    };
  }, [mesh]);

  // Publish my name into the scoreboard
  useEffect(() => {
    if (!mesh) return;
    const existing = mesh.board.get(myPeerId);
    if (!existing) {
      mesh.room.doc.transact(() => {
        mesh.board.set(myPeerId, { name: myName, score: 0 });
      });
    } else if (existing.name !== myName) {
      mesh.room.doc.transact(() => {
        mesh.board.set(myPeerId, { name: myName, score: existing.score });
      });
    }
  }, [mesh, myName, myPeerId]);

  // RAF clock
  useEffect(() => {
    if (!mesh) return undefined;
    let raf = 0;
    const tick = () => {
      setNow(mesh.clock.meshNow());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mesh]);

  // Observe game state
  useEffect(() => {
    if (!mesh) return undefined;
    const onChange = () => {
      setGame(mesh.gameMap.get("singleton") ?? null);
    };
    onChange();
    mesh.gameMap.observe(onChange);
    return () => mesh.gameMap.unobserve(onChange);
  }, [mesh]);

  // Observe scoreboard
  useEffect(() => {
    if (!mesh) return undefined;
    const onChange = () => {
      const next: Scoreboard = {};
      mesh.board.forEach((v, k) => {
        next[k] = v;
      });
      setScoreboard(next);
    };
    onChange();
    mesh.board.observe(onChange);
    return () => mesh.board.unobserve(onChange);
  }, [mesh]);

  // Observe answers for the current question
  const currentIdx = game?.currentIdx ?? -1;
  useEffect(() => {
    if (!mesh || currentIdx < 0) {
      setAnswersByPeer({});
      return undefined;
    }
    const key = String(currentIdx);
    let qAnswers = mesh.answers.get(key);
    const readAll = () => {
      const m = mesh.answers.get(key);
      if (!m) {
        setAnswersByPeer({});
        return;
      }
      const out: Record<string, AnswerEntry> = {};
      m.forEach((v, k) => {
        out[k] = v;
      });
      setAnswersByPeer(out);
    };
    readAll();
    if (qAnswers) qAnswers.observe(readAll);
    const onTopChange = () => {
      const m = mesh.answers.get(key);
      if (m !== qAnswers) {
        if (qAnswers) qAnswers.unobserve(readAll);
        qAnswers = m;
        if (qAnswers) qAnswers.observe(readAll);
        readAll();
      }
    };
    mesh.answers.observe(onTopChange);
    return () => {
      if (qAnswers) qAnswers.unobserve(readAll);
      mesh.answers.unobserve(onTopChange);
    };
  }, [mesh, currentIdx]);

  // Reset my answer when question changes
  useEffect(() => {
    setMyAnswer(null);
  }, [currentIdx]);

  const revealCurrentAnswer = useCallback(() => {
    if (!mesh || !game) return;
    if (game.showAnswer) return;
    const question = game.pack.questions[game.currentIdx];
    if (!question) return;
    const correctIdx = question.correct;
    const revealMs = game.revealAtMesh ?? 0;
    const correctAnswers: { peerId: string; responseMs: number }[] = [];
    const map = mesh.answers.get(String(game.currentIdx));
    if (map) {
      map.forEach((entry, peerId) => {
        if (entry.choice === correctIdx) {
          correctAnswers.push({ peerId, responseMs: Math.max(0, entry.atMesh - revealMs) });
        }
      });
    }
    correctAnswers.sort((a, b) => a.responseMs - b.responseMs);
    mesh.room.doc.transact(() => {
      correctAnswers.forEach((c, i) => {
        const prev = mesh.board.get(c.peerId);
        const base = basePoints(true, c.responseMs);
        const bonus = i === 0 ? FIRST_CORRECT_BONUS : 0;
        mesh.board.set(c.peerId, {
          name: prev?.name ?? "anon",
          score: (prev?.score ?? 0) + base + bonus,
        });
      });
      mesh.gameMap.set("singleton", { ...game, showAnswer: true });
    });
  }, [mesh, game]);

  // Auto-reveal answer when window closes
  const revealCallRef = useRef(revealCurrentAnswer);
  revealCallRef.current = revealCurrentAnswer;
  const revealed = !!game && game.revealAtMesh !== null && now >= game.revealAtMesh;
  const remainingMs =
    !game || game.revealAtMesh === null
      ? 0
      : Math.max(0, ANSWER_WINDOW_MS - (now - game.revealAtMesh));
  const totalAnswered = Object.keys(answersByPeer).length;
  const totalPlayers = Math.max(1, Object.keys(scoreboard).length);
  const allAnswered = totalAnswered >= totalPlayers;
  const windowClosed = revealed && (remainingMs <= 0 || allAnswered);

  useEffect(() => {
    if (!mesh || !game) return;
    if (game.showAnswer) return;
    if (!windowClosed) return;
    revealCallRef.current();
  }, [mesh, game?.currentIdx, game?.showAnswer, windowClosed]); // eslint-disable-line react-hooks/exhaustive-deps

  const startWithPack = (pack: QuestionPack) => {
    if (!mesh) return;
    mesh.room.doc.transact(() => {
      mesh.gameMap.set("singleton", {
        pack,
        currentIdx: 0,
        revealAtMesh: mesh.clock.meshNow() + REVEAL_DELAY_MS,
        showAnswer: false,
      });
      mesh.answers.clear();
    });
  };

  const advanceQuestion = () => {
    if (!mesh || !game) return;
    const nextIdx = game.currentIdx + 1;
    if (nextIdx >= game.pack.questions.length) {
      mesh.room.doc.transact(() => {
        mesh.gameMap.set("singleton", {
          ...game,
          currentIdx: nextIdx,
          revealAtMesh: null,
          showAnswer: false,
        });
      });
      return;
    }
    mesh.room.doc.transact(() => {
      mesh.gameMap.set("singleton", {
        pack: game.pack,
        currentIdx: nextIdx,
        revealAtMesh: mesh.clock.meshNow() + REVEAL_DELAY_MS,
        showAnswer: false,
      });
    });
  };

  const submitAnswer = (choice: ChoiceIndex) => {
    if (!mesh || !game || game.showAnswer) return;
    if (myAnswer !== null) return;
    if (game.revealAtMesh === null) return;
    if (mesh.clock.meshNow() < game.revealAtMesh) return;
    const key = String(game.currentIdx);
    setMyAnswer(choice);
    mesh.room.doc.transact(() => {
      let map = mesh.answers.get(key);
      if (!map) {
        map = new Y.Map<AnswerEntry>();
        mesh.answers.set(key, map);
      }
      map.set(myPeerId, { choice, atMesh: mesh.clock.meshNow() });
    });
  };

  const playAgain = () => {
    if (!mesh) return;
    mesh.room.doc.transact(() => {
      mesh.gameMap.delete("singleton");
      mesh.answers.clear();
      mesh.board.forEach((v, k) => mesh.board.set(k, { name: v.name, score: 0 }));
    });
  };

  // ---- render ----

  if (!armed) {
    return (
      <div className="trivia-arm">
        <h1>mesh-trivia</h1>
        <p>
          Free, peer-to-peer Kahoot. Every phone reveals the question at the exact same mesh-time
          instant, so first-to-answer is fair across devices. Unlimited players.
        </p>
        <div className="trivia-arm-preview">
          Playing as <strong>{myName}</strong> · room <code>{roomId}</code>
        </div>
        <button type="button" className="trivia-arm-button" onClick={() => setArmed(true)}>
          Connect
        </button>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="trivia-stage trivia-pregame">
        <div className="trivia-hud">
          <span>{Object.keys(scoreboard).length} players</span>
          <span>·</span>
          <span>idle</span>
        </div>
        <div className="trivia-pregame-content">
          <h2>Pick a pack to start</h2>
          <div className="trivia-pack-list">
            {availablePacks.map((p) => (
              <button
                key={p.name}
                type="button"
                className="trivia-pack-btn"
                onClick={() => startWithPack(p)}
              >
                <span className="trivia-pack-name">{p.name}</span>
                <span className="trivia-pack-meta">{p.questions.length} questions</span>
              </button>
            ))}
          </div>
          {!customPack && (
            <p className="trivia-hint">
              Tip — paste a JSON pack in <strong>Settings</strong> to add your own.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (game.currentIdx >= game.pack.questions.length) {
    const standings = Object.entries(scoreboard)
      .map(([peerId, v]) => ({ peerId, ...v }))
      .sort((a, b) => b.score - a.score);
    return (
      <div className="trivia-stage trivia-endgame">
        <div className="trivia-hud">
          <span>{standings.length} players</span>
          <span>·</span>
          <span>final</span>
        </div>
        <h2>Final standings</h2>
        <ol className="trivia-leaderboard trivia-leaderboard-big">
          {standings.map((s, i) => (
            <li key={s.peerId} className={s.peerId === myPeerId ? "me" : ""}>
              <span className="trivia-rank">{i + 1}</span>
              <span className="trivia-name">{s.name}</span>
              <span className="trivia-score">{s.score}</span>
            </li>
          ))}
        </ol>
        <button type="button" className="trivia-arm-button" onClick={playAgain}>
          Play again
        </button>
      </div>
    );
  }

  const question = game.pack.questions[game.currentIdx];
  if (!question) return null;

  const standings = Object.entries(scoreboard)
    .map(([peerId, v]) => ({ peerId, ...v }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return (
    <div className="trivia-stage trivia-playing">
      <div className="trivia-hud">
        <span>
          Q {game.currentIdx + 1}/{game.pack.questions.length}
        </span>
        <span>·</span>
        <span>{totalPlayers} players</span>
        {revealed && !game.showAnswer && (
          <>
            <span>·</span>
            <span>{Math.ceil(remainingMs / 1000)}s</span>
          </>
        )}
      </div>

      <div className="trivia-prompt">{question.prompt}</div>

      {!revealed ? (
        <div className="trivia-countdown">
          <div className="trivia-countdown-num">
            {Math.max(0, Math.ceil(((game.revealAtMesh ?? now) - now) / 1000))}
          </div>
          <div className="trivia-countdown-label">get ready</div>
        </div>
      ) : (
        <div className="trivia-choices">
          {question.choices.map((choice, i) => {
            const idx = i as ChoiceIndex;
            const colorClass = `trivia-choice-${COLORS[i]}`;
            const isMine = myAnswer === idx;
            const isCorrect = game.showAnswer && idx === question.correct;
            const isWrongPicked = game.showAnswer && isMine && idx !== question.correct;
            return (
              <button
                key={i}
                type="button"
                className={`trivia-choice ${colorClass} ${isMine ? "mine" : ""} ${isCorrect ? "correct" : ""} ${isWrongPicked ? "wrong" : ""}`}
                disabled={game.showAnswer || myAnswer !== null}
                onClick={() => submitAnswer(idx)}
              >
                <span className="trivia-choice-letter">{String.fromCharCode(65 + i)}</span>
                <span className="trivia-choice-text">{choice}</span>
              </button>
            );
          })}
        </div>
      )}

      {game.showAnswer ? (
        <div className="trivia-after">
          <ol className="trivia-leaderboard">
            {standings.map((s, i) => (
              <li key={s.peerId} className={s.peerId === myPeerId ? "me" : ""}>
                <span className="trivia-rank">{i + 1}</span>
                <span className="trivia-name">{s.name}</span>
                <span className="trivia-score">{s.score}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="trivia-next-btn" onClick={advanceQuestion}>
            Next question
          </button>
        </div>
      ) : revealed ? (
        <div className="trivia-answered-readout">
          {totalAnswered} / {totalPlayers} answered
        </div>
      ) : null}
    </div>
  );
}
