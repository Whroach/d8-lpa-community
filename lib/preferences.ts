/**
 * Device-level display preferences (text size). Kept in localStorage because
 * they belong to the screen in front of the person, not to their account: the
 * same member may want larger text on a phone than on a desktop monitor.
 */
export type TextSize = "standard" | "comfortable" | "large" | "xlarge"

export const TEXT_SIZE_KEY = "d8lpa-text-size"

export const TEXT_SIZES: { value: TextSize; label: string; hint: string }[] = [
  { value: "standard", label: "Standard", hint: "Smaller text, more on screen" },
  { value: "comfortable", label: "Comfortable", hint: "Recommended" },
  { value: "large", label: "Large", hint: "Easier to read" },
  { value: "xlarge", label: "Extra large", hint: "Largest text" },
]

export function getTextSize(): TextSize {
  if (typeof window === "undefined") return "comfortable"
  try {
    const stored = localStorage.getItem(TEXT_SIZE_KEY) as TextSize | null
    return stored && TEXT_SIZES.some((size) => size.value === stored) ? stored : "comfortable"
  } catch {
    return "comfortable"
  }
}

export function applyTextSize(size: TextSize) {
  if (typeof document === "undefined") return
  if (size === "comfortable") {
    document.documentElement.removeAttribute("data-text-size")
  } else {
    document.documentElement.setAttribute("data-text-size", size)
  }
}

export function setTextSize(size: TextSize) {
  try {
    localStorage.setItem(TEXT_SIZE_KEY, size)
  } catch {
    /* private browsing: still apply for this visit */
  }
  applyTextSize(size)
}

/** Runs before first paint (inlined in <head>) so the page never jumps. */
export const TEXT_SIZE_BOOT_SCRIPT = `try{var s=localStorage.getItem(${JSON.stringify(
  TEXT_SIZE_KEY
)});if(s&&s!=="comfortable")document.documentElement.setAttribute("data-text-size",s)}catch(e){}`
