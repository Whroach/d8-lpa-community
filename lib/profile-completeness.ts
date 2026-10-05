/**
 * "Your profile is 60% complete" - what is still missing from a member's own
 * profile, most useful first, with example answers they can start from.
 *
 * Shown only to the member themselves. The reasons are plain statements, not
 * promises about replies or matches (nobody has measured those here).
 */

export interface CompletenessInput {
  photos?: string[] | null
  bio?: string | null
  interests?: string[] | null
  looking_for_description?: string[] | string | null
  occupation?: string | null
  languages?: string[] | null
  prompt_good_at?: string | null
  prompt_perfect_weekend?: string | null
  prompt_message_if?: string | null
  hoping_to_find?: string | null
}

export interface CompletenessItem {
  key: "photo" | "bio" | "interests" | "looking_for" | "prompt_good_at" | "prompt_perfect_weekend" | "hoping_to_find" | "prompt_message_if" | "languages" | "occupation"
  /** What to do, as a short instruction. */
  label: string
  /** Why it helps, in one plain sentence. */
  reason: string
  weight: number
  /** For text answers: starting points the member can pick and then change. */
  examples?: string[]
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "")
const list = (value: unknown) =>
  (Array.isArray(value) ? value : typeof value === "string" && value.trim() ? [value] : []).filter(
    (item) => typeof item === "string" && item.trim()
  )

/** Every item, in the order they are suggested. Weights add up to 100. */
export const COMPLETENESS_ITEMS: CompletenessItem[] = [
  { key: "photo", label: "Add a photo", reason: "A photo helps other members recognise you at events.", weight: 20 },
  {
    key: "bio",
    label: "Write a few lines about yourself",
    reason: "It is the first thing people read on your profile.",
    weight: 15,
    examples: [
      "Retired teacher and keen gardener. I like a good conversation over coffee and I rarely miss a regional meet-up.",
      "I work in accounts, sing in a community choir and spend weekends with family or out on the lake.",
      "New to this, so I will keep it simple: I enjoy cooking for friends, old films and long drives with the radio on.",
    ],
  },
  { key: "interests", label: "Choose at least three interests", reason: "Shared interests are shown to people who view your profile and give them something to ask about.", weight: 10 },
  { key: "looking_for", label: "Say what you are looking for", reason: "It saves both of you guessing - friendship, a relationship, or not sure yet are all fine answers.", weight: 10 },
  {
    key: "prompt_good_at",
    label: "Answer \"I'm weirdly good at...\"",
    reason: "A small, specific detail makes it easier for someone to start a conversation.",
    weight: 10,
    examples: ["Remembering everyone's birthday", "Fixing things with whatever is in the garage", "Finding the best pie in any town"],
  },
  {
    key: "prompt_perfect_weekend",
    label: "Describe your perfect weekend",
    reason: "It shows how you like to spend your time.",
    weight: 10,
    examples: [
      "A farmers market, a ball game on the radio and supper with friends",
      "Fishing early, a nap, then cards in the evening",
      "A road trip with no fixed plan and a good playlist",
    ],
  },
  {
    key: "hoping_to_find",
    label: "Say what you hope to find here",
    reason: "People are more comfortable writing when they know what you are hoping for.",
    weight: 10,
    examples: ["Friendship first, and we will see where it goes", "Someone to share meals, trips and everyday news with", "Good company at events and a few new friends"],
  },
  {
    key: "prompt_message_if",
    label: "Finish \"Message me if...\"",
    reason: "It tells people what to say in a first message.",
    weight: 5,
    examples: [
      "You would like to swap recipes or restaurant tips",
      "You are going to the next district event and would like a friendly face there",
      "You enjoy a good chat about books, films or grandchildren",
    ],
  },
  { key: "languages", label: "Add the languages you speak", reason: "Useful to members who are more comfortable in another language.", weight: 5 },
  { key: "occupation", label: "Add what you do (or did)", reason: "Work, retirement, volunteering - it is an easy thing to talk about.", weight: 5 },
]

const isDone = (key: CompletenessItem["key"], profile: CompletenessInput): boolean => {
  switch (key) {
    case "photo":
      return list(profile.photos).length > 0
    case "bio":
      return text(profile.bio).length >= 20
    case "interests":
      return list(profile.interests).length >= 3
    case "looking_for":
      return list(profile.looking_for_description).length > 0
    case "languages":
      return list(profile.languages).length > 0
    case "occupation":
      return text(profile.occupation).length > 0
    default:
      return text(profile[key]).length > 0
  }
}

export function profileCompleteness(profile: CompletenessInput | null | undefined): {
  percent: number
  missing: CompletenessItem[]
  done: CompletenessItem[]
} {
  const source = profile || {}
  const done = COMPLETENESS_ITEMS.filter((item) => isDone(item.key, source))
  const missing = COMPLETENESS_ITEMS.filter((item) => !isDone(item.key, source))
  const percent = done.reduce((sum, item) => sum + item.weight, 0)
  return { percent, missing, done }
}
