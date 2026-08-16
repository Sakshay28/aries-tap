"use client";

// The plugin system. Every game is a self-contained component that satisfies one
// contract (GameComponentProps) and is registered here by key. Adding a new game
// = drop a component in this folder and add one line below; nothing else in the
// app changes. Games are dynamically imported so a guest only downloads the one
// they choose to play (perf budget).
//
// How this maps to the spec's GameEngine interface:
//   interface GameEngine { play(); validate(); calculateReward(); }
//   • calculateReward()  → server: drawSlot()  (src/lib/playwin/rewards.ts)
//   • play() / validate()→ server: playGame action + token/limit checks
//   • the component here is the *presentation* of that engine — it takes the
//     guest's gesture, calls requestPlay() (which runs the authoritative server
//     play), then animates to the result the server already decided.

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { GameKey, PlayResult, PublicGame } from "@/lib/playwin/types";

export type PlaySuccess = Extract<PlayResult, { ok: true }>;
export type PlayFail = Extract<PlayResult, { ok: false }>;

export type GameComponentProps = {
  game: PublicGame;
  // Runs the authoritative play on the server. The engine calls this the moment
  // the guest commits (a spin, a scratch-through, a draw). One play per mount.
  requestPlay: () => Promise<PlayResult>;
  // The engine calls this once its reveal animation has landed on the result.
  onRevealed: (result: PlaySuccess) => void;
  // The engine calls this if the play was refused (rate limited / already played).
  onError: (result: PlayFail) => void;
  reducedMotion: boolean;
};

export type GameComponent = ComponentType<GameComponentProps>;

function Loading() {
  return (
    <div className="flex h-72 items-center justify-center">
      <span className="pw-spinner" aria-hidden />
    </div>
  );
}

export const GAME_REGISTRY: Partial<Record<GameKey, GameComponent>> = {
  spin: dynamic(() => import("./SpinWheel").then((m) => m.SpinWheel), {
    ssr: false,
    loading: Loading,
  }),
  scratch: dynamic(() => import("./ScratchCard").then((m) => m.ScratchCard), {
    ssr: false,
    loading: Loading,
  }),
  lucky: dynamic(() => import("./LuckyNumber").then((m) => m.LuckyNumber), {
    ssr: false,
    loading: Loading,
  }),
  flip: dynamic(() => import("./FlipCard").then((m) => m.FlipCard), {
    ssr: false,
    loading: Loading,
  }),
  memory: dynamic(() => import("./MemoryMatch").then((m) => m.MemoryMatch), {
    ssr: false,
    loading: Loading,
  }),
  tap: dynamic(() => import("./TapChallenge").then((m) => m.TapChallenge), {
    ssr: false,
    loading: Loading,
  }),
  box: dynamic(() => import("./MysteryBox").then((m) => m.MysteryBox), {
    ssr: false,
    loading: Loading,
  }),
};

export function hasEngine(key: string): boolean {
  return key in GAME_REGISTRY;
}

// Games that a venue enabled in config AND we have an engine for. The selection
// screen renders exactly these — a config-only game can never be picked.
export function playableGames(games: PublicGame[]): PublicGame[] {
  return games.filter((g) => hasEngine(g.key));
}
