import { create } from 'zustand';
import type {
  GameMode, SphereColor, SphereAction, GamePhase,
  RuleMap, ActiveSphere, SessionMetrics, AdaptiveParams, CMCIScore,
} from '../types';

// ─── Constants ────────────────────────────────────────────────
const BASE_RULES: RuleMap = { green: 'left', blue: 'right', red: 'inhibit', yellow: 'hold' };
const SESSION_DURATION = 90;

const EMPTY_METRICS: SessionMetrics = {
  reactionTimes: [], driftMagnitudes: [], inhibitionErrors: 0,
  falsePositives: 0, ruleSwitchLatencies: [], totalReactions: 0, correctReactions: 0,
};

const INIT_ADAPTIVE: AdaptiveParams = {
  objectSpeed: 1.0, targetSize: 1.0, cognitiveLoad: 0.5, spawnDelay: 1600,
};

// ─── Helpers ──────────────────────────────────────────────────
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp  = (a: number, b: number, t: number)   => a + (b - a) * t;
const mean  = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;

function shuffleRules(): RuleMap {
  const movable: SphereAction[] = ['left', 'right', 'hold'];
  const shuffled = [...movable].sort(() => Math.random() - 0.5);
  return { green: shuffled[0], blue: shuffled[1], red: 'inhibit', yellow: shuffled[2] };
}

function adaptParams(current: AdaptiveParams, metrics: SessionMetrics): AdaptiveParams {
  const avgRT    = mean(metrics.reactionTimes.slice(-6)) || 600;
  const total    = metrics.totalReactions || 1;
  const errorRate = (metrics.inhibitionErrors + metrics.falsePositives) / total;
  const accuracy  = metrics.correctReactions / total;

  const tSpeed = errorRate > 0.35 ? 0.70 : accuracy > 0.85 && avgRT < 380 ? 1.45 : 1.0;
  const tSize  = errorRate > 0.35 ? 1.30 : accuracy > 0.85 ? 0.78 : 1.0;
  const tDelay = errorRate > 0.35 ? 2200 : avgRT < 350 ? 900 : 1500;
  const tLoad  = errorRate > 0.35 ? 0.30 : accuracy > 0.85 ? 0.80 : 0.55;

  const t = 0.12;
  return {
    objectSpeed:   clamp(lerp(current.objectSpeed,   tSpeed, t), 0.40, 2.20),
    targetSize:    clamp(lerp(current.targetSize,    tSize,  t), 0.55, 1.50),
    cognitiveLoad: clamp(lerp(current.cognitiveLoad, tLoad,  t), 0.20, 1.00),
    spawnDelay:    clamp(lerp(current.spawnDelay,    tDelay, t), 620, 2600),
  };
}

function detectFatigue(metrics: SessionMetrics): number {
  if (metrics.reactionTimes.length < 10) return 0;
  const recent  = mean(metrics.reactionTimes.slice(-5));
  const earlier = mean(metrics.reactionTimes.slice(-10, -5));
  if (!earlier) return 0;
  return clamp((recent - earlier) / earlier * 2, 0, 1);
}

function calcCMCI(metrics: SessionMetrics): CMCIScore {
  const avgRT    = mean(metrics.reactionTimes) || 900;
  const total    = metrics.totalReactions || 1;
  const acc      = metrics.correctReactions / total;
  const avgDrift = mean(metrics.driftMagnitudes) || 0;
  const inhibOk  = 1 - clamp((metrics.inhibitionErrors + metrics.falsePositives) / total, 0, 1);

  const cognitive      = clamp((1 - clamp((avgRT - 180) / 900, 0, 1)) * acc * 100, 0, 100);
  const motor          = clamp((1 - clamp(avgDrift / 2.5, 0, 1)) * 100, 0, 100);
  const errorCorrection = clamp(inhibOk * 100, 0, 100);
  const cmci           = cognitive * 0.40 + motor * 0.30 + errorCorrection * 0.30;

  return { cognitive, motor, errorCorrection, cmci };
}

function reduceDifficulty(a: AdaptiveParams): AdaptiveParams {
  return {
    objectSpeed:   Math.max(0.40, a.objectSpeed   * 0.84),
    targetSize:    Math.min(1.50, a.targetSize    * 1.12),
    cognitiveLoad: Math.max(0.20, a.cognitiveLoad * 0.78),
    spawnDelay:    Math.min(2600, a.spawnDelay    * 1.22),
  };
}

// ─── Store ────────────────────────────────────────────────────
interface GameStore {
  phase: GamePhase;
  mode: GameMode;
  rules: RuleMap;
  activeSpheres: ActiveSphere[];
  metrics: SessionMetrics;
  adaptive: AdaptiveParams;
  score: CMCIScore | null;
  timeLeft: number;
  fatigue: number;
  ruleSwitchAlert: boolean;
  lastRuleSwitchAt: number;

