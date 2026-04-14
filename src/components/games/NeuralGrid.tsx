import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useMiniGameStore } from '../../store/useMiniGameStore';

const COLS = 4;
const ROWS = 4;
const TOTAL = COLS * ROWS;
type TileState = 'idle' | 'active' | 'correct' | 'wrong';
type Phase = 'ready' | 'watch' | 'input' | 'success' | 'fail';

export default function NeuralGrid() {
  const { addScore } = useMiniGameStore();
  const endSession    = useGameStore((s) => s.endSession);

  const [level,    setLevel]    = useState(1);
  const [lives,    setLives]    = useState(3);
  const [phase,    setPhase]    = useState<Phase>('ready');
  const [pattern,  setPattern]  = useState<number[]>([]);
  const [inputted, setInputted] = useState<number[]>([]);
  const [tiles,    setTiles]    = useState<TileState[]>(Array(TOTAL).fill('idle'));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const kill = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const setTile = useCallback((i: number, s: TileState) =>
    setTiles(prev => { const n = [...prev]; n[i] = s; return n; }), []);

  const genPattern = (len: number): number[] => {
    const p: number[] = []; let last = -1;
    while (p.length < len) {
      const t = Math.floor(Math.random() * TOTAL);
      if (t !== last) { p.push(t); last = t; }
    }
    return p;
  };

  const playPattern = useCallback((pat: number[], speed: number) => {
    kill();
    setPhase('watch');
    setTiles(Array(TOTAL).fill('idle'));
    pat.forEach((t, i) => {
      timers.current.push(setTimeout(() => setTile(t, 'active'),             i * speed));
      timers.current.push(setTimeout(() => {
        setTile(t, 'idle');
        if (i === pat.length - 1) { setPhase('input'); setInputted([]); }
      }, i * speed + speed * 0.65));
    });
  }, [setTile]); // eslint-disable-line react-hooks/exhaustive-deps

  const startLevel = useCallback((lv: number) => {
    const len   = Math.min(2 + lv, 11);
    const speed = Math.max(320, 640 - lv * 28);
    const pat   = genPattern(len);
    setPattern(pat);
    setInputted([]);
    timers.current.push(setTimeout(() => playPattern(pat, speed), 600));
  }, [playPattern]);

  useEffect(() => {
    timers.current.push(setTimeout(() => startLevel(1), 800));
    return kill;
  }, [startLevel]);

  const tap = useCallback((idx: number) => {
    if (phase !== 'input') return;
    const expected = pattern[inputted.length];
    if (idx === expected) {
      setTile(idx, 'correct');
      timers.current.push(setTimeout(() => setTile(idx, 'idle'), 260));
      const next = [...inputted, idx];
      if (next.length === pattern.length) {
        setPhase('success');
        addScore(100 * level);
        timers.current.push(setTimeout(() => {
          const nlv = level + 1;
          setLevel(nlv);
          startLevel(nlv);
        }, 900));
      } else {
        setInputted(next);
      }
    } else {
      setTile(idx, 'wrong');
      setPhase('fail');
      const nl = lives - 1;
      setLives(nl);
      timers.current.push(setTimeout(() => {
        setTiles(Array(TOTAL).fill('idle'));
        if (nl <= 0) endSession();
        else startLevel(level);
      }, 1000));
    }
  }, [phase, pattern, inputted, level, lives, addScore, endSession, setTile, startLevel]);

  const st = (s: TileState) => {
    const m: Record<TileState, { bg: string; border: string; shadow: string }> = {
      active:  { bg: 'rgba(0,212,255,0.38)',  border: '#00d4ff', shadow: '0 0 24px #00d4ff, 0 0 48px #00d4ff44' },
      correct: { bg: 'rgba(0,255,136,0.38)',  border: '#00ff88', shadow: '0 0 24px #00ff88' },
      wrong:   { bg: 'rgba(255,45,85,0.42)',  border: '#ff2d55', shadow: '0 0 24px #ff2d55' },
      idle:    { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)', shadow: 'none' },
    };
    return m[s] ?? m.idle;
  };

  const phaseColor = phase === 'watch' ? '#00d4ff' : phase === 'input' ? '#00ff88' : phase === 'success' ? '#00ff88' : phase === 'fail' ? '#ff2d55' : '#94a3b8';
  const phaseLabel = phase === 'watch' ? 'Memorise...' : phase === 'input' ? `${inputted.length} / ${pattern.length}` : phase === 'success' ? '✓ Perfect!' : phase === 'fail' ? '✕ Wrong!' : 'Get Ready';

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-auto select-none">
      <div className="mb-6 flex items-center gap-8">
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <span key={i} style={{ fontSize: 22, color: i < lives ? '#ff2d55' : 'rgba(255,255,255,0.1)' }}>♥</span>
          ))}
        </div>
        <span className="font-display text-xs text-slate-500 uppercase tracking-widest">Level {level}</span>
        <span className="font-display text-xs uppercase tracking-widest transition-all" style={{ color: phaseColor }}>{phaseLabel}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 72px)`, gap: 10 }}>
        {tiles.map((s, i) => {
          const style = st(s);
          return (
            <button
              key={i}
              onClick={() => tap(i)}
              style={{
                width: 72, height: 72,
                background: style.bg,
                border: `1px solid ${style.border}`,
                boxShadow: style.shadow,
                borderRadius: 14,
                cursor: phase === 'input' ? 'pointer' : 'default',
                transition: 'background 0.15s, box-shadow 0.15s, border-color 0.15s',
              }}
            />
          );
        })}
      </div>

      <div className="mt-5 flex gap-2">
        {pattern.map((_, i) => (
          <span key={i} style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: i < inputted.length ? '#00ff88' : 'rgba(255,255,255,0.12)',
            boxShadow: i < inputted.length ? '0 0 6px #00ff88' : 'none',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>
    </div>
  );
}
