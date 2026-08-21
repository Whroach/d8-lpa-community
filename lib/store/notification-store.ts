import { create } from "zustand"

/**
 * Badge counts shared by the sidebar and the mobile nav.
 *
 * Both used to fetch and hold their own copy, so a realtime bump had to be
 * applied twice and the two could drift. They now render from this single
 * store; RealtimeProvider is the only thing that writes to it.
 */

export interface BadgeCounts {
  matches: number
  messages: number
  events: number
  notifications: number
}

interface NotificationState {
  counts: BadgeCounts
  /** Mirrors the user's saved preference; RealtimeProvider loads it on mount. */
  soundEnabled: boolean
  setCounts: (counts: Partial<BadgeCounts>) => void
  incrementCount: (key: keyof BadgeCounts, by?: number) => void
  clearCount: (key: keyof BadgeCounts) => void
  setSoundEnabled: (enabled: boolean) => void
  reset: () => void
}

const emptyCounts: BadgeCounts = {
  matches: 0,
  messages: 0,
  events: 0,
  notifications: 0,
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  counts: emptyCounts,
  soundEnabled: true,
  setCounts: (counts) =>
    set((state) => ({ counts: { ...state.counts, ...counts } })),
  incrementCount: (key, by = 1) =>
    set((state) => ({
      counts: {
        ...state.counts,
        [key]: Math.max(0, state.counts[key] + by),
      },
    })),
  clearCount: (key) =>
    set((state) => ({ counts: { ...state.counts, [key]: 0 } })),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  reset: () => set({ counts: emptyCounts }),
}))
