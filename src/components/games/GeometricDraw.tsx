import { useState, useEffect, useCallback, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useMiniGameStore } from '../../store/useMiniGameStore';
import { Settings, Play, Trash2, Undo2, Layers, CircleDot, Brain, Sparkles, Timer, RotateCcw, Eye, EyeOff } from 'lucide-react';

// ─── Interfaces & Presets ─────────────────────────────────────
interface KolamPattern {
  id: string;
  name: string;
  gridSize: number;
  gridType: 'square' | 'diamond';
  kolamType: 'kambi' | 'sikku';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  path: [number, number][]; // coordinates in double-resolution grid space
}

const PRESET_PATTERNS: KolamPattern[] = [
  // ──── 5x5 GRIDS ────
  {
    id: 'kambi-5x5-star',
    name: 'Saraswathi Star',
    gridSize: 5,
    gridType: 'square',
    kolamType: 'kambi',
    difficulty: 'Easy',
    description: 'A classic 5-pointed star motif drawn by connecting peripheral dots directly.',
    path: [
      [0, 4], [4, 8], [8, 4], [4, 0], [0, 4], // Outer loop
      [2, 2], [2, 6], [6, 6], [6, 2], [2, 2]  // Inner square
    ]
  },
  {
    id: 'sikku-5x5-infinity',
    name: 'Infinity Braid',
    gridSize: 5,
    gridType: 'square',
    kolamType: 'sikku',
    difficulty: 'Medium',
    description: 'A single looping line that twists around the center dot and outer edges in an infinity loop.',
    path: [
      [1, 4], [2, 3], [3, 4], [4, 3], [3, 2], [4, 1], [3, 0], [2, 1], [1, 0], [0, 1], [1, 2], [0, 3], [1, 4]
    ]
  },
  {
    id: 'sikku-5x5-braid',
    name: 'Lotus Core',
    gridSize: 5,
    gridType: 'square',
    kolamType: 'sikku',
    difficulty: 'Medium',
    description: 'A beautiful traditional braided pattern weaving perfectly around a 5x5 dot matrix.',
    path: [
      [1, 2], [2, 3], [3, 2], [2, 1], [1, 2], // Center loop around (2,2)
      [0, 4], [2, 6], [4, 4], [2, 2], [0, 4], // Top diamond weave
      [4, 4], [6, 6], [8, 4], [6, 2], [4, 4]  // Bottom diamond weave
    ]
  },

  // ──── 7x7 GRIDS ────
  {
    id: 'kambi-7x7-mandala',
    name: 'Temple Mandala',
    gridSize: 7,
    gridType: 'square',
    kolamType: 'kambi',
    difficulty: 'Medium',
    description: 'An interlocking square and diamond structure representing energy gates.',
    path: [
      [0, 6], [6, 12], [12, 6], [6, 0], [0, 6], // Outer Diamond
      [2, 2], [2, 10], [10, 10], [10, 2], [2, 2], // Middle Square
      [4, 4], [4, 8], [8, 8], [8, 4], [4, 4]   // Inner Square
    ]
  },
  {
    id: 'sikku-7x7-lotus',
    name: 'Sikku Lotus',
    gridSize: 7,
    gridType: 'square',
    kolamType: 'sikku',
    difficulty: 'Hard',
    description: 'A complex, high-difficulty braided motif resembling a blossoming temple lotus.',
    path: [
      [1, 6], [2, 5], [3, 6], [4, 7], [5, 6], [4, 5], [3, 4], [2, 3], [1, 4], [2, 5], 
      [3, 6], [4, 5], [5, 4], [6, 5], [7, 6], [6, 7], [5, 8], [4, 9], [3, 8], [2, 7], [1, 6]
    ]
  },

  // ──── DIAMOND GRIDS ────
  {
    id: 'kambi-diamond-5',
    name: 'Traditional Pookalam',
    gridSize: 5, // 5-3-1 Diamond formation
    gridType: 'diamond',
    kolamType: 'kambi',
    difficulty: 'Easy',
    description: 'A basic diamond-shaped floor drawing made with simple connecting strokes.',
    path: [
      [0, 2], [2, 4], [4, 2], [2, 0], [0, 2]
    ]
  },
  {
    id: 'sikku-diamond-9',
    name: 'Knot of Fortune',
    gridSize: 9, // 9-7-5-3-1 Diamond
    gridType: 'diamond',
    kolamType: 'sikku',
    difficulty: 'Hard',
    description: 'A traditional Sikku Kolam with complex, looping knot art wrapping symmetrical diamond lines.',
    path: [
      [1, 8], [3, 6], [5, 4], [7, 6], [9, 8], [7, 10], [5, 12], [3, 10], [1, 8],
      [3, 8], [4, 7], [5, 8], [6, 9], [5, 10], [4, 9], [3, 8]
    ]
  }
];

