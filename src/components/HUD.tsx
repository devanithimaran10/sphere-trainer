import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useMiniGameStore } from '../store/useMiniGameStore';
import NeuralGrid     from './games/NeuralGrid';
import SignalTrace    from './games/SignalTrace';
import RefexGate     from './games/RefexGate';
import CognitiveStack from './games/CognitiveStack';
import type { GameMode, SphereColor, SphereAction } from '../types';

// ─── Mode metadata ────────────────────────────────────────────
const MODES: {
  id: GameMode; label: string; sub: string;
  icon: string; difficulty: number; color: string;
  desc: string;
}[] = [
  {
    id: 'micro-reach', label: 'Micro-Reach', sub: 'Drift Control',
    icon: '◈', difficulty: 2, color: '#00d4ff',
    desc: 'React to sphere colours with precise directional swipes. Baseline cognitive-motor assessment.',
  },
  {
    id: 'rule-switch', label: 'Rule-Switch', sub: 'Reaction Field',
    icon: '⟳', difficulty: 4, color: '#7b2fff',
    desc: 'Colour-action mappings shift unpredictably mid-session. Measures adaptive cognition.',
  },
  {
    id: 'inhibition-conflict', label: 'Inhibition', sub: 'Conflict Trainer',
    icon: '✕', difficulty: 3, color: '#ff2d55',
    desc: 'Suppress responses to distractors and red targets. Tests executive inhibition.',
  },
  {
    id: 'micro-trajectory', label: 'Trajectory', sub: 'Stabilisation',
    icon: '↗', difficulty: 4, color: '#00ff88',
    desc: 'Interact with drifting targets under increasing speed. Measures motor precision.',
  },
  {
    id: 'dual-task', label: 'Dual-Task', sub: 'Coupling Challenge',
    icon: '⊗', difficulty: 5, color: '#ffd60a',
    desc: 'Rule-switching simultaneous with spatial tracking. Maximum cognitive-motor load.',
  },
  {
    id: 'neural-grid', label: 'Neural Grid', sub: 'Pattern Memory',
    icon: '⊞', difficulty: 3, color: '#00d4ff',
    desc: 'Watch tiles light up in sequence, then tap them in the same order. Tests spatial memory.',
  },
  {
    id: 'signal-trace', label: 'Signal Trace', sub: 'Node Sequencing',
    icon: '⟡', difficulty: 2, color: '#00ff88',
    desc: 'Click the numbered nodes along the path in order before time runs out. Tests precision.',
  },
  {
    id: 'reflex-gate', label: 'Reflex Gate', sub: 'Portal Timing',
    icon: '◉', difficulty: 4, color: '#ff2d55',
    desc: 'Four portals open and close. Hit the target portal exactly when it opens. Tests reflexes.',
  },
  {
    id: 'cognitive-stack', label: 'Cogni Stack', sub: 'Card Memory',
    icon: '⧉', difficulty: 3, color: '#ffd60a',
    desc: 'Flip cards to find matching symbol pairs before the timer runs out. Tests working memory.',
  },
];

const ACTION_LABEL: Record<SphereAction, string> = {
  left: '← Swipe Left', right: '→ Swipe Right',
  hold: '⏸ Hold 2s', inhibit: '✕ Ignore',
};

const DOT_CLASS: Record<SphereColor, string> = {
  green: 'dot-green', blue: 'dot-blue', red: 'dot-red', yellow: 'dot-yellow',
};

const COLOR_HEX: Record<SphereColor, string> = {
  green: '#00ff88', blue: '#00d4ff', red: '#ff2d55', yellow: '#ffd60a',
};

// ─── Difficulty pips ──────────────────────────────────────────
function DiffPips({ n, max = 5, color }: { n: number; max?: number; color: string }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full transition-all"
          style={{
            background: i < n ? color : 'rgba(255,255,255,0.12)',
            boxShadow: i < n ? `0 0 6px ${color}` : 'none',
          }}
        />
      ))}
    </div>
  );
}

