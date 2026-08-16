"use client";

// Memory Match. A real 3-pair memory game: flip two cards, keep the matches. The
// reward is drawn server-side on the first flip (so abandoning mid-game costs no
// play, and a "you've already played" is surfaced before any effort), and
// revealed the moment the board is cleared. The timer is flavour only.
//
// Robustness: the board is a single `deck` state driven by a pure, idempotent
// reducer. A MATCH is resolved *synchronously inside the reducer* (no timer), so
// completion can't be raced by fast taps or a doubled handler (React StrictMode
// dev double-invoke, a double-tap). Only a genuine MISS needs a deferred
// flip-back, handled by an effect that cancels itself if the board moves on.

import { useEffect, useRef, useState } from "react";
import { Coffee, GlassWater, IceCreamCone, type LucideIcon } from "lucide-react";
import type { GameComponentProps, PlaySuccess } from "./registry";

type Sym = { key: string; Icon: LucideIcon; color: string };
const SYMBOLS: Sym[] = [
  { key: "a", Icon: Coffee, color: "#c8a76e" },
  { key: "b", Icon: IceCreamCone, color: "#e0c28c" },
  { key: "c", Icon: GlassWater, color: "#b98d4e" },
];

type Card = { id: number; sym: Sym; flipped: boolean; matched: boolean };

function shuffledDeck(): Card[] {
  const cards: Card[] = [];
  SYMBOLS.forEach((sym, i) => {
    cards.push({ id: i * 2, sym, flipped: false, matched: false });
    cards.push({ id: i * 2 + 1, sym, flipped: false, matched: false });
  });
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

const upIndexes = (deck: Card[]): number[] =>
  deck.reduce<number[]>((acc, c, i) => (c.flipped && !c.matched ? [...acc, i] : acc), []);

export function MemoryMatch({
  requestPlay,
  onRevealed,
  onError,
  reducedMotion,
}: GameComponentProps) {
  const initial = useRef<Card[]>(shuffledDeck());
  const [deck, setDeck] = useState<Card[]>(initial.current);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const started = useRef(false);
  const resultRef = useRef<PlaySuccess | null>(null);
  const playPromise = useRef<Promise<PlaySuccess | null> | null>(null);
  const startTime = useRef(0);
  const revealing = useRef(false);

  // Flavour timer.
  useEffect(() => {
    if (!running || done) return;
    const id = window.setInterval(() => {
      setElapsed((performance.now() - startTime.current) / 1000);
    }, 100);
    return () => window.clearInterval(id);
  }, [running, done]);

  // Two face-up cards that DON'T match → flip them back after a beat. (Matches
  // are resolved synchronously in the reducer, so they never reach this state.)
  useEffect(() => {
    const up = upIndexes(deck);
    if (up.length !== 2) return;
    if (deck[up[0]].sym.key === deck[up[1]].sym.key) return; // a match, resolving elsewhere
    const t = window.setTimeout(
      () => setDeck((prev) => prev.map((c) => (c.matched ? c : { ...c, flipped: false }))),
      reducedMotion ? 350 : 750,
    );
    return () => window.clearTimeout(t);
  }, [deck, reducedMotion]);

  // Board cleared → reveal the (already in-flight) reward.
  useEffect(() => {
    if (revealing.current || !started.current) return;
    if (!deck.every((c) => c.matched)) return;
    revealing.current = true;
    setDone(true);
    void (async () => {
      const res = (await playPromise.current) ?? resultRef.current;
      if (res) window.setTimeout(() => onRevealed(res), reducedMotion ? 300 : 700);
    })();
  }, [deck, onRevealed, reducedMotion]);

  function flip(i: number) {
    if (done) return;

    // First interaction draws the reward in the background (once).
    if (!started.current) {
      started.current = true;
      startTime.current = performance.now();
      setRunning(true);
      playPromise.current = requestPlay().then((res) => {
        if (!res.ok) {
          onError(res);
          return null;
        }
        resultRef.current = res;
        return res;
      });
    }

    setDeck((prev) => {
      const up = upIndexes(prev);
      // Idempotent: ignore when two are already up, or this card is up/matched.
      if (up.length >= 2 || prev[i].flipped || prev[i].matched) return prev;

      const flipped = prev.map((c, idx) => (idx === i ? { ...c, flipped: true } : c));
      if (up.length === 1) {
        const a = up[0];
        // Second card of a pair — resolve a match right here, no timer to race.
        if (flipped[a].sym.key === flipped[i].sym.key) {
          return flipped.map((c, idx) =>
            idx === a || idx === i ? { ...c, matched: true } : c,
          );
        }
      }
      return flipped;
    });
  }

  const matchedPairs = deck.filter((c) => c.matched).length / 2;

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 flex w-full max-w-[17rem] items-center justify-between text-[12px] text-ink-dim">
        <span>
          Matched {matchedPairs}/{SYMBOLS.length}
        </span>
        <span className="tabular-nums">{elapsed.toFixed(1)}s</span>
      </div>

      <div className="grid w-full max-w-[17rem] grid-cols-3 gap-3">
        {deck.map((c, i) => {
          const Icon = c.sym.Icon;
          const open = c.flipped || c.matched;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => flip(i)}
              disabled={done}
              className="pw-mem-scene"
              aria-label={open ? c.sym.key : "Hidden card"}
            >
              <div className="pw-mem" data-flipped={open} data-matched={c.matched}>
                <div className="pw-mem-face pw-mem-front">
                  <span className="pw-flip-mark">?</span>
                </div>
                <div className="pw-mem-face pw-mem-back" style={{ color: c.sym.color }}>
                  <Icon size={26} strokeWidth={1.75} aria-hidden />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-center text-[13px] text-ink-dim">
        {done ? "Matched! Revealing your prize…" : "Find all three pairs."}
      </p>
    </div>
  );
}
