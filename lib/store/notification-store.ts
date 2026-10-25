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
  /** Quiet hours: no chime between start and end (the device's clock). */
  quietHours: { enabled: boolean; start: string; end: string }
  setQuietHours: (enabled: boolean, start: string, end: string) => void
  reset: () => void
}

/** True if `now` falls inside the quiet period (which may cross midnight). */
export function isWithinQuietHours(
  quiet: { enabled: boolean; start: string; end: string },
  now: Date = new Date()
): boolean {
  if (!quiet.enabled) return false
  const toMinutes = (value: string) => {
    const [h, m] = value.split(":").map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  const start = toMinutes(quiet.start)
  const end = toMinutes(quiet.end)
  const current = now.getHours() * 60 + now.getMinutes()
  if (start === end) return false
  return start < end ? current >= start && current < end : current >= start || current < end
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
  quietHours: { enabled: false, start: "21:00", end: "08:00" },
  setQuietHours: (enabled, start, end) => set({ quietHours: { enabled, start, end } }),
  reset: () => set({ counts: emptyCounts }),
}))
