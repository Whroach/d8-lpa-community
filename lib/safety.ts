/**
 * Gentle, private scam warnings for chat.
 *
 * Pattern-based and deliberately simple. A match never blocks, delays or
 * reports a message - it only shows a short note to the person reading or
 * writing it. Nothing is sent anywhere: the check runs in the browser.
 */
export type SafetyFlag = "money" | "gift_cards" | "crypto" | "off_platform" | "personal_details"

interface Rule {
  flag: SafetyFlag
  pattern: RegExp
}

const RULES: Rule[] = [
  {
    flag: "gift_cards",
    pattern: /\b(gift\s?cards?|itunes\s+cards?|google\s+play\s+cards?|steam\s+cards?|amazon\s+cards?|prepaid\s+cards?|scratch(ed)?\s+(off\s+)?the\s+(back|code))\b/i,
  },
  {
    flag: "crypto",
    pattern: /\b(bitcoin|btc|crypto(currency)?|ethereum|usdt|tether|wallet\s+address|binance|coinbase|forex|trading\s+platform|investment\s+opportunity|guaranteed\s+returns?)\b/i,
  },
  {
    flag: "money",
    pattern: /\b(send|wire|lend|loan|transfer|borrow|give)\s+(me\s+)?(some\s+)?(money|cash|funds|\$\s?\d+|\d+\s?(dollars|usd|bucks))\b|\b(western\s+union|moneygram|zelle|cash\s?app|venmo|paypal|wire\s+transfer|bank\s+account\s+(number|details)|routing\s+number|customs\s+fee|hospital\s+bill|plane\s+ticket|stuck\s+(abroad|overseas)|pay\s+(you|u)\s+back|money\s+order)\b/i,
  },
  {
    flag: "off_platform",
    pattern: /\b(whats\s?app|telegram|signal\s+app|google\s+(chat|hangouts?)|hangouts|kik\b|snap\s?chat|viber|wechat|line\s+app|text\s+me\s+(at|on)|email\s+me\s+(at|on)|add\s+me\s+on|message\s+me\s+on|move\s+(this\s+)?(chat|conversation)|talk\s+(somewhere|some\s+place)\s+else)\b/i,
  },
  {
    flag: "personal_details",
    pattern: /\b(social\s+security|ssn\b|password|verification\s+code|one[-\s]?time\s+code|pin\s+number|credit\s+card\s+number|card\s+number|date\s+of\s+birth\s+and)\b/i,
  },
]

export function detectSafetyFlags(text: string | null | undefined): SafetyFlag[] {
  if (!text) return []
  const found: SafetyFlag[] = []
  for (const rule of RULES) {
    if (rule.pattern.test(text) && !found.includes(rule.flag)) found.push(rule.flag)
  }
  return found
}

const ADVICE: Record<SafetyFlag, string> = {
  gift_cards: "Nobody genuine asks for gift cards. This is the most common sign of a scam.",
  crypto: "Be very careful with investment or crypto offers from someone you have not met in person.",
  money: "Please do not send money to someone you have only met online, whatever the reason given.",
  off_platform: "Moving to another app early is a common step in scams. It is fine to keep talking here, where you can block and report.",
  personal_details: "Never share passwords, codes, bank or Social Security details in a chat.",
}

/** One short note for a received message, or null if nothing stood out. */
export function safetyNoteFor(text: string | null | undefined): { flags: SafetyFlag[]; note: string } | null {
  const flags = detectSafetyFlags(text)
  if (flags.length === 0) return null
  return { flags, note: ADVICE[flags[0]] }
}

export const REPORT_REASONS = [
  "Asked me for money, gift cards or crypto",
  "Seems fake or is pretending to be someone else",
  "Rude, insulting or harassing messages",
  "Unwanted sexual messages or pictures",
  "Asked me to move to another app straight away",
  "Something else",
] as const
