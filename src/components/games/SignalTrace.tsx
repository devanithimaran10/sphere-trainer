import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useMiniGameStore } from '../../store/useMiniGameStore';

const W = 520;
const H = 380;

interface Node { x: number; y: number; id: number; }

function generateNodes(count: number): Node[] {
  const nodes: Node[] = [];
  const minDist = 85;
  let attempts = 0;
  while (nodes.length < count && attempts < 400) {
    attempts++;
    const x = 55 + Math.random() * (W - 110);
    const y = 55 + Math.random() * (H - 110);
    const ok = nodes.every(n => Math.hypot(n.x - x, n.y - y) >= minDist);
    if (ok) nodes.push({ x, y, id: nodes.length + 1 });
  }
  return nodes;
}

type NodeState = 'idle' | 'active' | 'done' | 'wrong';

export default function SignalTrace() {
  const { addScore }  = useMiniGameStore();
  const endSession    = useGameStore((s) => s.endSession);

  const [round,      setRound]      = useState(1);
  const [lives,      setLives]      = useState(3);
  const [nodes,      setNodes]      = useState<Node[]>([]);
  const [states,     setStates]     = useState<NodeState[]>([]);
  const [nextTarget, setNextTarget] = useState(1);
  const [timeLeft,   setTimeLeft]   = useState(100); // 0-100 %
  const [status,     setStatus]     = useState<'playing'|'success'|'fail'>('playing');
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([]);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  const kill = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    if (interval.current) { clearInterval(interval.current); interval.current = null; }
  };

  const startRound = useCallback((rnd: number) => {
    kill();
    const count = Math.min(4 + rnd, 10);
    const ns    = generateNodes(count);
    const timeMs = Math.max(4000, 9000 - rnd * 600);
    setNodes(ns);
    setStates(Array(ns.length).fill('idle'));
    setNextTarget(1);
    setTimeLeft(100);
    setStatus('playing');

    const start = Date.now();
    interval.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / timeMs) * 100);
      setTimeLeft(pct);
      if (pct <= 0) {
        clearInterval(interval.current!);
        setStatus('fail');
        timers.current.push(setTimeout(() => {
          const nl = lives - 1;
          setLives(nl);
          if (nl <= 0) endSession();
          else startRound(rnd);
        }, 1000));
      }
    }, 50);
  }, [lives, endSession]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    timers.current.push(setTimeout(() => startRound(1), 500));
    return kill;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tapNode = useCallback((nodeId: number) => {
    if (status !== 'playing') return;
    if (nodeId === nextTarget) {
      setStates(prev => { const n = [...prev]; n[nodeId - 1] = 'done'; return n; });
      if (nodeId === nodes.length) {
        kill();
        setStatus('success');
        addScore(200 * round);
        timers.current.push(setTimeout(() => {
          const nr = round + 1;
          setRound(nr);
          startRound(nr);
        }, 900));
      } else {
        setNextTarget(nodeId + 1);
        setStates(prev => { const n = [...prev]; n[nodeId - 1] = 'done'; n[nodeId] = 'active'; return n; });
      }
    } else {
      setStates(prev => { const n = [...prev]; n[nodeId - 1] = 'wrong'; return n; });
      timers.current.push(setTimeout(() =>
        setStates(prev => { const n = [...prev]; n[nodeId - 1] = 'idle'; return n; }), 350));
    }
  }, [status, nextTarget, nodes.length, round, addScore, startRound]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (nodes.length > 0 && status === 'playing') {
      setStates(prev => { const n = [...prev]; if (n[0] !== 'done') n[0] = 'active'; return n; });
    }
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const nodeColor = (s: NodeState) =>
    s === 'done' ? '#00ff88' : s === 'active' ? '#00d4ff' : s === 'wrong' ? '#ff2d55' : 'rgba(255,255,255,0.15)';
  const nodeShadow = (s: NodeState) =>
    s === 'done' ? '0 0 16px #00ff88' : s === 'active' ? '0 0 20px #00d4ff' : s === 'wrong' ? '0 0 16px #ff2d55' : 'none';

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-auto select-none">
      <div className="mb-4 flex items-center gap-8">
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <span key={i} style={{ fontSize: 22, color: i < lives ? '#ff2d55' : 'rgba(255,255,255,0.1)' }}>♥</span>
          ))}
        </div>
        <span className="font-display text-xs text-slate-500 uppercase tracking-widest">Round {round}</span>
        <span className="font-display text-xs uppercase tracking-widest" style={{
          color: status === 'success' ? '#00ff88' : status === 'fail' ? '#ff2d55' : '#00d4ff'
        }}>
          {status === 'success' ? '✓ Traced!' : status === 'fail' ? '✕ Too slow!' : `Tap → ${nextTarget}`}
        </span>
      </div>

      {/* Timer bar */}
      <div style={{ width: W, marginBottom: 12 }}>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            width: `${timeLeft}%`,
            background: timeLeft > 50 ? '#00d4ff' : timeLeft > 25 ? '#ffd60a' : '#ff2d55',
            boxShadow: `0 0 8px currentColor`,
            transition: 'width 0.05s linear, background 0.3s',
          }} />
        </div>
      </div>

      {/* SVG canvas */}
      <div style={{ position: 'relative', width: W, height: H, background: 'rgba(0,0,0,0.25)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
        <svg style={{ position: 'absolute', inset: 0 }} width={W} height={H}>
          {/* Path lines */}
          {nodes.slice(0, -1).map((n, i) => {
            const next = nodes[i + 1];
            const done = states[i] === 'done';
            return (
              <line key={i}
                x1={n.x} y1={n.y} x2={next.x} y2={next.y}
                stroke={done ? '#00ff8844' : 'rgba(255,255,255,0.08)'}
                strokeWidth={2}
                strokeDasharray="6 4"
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((n, i) => {
          const s = states[i] || 'idle';
          return (
            <button
              key={n.id}
              onClick={() => tapNode(n.id)}
              style={{
                position: 'absolute',
                left: n.x - 22, top: n.y - 22,
                width: 44, height: 44,
                borderRadius: '50%',
                background: nodeColor(s) === 'rgba(255,255,255,0.15)' ? 'rgba(255,255,255,0.05)' : `${nodeColor(s)}22`,
                border: `2px solid ${nodeColor(s)}`,
                boxShadow: nodeShadow(s),
                color: s === 'done' ? '#00ff88' : s === 'active' ? '#00d4ff' : '#94a3b8',
                fontFamily: 'Orbitron, monospace',
                fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {s === 'done' ? '✓' : n.id}
            </button>
          );
        })}
      </div>
    </div>
  );
}
