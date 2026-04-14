import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useMiniGameStore } from '../../store/useMiniGameStore';

const GATE_COLORS = [
  { id: 'cyan',   hex: '#00d4ff', label: 'CYAN'   },
  { id: 'green',  hex: '#00ff88', label: 'GREEN'  },
  { id: 'red',    hex: '#ff2d55', label: 'RED'    },
  { id: 'yellow', hex: '#ffd60a', label: 'YELLOW' },
] as const;
type GateId = typeof GATE_COLORS[number]['id'];

interface GateState {
  open: boolean;
  openDuration: number;
  closeDuration: number;
  phase: 'open' | 'closing' | 'closed' | 'opening';
}

export default function RefexGate() {
  const { addScore }   = useMiniGameStore();
  const endSession     = useGameStore((s) => s.endSession);

  const [round,    setRound]   = useState(1);
  const [lives,    setLives]   = useState(3);
  const [target,   setTarget]  = useState<GateId>('cyan');
  const [gates,    setGates]   = useState<Record<GateId, GateState>>(() => ({
    cyan:   { open: false, openDuration: 1800, closeDuration: 1200, phase: 'closed' },
    green:  { open: false, openDuration: 1400, closeDuration: 1600, phase: 'closed' },
    red:    { open: false, openDuration: 1600, closeDuration: 1000, phase: 'closed' },
    yellow: { open: false, openDuration: 1200, closeDuration: 1800, phase: 'closed' },
  }));
  const [feedback, setFeedback] = useState<'none' | 'hit' | 'miss'>('none');
  const [score,    setScore2]   = useState(0);
  const gateTimers = useRef<Record<GateId, ReturnType<typeof setTimeout> | null>>({
    cyan: null, green: null, red: null, yellow: null,
  });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const killGate = (id: GateId) => {
    if (gateTimers.current[id]) { clearTimeout(gateTimers.current[id]!); gateTimers.current[id] = null; }
  };
  const killAll = () => {
    (['cyan','green','red','yellow'] as GateId[]).forEach(killGate);
    timers.current.forEach(clearTimeout); timers.current = [];
  };

  const cycleGate = useCallback((id: GateId, speedMul: number) => {
    const baseOpen  = { cyan: 1800, green: 1400, red: 1600, yellow: 1200 }[id];
    const baseClose = { cyan: 1200, green: 1600, red: 1000, yellow: 1800 }[id];
    const od = Math.max(600, baseOpen  / speedMul);
    const cd = Math.max(400, baseClose / speedMul);

    setGates(prev => ({ ...prev, [id]: { ...prev[id], open: true,  phase: 'open',   openDuration: od, closeDuration: cd } }));
    gateTimers.current[id] = setTimeout(() => {
      setGates(prev => ({ ...prev, [id]: { ...prev[id], open: false, phase: 'closed' } }));
      gateTimers.current[id] = setTimeout(() => cycleGate(id, speedMul), cd);
    }, od);
  }, []);

  const pickTarget = () => GATE_COLORS[Math.floor(Math.random() * GATE_COLORS.length)].id as GateId;

  useEffect(() => {
    const speedMul = 1 + (round - 1) * 0.18;
    const t = setTimeout(() => {
      setTarget(pickTarget());
      (['cyan','green','red','yellow'] as GateId[]).forEach((id, i) => {
        timers.current.push(setTimeout(() => cycleGate(id, speedMul), i * 220));
      });
    }, 600);
    timers.current.push(t);
    return killAll;
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = useCallback((id: GateId) => {
    if (feedback !== 'none') return;
    if (id !== target) {
      setFeedback('miss');
      const nl = lives - 1;
      setLives(nl);
      timers.current.push(setTimeout(() => {
        setFeedback('none');
        if (nl <= 0) endSession();
        else setTarget(pickTarget());
      }, 700));
      return;
    }
    if (!gates[id].open) {
      setFeedback('miss');
      const nl = lives - 1;
      setLives(nl);
      timers.current.push(setTimeout(() => {
        setFeedback('none');
        if (nl <= 0) endSession();
        else setTarget(pickTarget());
      }, 700));
      return;
    }
    const pts = 150 + Math.round((gates[id].openDuration / 1800) * 100);
    addScore(pts);
    setScore2(s => s + pts);
    setFeedback('hit');
    timers.current.push(setTimeout(() => {
      setFeedback('none');
      setRound(r => r + 1);
    }, 700));
  }, [feedback, target, gates, lives, addScore, endSession]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); press(target); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [press, target]);

  const targetMeta = GATE_COLORS.find(g => g.id === target)!;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-auto select-none">
      {/* Lives + score */}
      <div className="mb-6 flex items-center gap-8">
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <span key={i} style={{ fontSize: 22, color: i < lives ? '#ff2d55' : 'rgba(255,255,255,0.1)' }}>♥</span>
          ))}
        </div>
        <span className="font-display text-xs text-slate-500 uppercase tracking-widest">Round {round}</span>
        <span className="font-mono font-bold text-sm" style={{ color: '#00d4ff' }}>{score} pts</span>
      </div>

      {/* Target prompt */}
      <div
        className="glass mb-8 px-8 py-4 text-center"
        style={{
          borderColor: `${targetMeta.hex}55`,
          boxShadow: feedback === 'hit' ? `0 0 40px ${targetMeta.hex}44` : feedback === 'miss' ? '0 0 40px #ff2d5544' : 'none',
          transition: 'box-shadow 0.3s',
        }}
      >
        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Press When Open</p>
        <p className="font-display text-xl font-bold tracking-widest" style={{ color: targetMeta.hex }}>
          {feedback === 'hit' ? '✓ HIT!' : feedback === 'miss' ? '✕ MISS' : `→ ${targetMeta.label}`}
        </p>
        <p className="text-[9px] text-slate-600 mt-1 uppercase tracking-widest">Space or click gate</p>
      </div>

      {/* Gates */}
      <div className="flex gap-5">
        {GATE_COLORS.map(({ id, hex, label }) => {
          const g = gates[id];
          const isTarget = id === target;
          const openPct  = g.open ? 1 : 0;
          return (
            <button
              key={id}
              onClick={() => press(id)}
              style={{
                width: 90, height: 130,
                borderRadius: 16,
                background: g.open ? `${hex}18` : 'rgba(255,255,255,0.02)',
                border: `2px solid ${g.open ? hex : 'rgba(255,255,255,0.08)'}`,
                boxShadow: g.open
                  ? `0 0 30px ${hex}66, inset 0 0 20px ${hex}22`
                  : 'none',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.25s ease',
                transform: g.open ? 'scale(1.06)' : 'scale(1)',
                position: 'relative', overflow: 'hidden',
                opacity: openPct === 0 ? 0.4 : 1,
              }}
            >
              {/* Portal ring */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                border: `3px solid ${g.open ? hex : 'rgba(255,255,255,0.12)'}`,
                boxShadow: g.open ? `0 0 16px ${hex}` : 'none',
                transition: 'all 0.25s',
              }} />
              <span className="font-display" style={{ fontSize: 9, color: g.open ? hex : '#475569', letterSpacing: '0.1em' }}>{label}</span>
              {isTarget && (
                <div style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 8, height: 8, borderRadius: '50%',
                  background: hex, boxShadow: `0 0 6px ${hex}`,
                  animation: 'pulse 1s infinite',
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
