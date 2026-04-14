export type GameMode =
  | 'micro-reach'
  | 'rule-switch'
  | 'inhibition-conflict'
  | 'micro-trajectory'
  | 'dual-task'
  | 'neural-grid'
  | 'signal-trace'
  | 'reflex-gate'
  | 'cognitive-stack';

export type SphereColor = 'green' | 'blue' | 'red' | 'yellow';
export type SphereAction = 'left' | 'right' | 'inhibit' | 'hold';
export type GamePhase = 'menu' | 'playing' | 'results';

export interface RuleMap {
  green: SphereAction;
  blue: SphereAction;
  red: SphereAction;
  yellow: SphereAction;
}

export interface ActiveSphere {
  id: string;
  color: SphereColor;
  position: [number, number, number];
  spawnTime: number;
  isDistractor?: boolean;
}

export interface SessionMetrics {
  reactionTimes: number[];
  driftMagnitudes: number[];
  inhibitionErrors: number;
  falsePositives: number;
  ruleSwitchLatencies: number[];
  totalReactions: number;
  correctReactions: number;
}

export interface AdaptiveParams {
  objectSpeed: number;
  targetSize: number;
  cognitiveLoad: number;
  spawnDelay: number;
}

export interface CMCIScore {
  cognitive: number;
  motor: number;
  errorCorrection: number;
  cmci: number;
}