// ─── Rules legend ─────────────────────────────────────────────
function RulesLegend({ compact = false }: { compact?: boolean }) {
  const rules = useGameStore((s) => s.rules);
  const pairs: { color: SphereColor; action: SphereAction }[] = [
    { color: 'green',  action: rules.green  },
    { color: 'blue',   action: rules.blue   },
    { color: 'yellow', action: rules.yellow },
    { color: 'red',    action: rules.red    },
  ];
  return (
    <div className={`flex flex-col gap-${compact ? '1.5' : '2'}`}>
      {pairs.map(({ color, action }) => (
        <div key={color} className="flex items-center gap-2.5">
          <span
            className={`flex-shrink-0 rounded-full ${compact ? 'w-2 h-2' : 'w-2.5 h-2.5'} ${DOT_CLASS[color]}`}
          />
          <span
            className={`font-mono ${compact ? 'text-[10px]' : 'text-xs'} tracking-wide`}
            style={{ color: COLOR_HEX[color] }}
          >
            {ACTION_LABEL[action]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Animated metric bar ──────────────────────────────────────
function MetricBar({ label, value, color, delay = 0 }: {
  label: string; value: number; color: string; delay?: number;
}) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(Math.round(value)), delay + 80);
    return () => clearTimeout(t);
  }, [value, delay]);

  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[10px] uppercase tracking-widest text-slate-400 font-display">{label}</span>
        <span className="font-mono text-sm font-semibold" style={{ color }}>
          {Math.round(value).toString().padStart(3, '0')}
        </span>
      </div>
      <div className="metric-track">
        <div
          className="metric-fill"
          style={{
            width: `${width}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: `0 0 8px ${color}55`,
            transition: `width 1.4s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
          }}
        />
      </div>
    </div>
  );
}

// ─── CMCI Radial gauge ────────────────────────────────────────
function CMCIGauge({ value }: { value: number }) {
  const r = 70;
  const circumference = 2 * Math.PI * r;
  const [drawn, setDrawn] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDrawn(value), 300);
    return () => clearTimeout(t);
  }, [value]);

  const offset = circumference * (1 - drawn / 100);
  const col =
    value >= 75 ? '#00ff88' :
    value >= 50 ? '#00d4ff' :
    value >= 30 ? '#ffd60a' : '#ff2d55';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 180, height: 180 }}>
      <svg width="180" height="180" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <circle
          cx="90" cy="90" r={r}
          fill="none"
          stroke={col}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 1.6s cubic-bezier(0.4,0,0.2,1)',
            filter: `drop-shadow(0 0 8px ${col})`,
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-3xl font-bold" style={{ color: col }}>
          {Math.round(drawn)}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-slate-500 mt-0.5">CMCI</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MENU SCREEN
