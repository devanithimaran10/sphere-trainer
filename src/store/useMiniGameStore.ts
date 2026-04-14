import { create } from 'zustand';

interface MiniGameStore {
  score: number;
  addScore: (n: number) => void;
  resetScore: () => void;
}

export const useMiniGameStore = create<MiniGameStore>((set) => ({
  score: 0,
  addScore: (n) => set((s) => ({ score: s.score + n })),
  resetScore: () => set({ score: 0 }),
}));