// ─── Mathematical Helpers ─────────────────────────────────────
interface Point {
  x: number;
  y: number;
}

function gridToPixel(
  gridY: number,
  gridX: number,
  gridSize: number,
  gridType: 'square' | 'diamond',
  canvasWidth: number,
  canvasHeight: number,
  padding: number = 45
): Point {
  const innerWidth = canvasWidth - 2 * padding;
  const innerHeight = canvasHeight - 2 * padding;

  if (gridType === 'diamond') {
    const cy = canvasHeight / 2;
    const cx = canvasWidth / 2;
    const maxVal = 2 * gridSize - 2;
    const ny = (gridY - maxVal / 2) / (maxVal / 2);
    const nx = (gridX - maxVal / 2) / (maxVal / 2);

    const rX = (nx - ny) * (innerWidth / 2) * 0.95;
    const rY = (nx + ny) * (innerHeight / 2) * 0.95;

    return { x: cx + rX, y: cy + rY };
  } else {
    const spacingX = innerWidth / (2 * gridSize - 2);
    const spacingY = innerHeight / (2 * gridSize - 2);
    return {
      x: padding + gridX * spacingX,
      y: padding + gridY * spacingY
    };
  }
}

function isPointInDiamond(r: number, c: number, size: number): boolean {
  const center = (size - 1) / 2;
  return Math.abs(r - center) + Math.abs(c - center) <= center;
}

interface GridDot {
  id: string;
  gridY: number;
  gridX: number;
}

function generateDots(size: number, type: 'square' | 'diamond'): GridDot[] {
  const dots: GridDot[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (type === 'diamond' && !isPointInDiamond(r, c, size)) {
        continue;
      }
      dots.push({
        id: `${r}-${c}`,
        gridY: r * 2,
        gridX: c * 2
      });
    }
  }
  return dots;
}

interface Waypoint {
  gridY: number;
  gridX: number;
  isDot: boolean;
}

function generateWaypoints(size: number, type: 'square' | 'diamond'): Waypoint[] {
  const waypoints: Waypoint[] = [];
  const doubleSize = size * 2 - 1;

  for (let y = 0; y < doubleSize; y++) {
    for (let x = 0; x < doubleSize; x++) {
      const isEvenY = y % 2 === 0;
      const isEvenX = x % 2 === 0;
      const isDot = isEvenY && isEvenX;

      if (type === 'diamond') {
        const origR = y / 2;
        const origC = x / 2;
        const center = (size - 1) / 2;
        if (Math.abs(origR - center) + Math.abs(origC - center) > center + 0.6) {
          continue;
        }
      }
      
      waypoints.push({ gridY: y, gridX: x, isDot });
    }
  }
  return waypoints;
}

