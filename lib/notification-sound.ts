/**
 * Notification chime.
 *
 * Synthesised with the Web Audio API rather than shipped as an audio file:
 * no asset to download before the first alert can play, and nothing for a
 * content-security policy to block.
 */

let audioContext: AudioContext | null = null

type WindowWithLegacyAudio = Window & {
  webkitAudioContext?: typeof AudioContext
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null

  if (!audioContext) {
    const Ctor =
      window.AudioContext || (window as WindowWithLegacyAudio).webkitAudioContext
    if (!Ctor) return null
    try {
      audioContext = new Ctor()
    } catch {
      // Some browsers throw when too many contexts exist. A missing chime is
      // never worth breaking the page over.
      return null
    }
  }

  return audioContext
}

/**
 * Browsers refuse to start audio until the user has interacted with the page.
 * Call this from a real click so the context is running by the time a message
 * actually arrives — otherwise the first chime is silently dropped.
 */
export function unlockNotificationSound(): void {
  const ctx = getContext()
  if (ctx && ctx.state === "suspended") {
    void ctx.resume().catch(() => {})
  }
}

/**
 * Two-note rising chime. Resolves immediately — playback is fire-and-forget,
 * and any failure is swallowed on purpose.
 */
export function playNotificationSound(): void {
  const ctx = getContext()
  if (!ctx) return

  // Still locked by the autoplay policy: ask for a resume so the *next* one
  // lands, and skip this one rather than throwing.
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {})
    if (ctx.state === "suspended") return
  }

  try {
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.18, now)
    master.connect(ctx.destination)

    // E5 then A5 — a short, soft interval that reads as "arrived" without
    // being an alarm.
    const notes = [
      { frequency: 659.25, start: 0, duration: 0.12 },
      { frequency: 880.0, start: 0.1, duration: 0.18 },
    ]

    for (const note of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = "sine"
      osc.frequency.setValueAtTime(note.frequency, now + note.start)

      // Quick attack, exponential decay: a bell rather than a beep.
      gain.gain.setValueAtTime(0.0001, now + note.start)
      gain.gain.exponentialRampToValueAtTime(1, now + note.start + 0.012)
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + note.start + note.duration
      )

      osc.connect(gain)
      gain.connect(master)
      osc.start(now + note.start)
      osc.stop(now + note.start + note.duration + 0.02)
    }

    // Release the master gain once the tail has finished.
    window.setTimeout(() => {
      try {
        master.disconnect()
      } catch {
        /* already torn down */
      }
    }, 600)
  } catch {
    // A failed chime must never surface to the user.
  }
}
