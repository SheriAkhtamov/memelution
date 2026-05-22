import { create } from 'zustand';

interface FeedUIState {
  /** Cached scroll positions per feed tab */
  scrollPositions: Record<string, number>;
  setScrollPosition: (tab: string, y: number) => void;
  getScrollPosition: (tab: string) => number;
}

export const useFeedUIStore = create<FeedUIState>((set, get) => ({
  scrollPositions: {},
  setScrollPosition: (tab, y) =>
    set((state) => (
      state.scrollPositions[tab] === y
        ? state
        : { scrollPositions: { ...state.scrollPositions, [tab]: y } }
    )),
  getScrollPosition: (tab) => get().scrollPositions[tab] || 0,
}));