function findClosestWaypoint(
  mx: number,
  my: number,
  waypointsList: Waypoint[],
  gridSize: number,
  gridType: 'square' | 'diamond',
  canvasWidth: number,
  canvasHeight: number,
  snapRadius: number = 32
): Waypoint | null {
  let closest: Waypoint | null = null;
  let minDist = Infinity;

  for (const wp of waypointsList) {
    const pt = gridToPixel(wp.gridY, wp.gridX, gridSize, gridType, canvasWidth, canvasHeight);
    const dist = Math.hypot(mx - pt.x, my - pt.y);

    if (dist < snapRadius && dist < minDist) {
      minDist = dist;
      closest = wp;
    }
  }

  return closest;
}

function drawSmoothSpline(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  glowColor: string = 'rgba(255,255,255,0.85)',
  lineWidth: number = 4
) {
  if (points.length < 2) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  ctx.strokeStyle = '#fafaf9';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 8;
  ctx.lineWidth = lineWidth;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
  } else {
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  }

  ctx.stroke();
  ctx.restore();
}

interface ScoringMetrics {
  precision: number;
  correctSegments: number;
  totalSegments: number;
  incorrectStrokes: number;
  timeTaken: number;
}

function validateDrawing(
  userPath: [number, number][],
  templatePath: [number, number][],
  timeTakenSeconds: number,
  incorrectStrokesCount: number
): ScoringMetrics {
  const total = templatePath.length;
  if (userPath.length === 0) {
    return { precision: 0, correctSegments: 0, totalSegments: total, incorrectStrokes: incorrectStrokesCount, timeTaken: timeTakenSeconds };
  }

  const userStr = userPath.map(([y, x]) => `${y},${x}`);

  let correctCount = 0;

  const tempSegments = new Set<string>();
  for (let i = 0; i < templatePath.length - 1; i++) {
    const s1 = `${templatePath[i][0]},${templatePath[i][1]}`;
    const s2 = `${templatePath[i+1][0]},${templatePath[i+1][1]}`;
    tempSegments.add(`${s1}->${s2}`);
    tempSegments.add(`${s2}->${s1}`);
  }

  const matchedUserSegments = new Set<string>();
  for (let i = 0; i < userPath.length - 1; i++) {
    const s1 = userStr[i];
    const s2 = userStr[i+1];
    const segStr = `${s1}->${s2}`;
    
    if (tempSegments.has(segStr) && !matchedUserSegments.has(segStr) && !matchedUserSegments.has(`${s2}->${s1}`)) {
      correctCount++;
      matchedUserSegments.add(segStr);
    }
  }

  const totalSegments = templatePath.length - 1;
  const rawAccuracy = totalSegments > 0 ? correctCount / totalSegments : 0;

  const strokePenalty = Math.min(0.4, incorrectStrokesCount * 0.05);
  const timeFactor = Math.min(0.2, timeTakenSeconds / 60);
  
  const precisionScore = Math.max(
    0,
    Math.round((rawAccuracy - strokePenalty - timeFactor) * 100)
  );

  return {
    precision: rawAccuracy === 1 && incorrectStrokesCount === 0 ? 100 : precisionScore,
    correctSegments: correctCount,
    totalSegments,
    incorrectStrokes: incorrectStrokesCount,
    timeTaken: timeTakenSeconds
  };
}