  setMode: (m: GameMode) => void;
  startSession: () => void;
  endSession: () => void;
  spawnSphere: (s: ActiveSphere) => void;
  removeSphere: (id: string) => void;
  registerInput: (p: {
    sphereId: string; action: SphereAction;
    driftMagnitude?: number; reactionTime?: number;
  }) => void;
  registerInhibition: (sphereId: string) => void;
  registerMiss: (sphereId: string) => void;
  triggerRuleSwitch: () => void;
  tick: (deltaMs: number) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'menu',
  mode: 'micro-reach',
  rules: { ...BASE_RULES },
  activeSpheres: [],
  metrics: { ...EMPTY_METRICS },
  adaptive: { ...INIT_ADAPTIVE },
  score: null,
  timeLeft: SESSION_DURATION,
  fatigue: 0,
  ruleSwitchAlert: false,
  lastRuleSwitchAt: 0,

  setMode: (mode) => set({ mode }),

  startSession: () => set({
    phase: 'playing',
    rules: { ...BASE_RULES },
    activeSpheres: [],
    metrics: { ...EMPTY_METRICS },
    adaptive: { ...INIT_ADAPTIVE },
    score: null,
    timeLeft: SESSION_DURATION,
    fatigue: 0,
    ruleSwitchAlert: false,
    lastRuleSwitchAt: Date.now(),
  }),

  endSession: () => {
    const { metrics } = get();
    set({ phase: 'results', score: calcCMCI(metrics), activeSpheres: [] });
  },

  spawnSphere: (sphere) =>
    set((s) => ({ activeSpheres: [...s.activeSpheres, sphere] })),

  removeSphere: (id) =>
    set((s) => ({ activeSpheres: s.activeSpheres.filter((x) => x.id !== id) })),

  registerInput: ({ sphereId, action, driftMagnitude = 0, reactionTime = 600 }) => {
    const { activeSpheres, rules, lastRuleSwitchAt, metrics: prev, adaptive } = get();
    const sphere = activeSpheres.find((s) => s.id === sphereId);
    if (!sphere) return;

    const expected       = rules[sphere.color];
    const isInhibitError = sphere.color === 'red' && action !== 'inhibit';
    const isFalsePositive = !!sphere.isDistractor;
    const isCorrect = !isInhibitError && !isFalsePositive &&
      ((expected === 'left'  && action === 'left')  ||
       (expected === 'right' && action === 'right') ||
       (expected === 'hold'  && action === 'hold'));

    const timeSinceSwitch = Date.now() - lastRuleSwitchAt;
    const switchCost = timeSinceSwitch < 3500 ? Math.max(0, reactionTime - 450) : 0;

    const metrics: SessionMetrics = {
      ...prev,
      totalReactions:   prev.totalReactions + 1,
      correctReactions: prev.correctReactions + (isCorrect ? 1 : 0),
      reactionTimes:    [...prev.reactionTimes, reactionTime],
      driftMagnitudes:  [...prev.driftMagnitudes, driftMagnitude],
      inhibitionErrors: prev.inhibitionErrors + (isInhibitError  ? 1 : 0),
      falsePositives:   prev.falsePositives   + (isFalsePositive ? 1 : 0),
      ruleSwitchLatencies: switchCost > 0
        ? [...prev.ruleSwitchLatencies, switchCost]
        : prev.ruleSwitchLatencies,
    };

    const newAdaptive = adaptParams(adaptive, metrics);
    const fatigue     = detectFatigue(metrics);

    set((s) => ({
      metrics,
      adaptive: fatigue > 0.72 ? reduceDifficulty(newAdaptive) : newAdaptive,
      fatigue,
      activeSpheres: s.activeSpheres.filter((x) => x.id !== sphereId),
    }));
  },

  registerInhibition: (sphereId) => {
    const { activeSpheres, metrics: prev } = get();
    if (!activeSpheres.find((s) => s.id === sphereId)) return;
    set((s) => ({
      metrics: {
        ...prev,
        totalReactions:   prev.totalReactions + 1,
        correctReactions: prev.correctReactions + 1,
      },
      activeSpheres: s.activeSpheres.filter((x) => x.id !== sphereId),
    }));
  },

  registerMiss: (sphereId) => {
    const { activeSpheres, metrics: prev } = get();
    const sphere = activeSpheres.find((s) => s.id === sphereId);
    if (!sphere || sphere.color === 'red') return;
    set((s) => ({
      metrics: {
        ...prev,
        totalReactions: prev.totalReactions + 1,
        reactionTimes:  [...prev.reactionTimes, 1200],
      },
      activeSpheres: s.activeSpheres.filter((x) => x.id !== sphereId),
    }));
  },

  triggerRuleSwitch: () => {
    const newRules = shuffleRules();
    set({ rules: newRules, ruleSwitchAlert: true, lastRuleSwitchAt: Date.now() });
    setTimeout(() => set({ ruleSwitchAlert: false }), 2800);
  },

  tick: (deltaMs) => {
    const { phase, timeLeft } = get();
    if (phase !== 'playing') return;
    const next = timeLeft - deltaMs / 1000;
    if (next <= 0) get().endSession();
    else set({ timeLeft: next });
  },
}));

// re-export types used elsewhere
export type { SphereColor, GameMode, SphereAction, GamePhase };
