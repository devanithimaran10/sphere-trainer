import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useMiniGameStore } from '../../store/useMiniGameStore';

const SYMBOLS = [
  { sym: '◈', color: '#00d4ff' },
  { sym: '⟳', color: '#7b2fff' },
  { sym: '↗', color: '#00ff88' },
  { sym: '⊗', color: '#ffd60a' },
  { sym: '△', color: '#ff2d55' },
  { sym: '◎', color: '#ff9500' },
];

interface Card { id: number; symIdx: number; flipped: boolean; matched: boolean; }

function makeCards(): Card[] {
  const deck = [...SYMBOLS, ...SYMBOLS].map((_, i) => ({
    id: i, symIdx: i % SYMBOLS.length, flipped: false, matched: false,
  }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export default function CognitiveStack() {
  const { addScore }   = useMiniGameStore();
  const endSession     = useGameStore((s) => s.endSession);

  const [round,     setRound]     = useState(1);
  const [cards,     setCards]     = useState<Card[]>(makeCards);
  const [flipped,   setFlipped]   = useState<number[]>([]);
  const [locked,    setLocked]    = useState(false);
  const [matched,   setMatched]   = useState(0);
  const [timeLeft,  setTimeLeft]  = useState(100);
  const [status,    setStatus]    = useState<'playing'|'success'|'fail'>('playing');
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([]);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  const kill = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    if (interval.current) { clearInterval(interval.current); interval.current = null; }
  };

  const startRound = useCallback((rnd: number) => {
    kill();
    const timeMs = Math.max(12000, 30000 - rnd * 3000);
    setCards(makeCards());
    setFlipped([]);
    setLocked(false);
    setMatched(0);
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
        timers.current.push(setTimeout(() => endSession(), 1000));
      }
    }, 80);
  }, [endSession]);

  useEffect(() => {
    timers.current.push(setTimeout(() => startRound(1), 400));
    return kill;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const flip = useCallback((cardId: number) => {
    if (locked || status !== 'playing') return;
    const card = cards.find(c => c.id === cardId);
    if (!card || card.flipped || card.matched) return;
    if (flipped.length === 1 && flipped[0] === cardId) return;

    const newFlipped = [...flipped, cardId];
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, flipped: true } : c));
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setLocked(true);
      const [a, b] = newFlipped.map(id => cards.find(c => c.id === id)!);
      if (a.symIdx === b.symIdx) {
        timers.current.push(setTimeout(() => {
          setCards(prev => prev.map(c =>
            newFlipped.includes(c.id) ? { ...c, matched: true, flipped: true } : c
          ));
          const newMatched = matched + 1;
          setMatched(newMatched);
          setFlipped([]);
          setLocked(false);
          if (newMatched === SYMBOLS.length) {
            kill();
            addScore(500 * round + Math.round(timeLeft * 5));
            setStatus('success');
            timers.current.push(setTimeout(() => {
              const nr = round + 1;
              setRound(nr);
              startRound(nr);
            }, 1000));
          }
        }, 400));
      } else {
        timers.current.push(setTimeout(() => {
          setCards(prev => prev.map(c =>
            newFlipped.includes(c.id) ? { ...c, flipped: false } : c
          ));
          setFlipped([]);
          setLocked(false);
        }, 900));
      }
    }
  }, [locked, status, cards, flipped, matched, round, timeLeft, addScore, startRound]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-auto select-none">
      <div className="mb-4 flex items-center gap-8">
        <span className="font-display text-xs text-slate-500 uppercase tracking-widest">Round {round}</span>
        <span className="font-display text-xs uppercase tracking-widest" style={{
          color: status === 'success' ? '#00ff88' : status === 'fail' ? '#ff2d55' : '#00d4ff'
        }}>
          {status === 'success' ? '✓ Complete!' : status === 'fail' ? '✕ Time Up!' : `${matched} / ${SYMBOLS.length} pairs`}
        </span>
      </div>

      {/* Timer bar */}
      <div style={{ width: 480, marginBottom: 16 }}>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            width: `${timeLeft}%`,
            background: timeLeft > 50 ? '#00d4ff' : timeLeft > 25 ? '#ffd60a' : '#ff2d55',
            transition: 'width 0.08s linear, background 0.3s',
          }} />
        </div>
      </div>

      {/* Card grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 100px)', gap: 10 }}>
        {cards.map(card => {
          const sym = SYMBOLS[card.symIdx];
          return (
            <div
              key={card.id}
              onClick={() => flip(card.id)}
              style={{
                width: 100, height: 110,
                perspective: '600px',
                cursor: !card.flipped && !card.matched ? 'pointer' : 'default',
              }}
            >
              <div style={{
                width: '100%', height: '100%',
                position: 'relative',
                transformStyle: 'preserve-3d',
                transform: card.flipped || card.matched ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transition: 'transform 0.38s ease',
              }}>
                {/* Back face */}
                <div style={{
                  position: 'absolute', inset: 0,
                  backfaceVisibility: 'hidden',
                  background: 'rgba(10,12,24,0.88)',
                  border: '1px solid rgba(0,212,255,0.12)',
                  borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 24, color: 'rgba(0,212,255,0.25)' }}>◈</span>
                </div>
                {/* Front face */}
                <div style={{
                  position: 'absolute', inset: 0,
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: card.matched ? `${sym.color}18` : 'rgba(16,18,32,0.95)',
                  border: `1px solid ${card.matched ? sym.color : `${sym.color}55`}`,
                  borderRadius: 12,
                  boxShadow: card.matched ? `0 0 20px ${sym.color}44` : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'box-shadow 0.3s',
                }}>
                  <span style={{ fontSize: 32, color: sym.color, textShadow: card.matched ? `0 0 12px ${sym.color}` : 'none' }}>
                    {sym.sym}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