// ─── Main Mini-Game Component ─────────────────────────────────
export default function GeometricDraw() {
  const { addScore } = useMiniGameStore();
  const endSession = useGameStore((s) => s.endSession);

  // Play settings state
  const [gridSize, setGridSize] = useState<number>(5);
  const [gridType, setGridType] = useState<'square' | 'diamond'>('square');
  const [kolamType, setKolamType] = useState<'kambi' | 'sikku'>('kambi');
  const [playMode, setPlayMode] = useState<'free' | 'cognitive'>('free');
  
  // Game loop phases: 'idle' | 'study' | 'drawing' | 'results'
  const [gamePhase, setGamePhase] = useState<'idle' | 'study' | 'drawing' | 'results'>('idle');
  const [currentPattern, setCurrentPattern] = useState<KolamPattern | null>(PRESET_PATTERNS[0]);
  const [userPath, setUserPath] = useState<[number, number][]>([]);
  const [incorrectStrokes, setIncorrectStrokes] = useState<number>(0);
  const [showGuide, setShowGuide] = useState(true);
  
  // Timers
  const [timeRemaining, setTimeRemaining] = useState<number>(10); // study phase 10s countdown
  const timeStart = useRef<number>(0);
  const [cognitiveMetrics, setCognitiveMetrics] = useState<ScoringMetrics | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const W = 460;
  const H = 340;

  const dots = generateDots(gridSize, gridType);
  const waypoints = generateWaypoints(gridSize, gridType);

  // Tick the 10 seconds study countdown
  useEffect(() => {
    if (gamePhase !== 'study') return;
    
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        const next = Math.max(0, prev - 0.1);
        if (next <= 0) {
          clearInterval(interval);
          setGamePhase('drawing');
          timeStart.current = Date.now();
          setUserPath([]);
          setIncorrectStrokes(0);
        }
        return next;
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [gamePhase]);

  // Sync parameters when selecting a preset pattern
  const selectPattern = (pattern: KolamPattern) => {
    setCurrentPattern(pattern);
    setGridSize(pattern.gridSize);
    setGridType(pattern.gridType);
    setKolamType(pattern.kolamType);
    setUserPath([]);
    setIncorrectStrokes(0);
    setGamePhase('idle');
  };

  // Snapping and dragging triggers
  const [isDrawing, setIsDrawing] = useState(false);

  const addToUserPath = useCallback((coord: [number, number]) => {
    setUserPath((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (last[0] === coord[0] && last[1] === coord[1]) return prev;
      }
      return [...prev, coord];
    });
  }, []);

  const handleStart = (clientX: number, clientY: number) => {
    if (gamePhase === 'study' || gamePhase === 'results') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const activeWaypoints = waypoints.filter(wp => kolamType === 'kambi' ? wp.isDot : true);
    const closest = findClosestWaypoint(mx, my, activeWaypoints, gridSize, gridType, W, H, 35);

    if (closest) {
      setIsDrawing(true);
      addToUserPath([closest.gridY, closest.gridX]);
    } else {
      if (playMode === 'cognitive') {
        setIncorrectStrokes((prev) => prev + 1);
      }
    }
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDrawing || gamePhase === 'study' || gamePhase === 'results') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const activeWaypoints = waypoints.filter(wp => kolamType === 'kambi' ? wp.isDot : true);
    const closest = findClosestWaypoint(mx, my, activeWaypoints, gridSize, gridType, W, H, 30);

    if (closest) {
      addToUserPath([closest.gridY, closest.gridX]);
    }
  };

  const handleEnd = () => {
    setIsDrawing(false);
  };

  // React Event Bindings
  const onMouseDown = (e: ReactMouseEvent<HTMLCanvasElement>) => handleStart(e.clientX, e.clientY);
  const onMouseMove = (e: ReactMouseEvent<HTMLCanvasElement>) => handleMove(e.clientX, e.clientY);
  const onMouseUp = () => handleEnd();

  const onTouchStart = (e: ReactTouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    handleStart(e.touches[0].clientX, e.touches[0].clientY);
  };
  const onTouchMove = (e: ReactTouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    handleMove(e.touches[0].clientX, e.touches[0].clientY);
  };
  const onTouchEnd = () => handleEnd();

  // Draw loop within HTML5 canvas context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);

    // Clay brick texture background
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(0, 0, W, H);
    
    // Ambient soil grains
    ctx.fillStyle = 'rgba(184, 59, 28, 0.4)';
    for (let x = 0; x < W; x += 16) {
      for (let y = 0; y < H; y += 16) {
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Canvas Vignette
    const gradient = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) / 3, W / 2, H / 2, Math.max(W, H) / 2);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(1, 'rgba(28, 6, 2, 0.55)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // Render guide template (Dashed gold lines)
    const shouldDrawTemplate = 
      (gamePhase === 'study') || 
      (playMode === 'free' && currentPattern && showGuide) ||
      (gamePhase === 'results' && currentPattern);

    if (shouldDrawTemplate && currentPattern) {
      const templatePoints = currentPattern.path.map(([gy, gx]) =>
        gridToPixel(gy, gx, gridSize, gridType, W, H)
      );

      ctx.save();
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.22)';
      ctx.lineWidth = 5;
      ctx.setLineDash([6, 6]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      
      if (templatePoints.length > 0) {
        ctx.moveTo(templatePoints[0].x, templatePoints[0].y);
        for (let i = 1; i < templatePoints.length; i++) {
          ctx.lineTo(templatePoints[i].x, templatePoints[i].y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render active drawing (Glowing rice white spline)
    const userPoints = userPath.map(([gy, gx]) =>
      gridToPixel(gy, gx, gridSize, gridType, W, H)
    );

    if (userPoints.length > 0) {
      drawSmoothSpline(ctx, userPoints, 'rgba(255, 255, 255, 0.9)', 4);
    }

    // Render dots (Pullis with a metallic golden base)
    dots.forEach((dot) => {
      const pt = gridToPixel(dot.gridY, dot.gridX, gridSize, gridType, W, H);
      
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(251, 220, 199, 0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(251, 220, 199, 0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#fafaf9';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    });

  }, [gridSize, gridType, gamePhase, playMode, currentPattern, userPath, showGuide, dots]);

  // Cognitive loop actions
  const startCognitive = () => {
    if (!currentPattern) return;
    setGamePhase('study');
    setTimeRemaining(10);
    setUserPath([]);
    setIncorrectStrokes(0);
    setCognitiveMetrics(null);
  };

  const submitDraw = () => {
    if (!currentPattern) return;
    const elapsed = (Date.now() - timeStart.current) / 1000;
    const metrics = validateDrawing(userPath, currentPattern.path, elapsed, incorrectStrokes);
    setCognitiveMetrics(metrics);
    setGamePhase('results');
    
    // Register mini game score history into main game engine!
    addScore(metrics.precision * 4 + Math.max(0, 300 - Math.round(elapsed * 5)));
  };

  const resetAll = () => {
    setUserPath([]);
    setIncorrectStrokes(0);
    setGamePhase('idle');
    setCognitiveMetrics(null);
  };

  const getDifficultyColor = (diff: string) => {
    if (diff === 'Easy') return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
    if (diff === 'Medium') return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
    return 'text-rose-400 border-rose-500/20 bg-rose-500/5';
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 bg-slate-950/20 backdrop-blur-sm z-20 pointer-events-auto overflow-y-auto">
      
      {/* Visual Workspace Frame */}
      <div className="glass-panel p-6 rounded-2xl w-full max-w-4xl flex flex-col gap-4 shadow-2xl relative">
        
        {/* Dynamic header options */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-clay-600 flex items-center justify-center text-stone-50 font-bold">
              ❊
            </div>
            <div>
              <h2 className="text-base font-bold tracking-wider text-stone-200">Kolam Sand Art</h2>
              <p className="text-[10px] text-stone-500 uppercase tracking-widest font-medium">Cognitive Memory Trainer</p>
            </div>
          </div>

          {/* Mode selections */}
          <div className="flex items-center gap-1 bg-stone-950/60 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => { setPlayMode('free'); resetAll(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                playMode === 'free' ? 'bg-clay-600 text-stone-100 shadow' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Sparkles className="w-3 h-3" /> Free Play
            </button>
            <button
              onClick={() => { setPlayMode('cognitive'); resetAll(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                playMode === 'cognitive' ? 'bg-clay-600 text-stone-100 shadow' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Brain className="w-3 h-3" /> Brain Trainer
            </button>
          </div>
        </div>

        {/* Dynamic status indicators */}
        {playMode === 'cognitive' && gamePhase !== 'idle' && (
          <div className="flex items-center justify-between p-2.5 bg-stone-900/60 border border-white/5 rounded-xl">
            {gamePhase === 'study' && (
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="16" cy="16" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      stroke="#eb7143"
                      strokeWidth="2.5"
                      strokeDasharray={2 * Math.PI * 14}
                      strokeDashoffset={2 * Math.PI * 14 * (1 - timeRemaining / 10)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute font-mono text-xs font-bold text-clay-400">{Math.ceil(timeRemaining)}</span>
                </div>
                <div className="text-left">
                  <span className="text-[9px] uppercase font-bold tracking-widest text-clay-400 animate-pulse block">Study Phase</span>
                  <span className="text-[11px] text-stone-300">Memorize the template! Time is ticking.</span>
                </div>
              </div>
            )}

            {gamePhase === 'drawing' && (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <Timer className="w-4 h-4 text-clay-400 animate-pulse" />
                  <div className="text-left">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-stone-500 block">Memory Tracing</span>
                    <span className="text-[11px] text-stone-300">Reconstruct the pattern from memory.</span>
                  </div>
                </div>
                <button
                  onClick={submitDraw}
                  className="px-4 py-1 bg-clay-500 hover:bg-clay-600 active:scale-95 text-stone-50 text-[10px] font-bold uppercase tracking-wider rounded transition-all"
                >
                  Submit
                </button>
              </div>
            )}

            {gamePhase === 'results' && (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-widest text-stone-500 block">Assessment Score</span>
                    <span className="font-mono text-base font-black text-clay-400">{cognitiveMetrics?.precision}% Precision</span>
                  </div>
                  <div className="text-left border-l border-white/5 pl-4">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-stone-500 block">Errors Made</span>
                    <span className="font-mono text-base font-bold text-rose-400">{cognitiveMetrics?.incorrectStrokes}</span>
                  </div>
                </div>
                <button
                  onClick={resetAll}
                  className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg transition-colors"
                  title="Try Again"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Dual-Layout Panel */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* Canvas Section */}
          <div className="flex flex-col gap-2 mx-auto lg:mx-0">
            
            {/* Canvas Header Toggles */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-stone-400">
                <CircleDot className="w-3.5 h-3.5 text-clay-400" />
                <span className="text-[10px] uppercase font-bold tracking-widest">
                  {kolamType === 'kambi' ? 'Kambi Snap Style' : 'Sikku Braid Style'}
                </span>
              </div>

              {playMode === 'free' && currentPattern && (
                <button
                  onClick={() => setShowGuide(!showGuide)}
                  className="flex items-center gap-1 px-2.5 py-0.5 bg-stone-900 border border-white/5 rounded text-[9px] font-bold uppercase tracking-wider text-stone-300 hover:text-stone-100 transition-colors"
                >
                  {showGuide ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showGuide ? 'Hide Guide' : 'Show Guide'}
                </button>
              )}
            </div>

            {/* Canvas Board element */}
            <div
              className="rounded-xl overflow-hidden border border-clay-800/20 shadow-xl relative w-[460px] h-[340px]"
            >
              <canvas
                ref={canvasRef}
                width={W}
                height={H}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                className="absolute inset-0 cursor-crosshair touch-none"
              />

              {/* Study Countdown Modal Overlay */}
              {gamePhase === 'study' && (
                <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm pointer-events-none flex items-center justify-center z-10 animate-fade-in">
                  <div className="text-center p-4 max-w-xs flex flex-col items-center">
                    <span className="text-3xl mb-1 animate-bounce">🧠</span>
                    <h3 className="text-sm font-bold text-stone-100 uppercase tracking-widest">Flash Study</h3>
                    <p className="text-[10px] text-stone-400 leading-relaxed mt-1">
                      Study the target sand design. It will fade in {Math.ceil(timeRemaining)}s, and you must replicate it entirely from memory!
                    </p>
                  </div>
                </div>
              )}

              {/* Cognitive Results Modal Overlay */}
              {gamePhase === 'results' && cognitiveMetrics && (
                <div className="absolute inset-0 bg-stone-950/90 backdrop-blur-md flex items-center justify-center z-20 animate-fade-in p-6">
                  <div className="text-center flex flex-col items-center gap-4 max-w-xs">
                    <div className="w-12 h-12 rounded-full bg-clay-500/10 border border-clay-500/20 flex items-center justify-center text-clay-400 text-2xl animate-bounce">
                      🎯
                    </div>
                    <div>
                      <span className="text-[8px] text-stone-500 uppercase tracking-widest font-bold">Training Finished</span>
                      <h4 className="text-sm font-black text-stone-200 mt-0.5">{currentPattern?.name}</h4>
                    </div>

                    <div className="w-full bg-stone-900/60 p-4 border border-white/5 rounded-xl grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[8px] uppercase tracking-wider text-stone-500">Score</span>
                        <p className="font-mono text-xl font-black text-clay-400">{cognitiveMetrics.precision}%</p>
                      </div>
                      <div className="border-l border-white/5 pl-3">
                        <span className="text-[8px] uppercase tracking-wider text-stone-500">Errors</span>
                        <p className="font-mono text-xl font-bold text-rose-400">{cognitiveMetrics.incorrectStrokes}</p>
                      </div>
                    </div>

                    <button
                      onClick={resetAll}
                      className="w-full py-2 bg-clay-500 hover:bg-clay-600 active:scale-95 text-stone-50 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all"
                    >
                      Clear & Try Again
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {gamePhase === 'drawing' && (
              <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                  onClick={() => setUserPath((p) => p.slice(0, -1))}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 border border-white/5 bg-stone-900/40 hover:bg-stone-900/80 rounded-lg text-stone-300 font-bold text-[10px] uppercase tracking-wider transition-colors"
                >
                  <Undo2 className="w-3.5 h-3.5" /> Undo stroke
                </button>
                <button
                  onClick={() => setUserPath([])}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 border border-rose-950/40 hover:bg-rose-950/20 rounded-lg text-rose-400 font-bold text-[10px] uppercase tracking-wider transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear path
                </button>
              </div>
            )}
          </div>

          {/* Right Controls Panel */}
          <div className="flex-1 w-full lg:w-[320px] flex flex-col gap-4 self-stretch">
            
            {/* Play Options */}
            {playMode === 'free' ? (
              <div className="flex flex-col gap-4 bg-stone-950/30 p-4 border border-white/5 rounded-xl">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-clay-400" /> Free Play Options
                </h3>

                {/* Grid Sizes */}
                <div>
                  <span className="text-[9px] uppercase font-bold tracking-widest text-stone-500 block mb-1">Grid Size</span>
                  <div className="grid grid-cols-3 gap-1 bg-stone-950 p-0.5 rounded-lg border border-white/5">
                    {[5, 7, 9].map((size) => (
                      <button
                        key={size}
                        onClick={() => { setGridSize(size); setUserPath([]); }}
                        className={`py-1 rounded text-[10px] font-bold transition-all ${
                          gridSize === size ? 'bg-clay-600 text-stone-100 shadow' : 'text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        {size}x{size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid Styles */}
                <div>
                  <span className="text-[9px] uppercase font-bold tracking-widest text-stone-500 block mb-1">Grid Formation</span>
                  <div className="grid grid-cols-2 gap-1 bg-stone-950 p-0.5 rounded-lg border border-white/5">
                    <button
                      onClick={() => { setGridType('square'); setUserPath([]); }}
                      className={`py-1 rounded text-[10px] font-bold transition-all ${
                        gridType === 'square' ? 'bg-clay-600 text-stone-100 shadow' : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      Square
                    </button>
                    <button
                      onClick={() => { setGridType('diamond'); setUserPath([]); }}
                      className={`py-1 rounded text-[10px] font-bold transition-all ${
                        gridType === 'diamond' ? 'bg-clay-600 text-stone-100 shadow' : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      Diamond
                    </button>
                  </div>
                </div>

                {/* Kolam Type */}
                <div>
                  <span className="text-[9px] uppercase font-bold tracking-widest text-stone-500 block mb-1">Drawing Style</span>
                  <div className="grid grid-cols-2 gap-1 bg-stone-950 p-0.5 rounded-lg border border-white/5">
                    <button
                      onClick={() => { setKolamType('kambi'); setUserPath([]); }}
                      className={`py-1 rounded text-[10px] font-bold transition-all ${
                        kolamType === 'kambi' ? 'bg-clay-600 text-stone-100 shadow' : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      Kambi
                    </button>
                    <button
                      onClick={() => { setKolamType('sikku'); setUserPath([]); }}
                      className={`py-1 rounded text-[10px] font-bold transition-all ${
                        kolamType === 'sikku' ? 'bg-clay-600 text-stone-100 shadow' : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      Sikku
                    </button>
                  </div>
                </div>

                {/* General Actions */}
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    onClick={() => setUserPath((p) => p.slice(0, -1))}
                    className="flex items-center justify-center gap-1 py-1 px-2 border border-white/5 bg-stone-900/30 hover:bg-stone-900/60 rounded text-[9px] font-bold uppercase tracking-wider text-stone-300 transition-colors"
                  >
                    <Undo2 className="w-3 h-3" /> Undo
                  </button>
                  <button
                    onClick={() => setUserPath([])}
                    className="flex items-center justify-center gap-1 py-1 px-2 border border-rose-950/40 hover:bg-rose-950/10 rounded text-[9px] font-bold uppercase tracking-wider text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                </div>
              </div>
            ) : (
              /* Brain Training Templates */
              <div className="flex-1 flex flex-col gap-3 min-h-0">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-clay-400" /> Training Templates
                </h3>

                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 flex-1">
                  {PRESET_PATTERNS.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => selectPattern(p)}
                      className={`p-2.5 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${
                        currentPattern?.id === p.id 
                          ? 'bg-clay-500/10 border-clay-500/35 shadow-sm' 
                          : 'border-white/5 bg-stone-900/20 hover:bg-stone-900/50'
                      }`}
                    >
                      <div className="text-left">
                        <h4 className="text-[10px] font-bold text-stone-200">{p.name}</h4>
                        <span className="text-[8px] uppercase tracking-wider font-semibold text-stone-500 block mt-0.5">
                          {p.gridSize}x{p.gridSize} {p.gridType} • {p.kolamType}
                        </span>
                      </div>
                      <span className={`px-1.5 py-0.5 border rounded text-[7px] font-bold uppercase tracking-wide ${getDifficultyColor(p.difficulty)}`}>
                        {p.difficulty}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Training Trigger Panel */}
                {currentPattern && (
                  <div className="p-3 bg-stone-950/30 border border-white/5 rounded-xl flex flex-col gap-2 text-left">
                    <p className="text-[9px] text-stone-400 leading-relaxed font-medium">
                      {currentPattern.description}
                    </p>
                    {gamePhase === 'idle' ? (
                      <button
                        onClick={startCognitive}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-clay-500 hover:bg-clay-600 active:scale-95 text-stone-50 text-[10px] font-bold uppercase tracking-widest rounded-lg shadow transition-all"
                      >
                        <Play className="w-3 h-3 fill-current" /> Start Session
                      </button>
                    ) : (
                      <div className="w-full py-1 border border-clay-950/40 bg-clay-950/15 rounded-lg text-clay-400 text-center font-bold text-[9px] uppercase tracking-widest animate-pulse">
                        Active Training Mode
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Global Control Bar */}
        <div className="flex items-center justify-end gap-3 border-t border-white/5 pt-4 mt-1">
          <button
            onClick={endSession}
            className="px-4 py-2 border border-stone-800 hover:bg-stone-900 rounded-xl text-stone-400 hover:text-stone-200 font-bold text-xs uppercase tracking-widest transition-all"
          >
            Exit Game
          </button>
        </div>

      </div>
    </div>
  );
}