// ═══════════════════════════════════════════════════════════════
function MenuScreen() {
  const { mode, setMode, startSession } = useGameStore();

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 overflow-y-auto">
      {/* Header */}
      <div className="text-center mb-8 animate-fade-up">
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="text-2xl animate-glow-pulse" style={{ color: '#00d4ff' }}>◈</span>
          <h1
            className="font-display text-2xl font-bold tracking-widest uppercase"
            style={{ color: '#00d4ff', textShadow: '0 0 20px #00d4ff55' }}
          >
            Neuro-Adapt
          </h1>
        </div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
          Cognitive-Motor Coupling Intelligence System
        </p>
      </div>

      {/* Mode cards */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-2xl mb-8">
        {MODES.map((m, i) => (
          <div
            key={m.id}
            className={`glass-card p-5 animate-fade-up delay-${(i + 1) * 100} ${mode === m.id ? 'selected' : ''}`}
            style={{ opacity: 0 }}
            onClick={() => setMode(m.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl" style={{ color: m.color }}>{m.icon}</span>
              <DiffPips n={m.difficulty} color={m.color} />
            </div>
            <h3
              className="font-display text-sm font-semibold mb-0.5"
              style={{ color: m.color }}
            >
              {m.label}
            </h3>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">{m.sub}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{m.desc}</p>
          </div>
        ))}

        {/* 5th card spans both columns */}
        <div
          className={`glass-card p-5 col-span-2 animate-fade-up delay-600 ${mode === 'dual-task' ? 'selected' : ''}`}
          style={{ opacity: 0 }}
          onClick={() => setMode('dual-task')}
        >
          {(() => {
            const m = MODES[4];
            return (
              <div className="flex items-center gap-6">
                <span className="text-3xl" style={{ color: m.color }}>{m.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-display text-sm font-semibold" style={{ color: m.color }}>
                      {m.label}
                    </h3>
                    <DiffPips n={m.difficulty} color={m.color} />
                  </div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{m.sub}</p>
                  <p className="text-xs text-slate-400">{m.desc}</p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Mini Games section */}
      <div className="w-full max-w-2xl mt-2 mb-6 animate-fade-up" style={{ opacity: 0, animationDelay: '0.65s' }}>
        <p className="text-[9px] uppercase tracking-[0.3em] text-slate-600 mb-3 font-display text-center">
          ── Mini Games ──
        </p>
        <div className="grid grid-cols-2 gap-3">
          {MODES.slice(5).map((m) => (
            <div
              key={m.id}
              className={`glass-card p-4 ${mode === m.id ? 'selected' : ''}`}
              onClick={() => setMode(m.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xl" style={{ color: m.color }}>{m.icon}</span>
                <DiffPips n={m.difficulty} color={m.color} />
              </div>
              <h3 className="font-display text-sm font-semibold mb-0.5" style={{ color: m.color }}>{m.label}</h3>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">{m.sub}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Rules + Start */}
      <div className="flex items-start gap-6 w-full max-w-2xl animate-fade-up delay-700" style={{ opacity: 0 }}>
        <div className="glass p-5 flex-1">
          <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-3 font-display">
            Default Rules
          </p>
          <RulesLegend />
        </div>
        <div className="flex flex-col items-center gap-3">
          <button className="btn-primary" onClick={() => { useMiniGameStore.getState().resetScore(); startSession(); }}>
            Initialise Session
          </button>
          <p className="text-[9px] text-slate-600 uppercase tracking-widest text-center">
            {MODES.find((m) => m.id === mode)?.label ?? ''} mode
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PLAYING HUD
// ═══════════════════════════════════════════════════════════════
function PlayingHUD() {
  const {
    mode, metrics, adaptive, timeLeft, fatigue,
    ruleSwitchAlert, endSession, tick,
    spawnSphere, registerInhibition, registerMiss,
    triggerRuleSwitch,
  } = useGameStore();

  const spawnTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switchTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameReadyRef  = useRef(false);
  const [countdown, setCountdown] = useState<number | null>(3);

  // Session countdown
  useEffect(() => {
    const id = setInterval(() => tick(100), 100);
    return () => clearInterval(id);
  }, [tick]);

  // 3-2-1-GO! countdown before spheres spawn
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setCountdown(2), 900));
    timers.push(setTimeout(() => setCountdown(1), 1800));
    timers.push(setTimeout(() => setCountdown(0), 2700));
    timers.push(setTimeout(() => { setCountdown(null); gameReadyRef.current = true; }, 3400));
    return () => timers.forEach(clearTimeout);
  }, []);

  // Keyboard controls: ← → arrows + Space
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (useGameStore.getState().phase !== 'playing') return;
      if (!gameReadyRef.current) return;
      const { activeSpheres, rules, registerInput } = useGameStore.getState();

      let action: SphereAction | null = null;
      if (e.key === 'ArrowLeft')  action = 'left';
      if (e.key === 'ArrowRight') action = 'right';
      if (e.key === ' ')          action = 'hold';
      if (!action) return;
      e.preventDefault();

      const target = activeSpheres.find(
        (s) => !s.isDistractor && s.color !== 'red' && rules[s.color] === action
      );
      if (target) {
        registerInput({
          sphereId: target.id,
          action,
          reactionTime: Date.now() - target.spawnTime,
          driftMagnitude: 0,
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sphere spawn loop
  useEffect(() => {
    const POSITIONS: [number, number, number][] = [
      [-2.8, 0.6, 0], [-1.4, -0.4, 0], [0, 0.7, 0], [1.4, -0.4, 0], [2.8, 0.6, 0],
    ];

    const WEIGHTS: Record<GameMode, number[]> = {
      'micro-reach':          [0.28, 0.28, 0.22, 0.22],
      'rule-switch':          [0.26, 0.26, 0.24, 0.24],
      'inhibition-conflict':  [0.22, 0.22, 0.38, 0.18],
      'micro-trajectory':     [0.30, 0.30, 0.18, 0.22],
      'dual-task':            [0.25, 0.25, 0.28, 0.22],
      'neural-grid':          [0.28, 0.28, 0.22, 0.22],
      'signal-trace':         [0.28, 0.28, 0.22, 0.22],
      'reflex-gate':          [0.28, 0.28, 0.22, 0.22],
      'cognitive-stack':      [0.28, 0.28, 0.22, 0.22],
    };

    const pickColor = (): SphereColor => {
      const colors: SphereColor[] = ['green', 'blue', 'red', 'yellow'];
      const w = WEIGHTS[mode];
      const r = Math.random();
      let acc = 0;
      for (let i = 0; i < colors.length; i++) {
        acc += w[i];
        if (r < acc) return colors[i];
      }
      return colors[0];
    };

    const spawn = () => {
      if (useGameStore.getState().phase !== 'playing') return;
      if (!gameReadyRef.current) { spawnTimer.current = setTimeout(spawn, 300); return; }
      const isConflict = mode === 'inhibition-conflict';
      const count = isConflict ? Math.floor(Math.random() * 2) + 2 : 1;

      const used = new Set<number>();
      for (let i = 0; i < count; i++) {
        let pi = Math.floor(Math.random() * POSITIONS.length);
        while (used.has(pi) && used.size < POSITIONS.length) {
          pi = Math.floor(Math.random() * POSITIONS.length);
        }
        used.add(pi);

        const id    = Math.random().toString(36).slice(2, 11);
        const color = pickColor();
        const isDistractor = isConflict && color !== 'red' && Math.random() < 0.25;

        spawnSphere({
          id, color,
          position: POSITIONS[pi],
          spawnTime: Date.now(),
          isDistractor,
        });

        // Auto-remove
        const lifetime = (color === 'red' ? 2200 : 3200) / adaptive.objectSpeed;
        setTimeout(() => {
          const state = useGameStore.getState();
          const still = state.activeSpheres.find((s) => s.id === id);
          if (!still) return;
          if (color === 'red') registerInhibition(id);
          else registerMiss(id);
        }, lifetime);
      }

      const jitter = 0.8 + Math.random() * 0.5;
      spawnTimer.current = setTimeout(spawn, adaptive.spawnDelay * jitter);
    };

    spawnTimer.current = setTimeout(spawn, 1000);
    return () => { if (spawnTimer.current) clearTimeout(spawnTimer.current); };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rule-switching (modes 2, 5)
  useEffect(() => {
    if (mode !== 'rule-switch' && mode !== 'dual-task') return;

    const schedule = () => {
      const delay = (7000 + Math.random() * 9000) / Math.max(0.3, adaptive.cognitiveLoad);
      switchTimer.current = setTimeout(() => {
        triggerRuleSwitch();
        schedule();
      }, delay);
    };

    const first = setTimeout(schedule, 12000);
    return () => {
      clearTimeout(first);
      if (switchTimer.current) clearTimeout(switchTimer.current);
    };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const mins = Math.floor(timeLeft / 60);
  const secs = Math.floor(timeLeft % 60);
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const pct = Math.round((timeLeft / 90) * 100);

  const totalR  = metrics.totalReactions;
  const accuracy = totalR > 0 ? Math.round((metrics.correctReactions / totalR) * 100) : 100;
  const avgRT    = metrics.reactionTimes.length
    ? Math.round(metrics.reactionTimes.slice(-5).reduce((a, b) => a + b, 0) /
        metrics.reactionTimes.slice(-5).length)
    : 0;

  const modeMeta = MODES.find((m) => m.id === mode)!;
  const diffLevel = Math.round(adaptive.cognitiveLoad * 5);

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {/* ── Top bar ── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-3">
        <div className="glass px-4 py-2.5 flex items-center gap-4">
          <span className="font-display text-xs tracking-widest" style={{ color: modeMeta.color }}>
            {modeMeta.icon} {modeMeta.label}
          </span>
          <span className="w-px h-4 bg-white/10" />
          <DiffPips n={diffLevel} color={modeMeta.color} />
        </div>

        {/* Timer */}
        <div className="glass px-5 py-2.5 flex flex-col items-center">
          <span
            className={`font-display text-lg font-bold tabular-nums ${timeLeft < 15 ? 'animate-glow-pulse' : ''}`}
            style={{ color: timeLeft < 15 ? '#ff2d55' : '#e2e8f0' }}
          >
            {timeStr}
          </span>
          <div className="w-full mt-1 metric-track" style={{ width: 80 }}>
            <div
              className="metric-fill"
              style={{
                width: `${pct}%`,
                background: timeLeft < 15
                  ? 'linear-gradient(90deg,#ff2d5588,#ff2d55)'
                  : 'linear-gradient(90deg,#00d4ff44,#00d4ff)',
              }}
            />
          </div>
        </div>

        {/* Stop */}
        <button
          className="pointer-events-auto glass px-4 py-2.5 flex items-center gap-2
                     text-slate-400 hover:text-white hover:border-white/20 transition-all
                     text-xs font-display tracking-widest uppercase"
          onClick={endSession}
        >
          <span className="text-base leading-none">■</span> Stop
        </button>
      </div>

      {/* ── Rules panel (bottom-left) ── */}
      <div className="absolute bottom-5 left-5 glass px-4 py-4 animate-fade-up">
        <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-3 font-display">
          {mode === 'rule-switch' || mode === 'dual-task' ? '⚠ Active Rules' : 'Rules'}
        </p>
        <RulesLegend compact />
      </div>

      {/* ── Live metrics (bottom-right) ── */}
      <div className="absolute bottom-5 right-5 glass px-5 py-4 min-w-[160px] animate-fade-up">
        <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-3 font-display">
          Live Metrics
        </p>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">Accuracy</span>
            <span
              className="font-mono text-sm font-bold"
              style={{ color: accuracy >= 80 ? '#00ff88' : accuracy >= 60 ? '#ffd60a' : '#ff2d55' }}
            >
              {accuracy}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">Avg RT</span>
            <span
              className="font-mono text-sm font-bold"
              style={{ color: avgRT > 0 && avgRT < 400 ? '#00ff88' : avgRT < 700 ? '#ffd60a' : '#ff2d55' }}
            >
              {avgRT > 0 ? `${avgRT}ms` : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">Reactions</span>
            <span className="font-mono text-sm font-bold text-slate-300">{totalR}</span>
          </div>
          {fatigue > 0.5 && (
            <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-[9px] text-yellow-400 uppercase tracking-widest">Fatigue detected</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Countdown overlay ── */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <span
            key={countdown}
            className="font-display font-black animate-fade-up"
            style={{
              fontSize: countdown === 0 ? '5rem' : '8rem',
              color: countdown === 0 ? '#00ff88' : '#00d4ff',
              textShadow: '0 0 40px currentColor, 0 0 80px currentColor',
              letterSpacing: '0.05em',
            }}
          >
            {countdown === 0 ? 'GO!' : countdown}
          </span>
        </div>
      )}

      {/* ── Rule-switch alert (top-center) ── */}
      {ruleSwitchAlert && (
        <div
          className="absolute top-20 left-1/2 animate-rule-flash z-20 pointer-events-none"
          style={{ transform: 'translateX(-50%)' }}
        >
          <div
            className="glass px-6 py-3 border flex flex-col items-center gap-2"
            style={{
              borderColor: 'rgba(255,45,85,0.5)',
              boxShadow: '0 0 30px rgba(255,45,85,0.2)',
            }}
          >
            <span className="font-display text-xs tracking-widest uppercase" style={{ color: '#ff2d55' }}>
              ⚡ Rules Changed
            </span>
            <RulesLegend compact />
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RESULTS SCREEN
// ═══════════════════════════════════════════════════════════════
const MINI_GAME_MODES = new Set(['neural-grid', 'signal-trace', 'reflex-gate', 'cognitive-stack']);

function ResultsScreen() {
  const { score, metrics, mode, setMode, startSession } = useGameStore();
  const miniScore  = useMiniGameStore((s) => s.score);
  const isMiniGame = MINI_GAME_MODES.has(mode);

  if (isMiniGame) {
    const modeMeta = MODES.find(m => m.id === mode)!;
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
        <div className="glass-panel p-8 w-full max-w-md animate-fade-up text-center">
          <p className="text-[9px] uppercase tracking-[0.3em] text-slate-500 mb-1 font-display">Session Complete</p>
          <h2 className="font-display text-xl font-bold text-white uppercase tracking-widest mb-8">{modeMeta.label}</h2>
          <div className="mb-8">
            <span className="font-display text-6xl font-black" style={{ color: modeMeta.color, textShadow: `0 0 30px ${modeMeta.color}` }}>
              {miniScore}
            </span>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-2">Final Score</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button className="btn-primary" onClick={() => { useMiniGameStore.getState().resetScore(); startSession(); }}>
              Play Again
            </button>
            <button
              className="btn-primary"
              style={{ color: '#94a3b8', borderColor: 'rgba(148,163,184,0.3)', background: 'rgba(148,163,184,0.05)' }}
              onClick={() => { setMode('micro-reach'); useGameStore.setState({ phase: 'menu', score: null }); }}
            >
              Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!score) return null;

  const totalR   = metrics.totalReactions;
  const accuracy = totalR > 0 ? Math.round(metrics.correctReactions / totalR * 100) : 0;
  const avgRT    = metrics.reactionTimes.length
    ? Math.round(metrics.reactionTimes.reduce((a, b) => a + b, 0) / metrics.reactionTimes.length)
    : 0;

  const insight =
    score.cmci >= 80 ? 'Exceptional coupling. Elite response profile.' :
    score.cmci >= 65 ? 'Strong performance. Consistent motor-cognitive link.' :
    score.cmci >= 50 ? 'Developing precision. Continue training for improvement.' :
    'Early stage. Focus on reducing errors before speed.';

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
      <div className="glass-panel p-8 w-full max-w-lg animate-fade-up">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-[9px] uppercase tracking-[0.3em] text-slate-500 mb-1 font-display">
            Session Complete
          </p>
          <h2 className="font-display text-xl font-bold text-white uppercase tracking-widest">
            Performance Report
          </h2>
        </div>

        {/* CMCI gauge + secondary stats */}
        <div className="flex items-center gap-8 mb-8">
          <CMCIGauge value={score.cmci} />
          <div className="flex-1 space-y-3">
            <div>
              <span className="text-[9px] uppercase tracking-widest text-slate-500">Reactions</span>
              <p className="font-mono text-lg font-bold text-white">{totalR}</p>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-widest text-slate-500">Accuracy</span>
              <p
                className="font-mono text-lg font-bold"
                style={{ color: accuracy >= 80 ? '#00ff88' : accuracy >= 60 ? '#ffd60a' : '#ff2d55' }}
              >
                {accuracy}%
              </p>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-widest text-slate-500">Avg Reaction</span>
              <p className="font-mono text-lg font-bold text-slate-200">
                {avgRT > 0 ? `${avgRT} ms` : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Metric bars */}
        <div className="border-t border-white/05 pt-6">
          <MetricBar label="Cognitive Stability"  value={score.cognitive}      color="#7b2fff" delay={0}   />
          <MetricBar label="Motor Execution"       value={score.motor}          color="#00d4ff" delay={150} />
          <MetricBar label="Error Correction"      value={score.errorCorrection} color="#00ff88" delay={300} />
        </div>

        {/* Insight */}
        <div
          className="mt-4 mb-6 px-4 py-3 rounded-lg text-xs text-slate-300 italic text-center"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          {insight}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <button className="btn-primary" onClick={startSession}>
            Retry {MODES.find((m) => m.id === mode)?.label}
          </button>
          <button
            className="btn-primary"
            style={{
              color: '#94a3b8',
              borderColor: 'rgba(148,163,184,0.3)',
              background: 'rgba(148,163,184,0.05)',
            }}
            onClick={() => {
              setMode('micro-reach');
              useGameStore.setState({ phase: 'menu', score: null });
            }}
          >
            Change Mode
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MINI GAME ROUTER
// ═══════════════════════════════════════════════════════════════
function MiniGameRouter() {
  const mode       = useGameStore((s) => s.mode);
  const endSession = useGameStore((s) => s.endSession);
  const miniScore  = useMiniGameStore((s) => s.score);

  return (
    <>
      {/* Top bar shared across all mini-games */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-5 py-3 pointer-events-none">
        <div className="glass px-4 py-2.5">
          <span className="font-display text-xs tracking-widest text-slate-300">
            {MODES.find(m => m.id === mode)?.icon} {MODES.find(m => m.id === mode)?.label}
          </span>
        </div>
        <div className="glass px-4 py-2.5">
          <span className="font-mono font-bold text-sm text-slate-200">{miniScore} pts</span>
        </div>
        <button
          className="pointer-events-auto glass px-4 py-2.5 text-slate-400 hover:text-white transition-all text-xs font-display tracking-widest uppercase"
          onClick={endSession}
        >
          ■ Stop
        </button>
      </div>

      {mode === 'neural-grid'      && <NeuralGrid />}
      {mode === 'signal-trace'     && <SignalTrace />}
      {mode === 'reflex-gate'      && <RefexGate />}
      {mode === 'cognitive-stack'  && <CognitiveStack />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT HUD ROUTER
// ═══════════════════════════════════════════════════════════════
export default function HUD() {
  const phase = useGameStore((s) => s.phase);
  const mode  = useGameStore((s) => s.mode);

  if (phase === 'menu')    return <MenuScreen />;
  if (phase === 'playing') {
    if (MINI_GAME_MODES.has(mode)) return <MiniGameRouter />;
    return <PlayingHUD />;
  }
  if (phase === 'results') return <ResultsScreen />;
  return null;
}
