/**
 * Conversation starters. Built from what two members have in common, with a
 * few friendly general openers to fall back on. Suggestions only fill in the
 * message box - the member can change every word before sending.
 */
const BY_INTEREST: Record<string, string> = {
  gardening: "I saw you like gardening too. What are you growing this year?",
  cooking: "We both like cooking! What is the dish people always ask you to make?",
  baking: "A fellow baker! What is your best recipe?",
  reading: "I see you enjoy reading. What is the last book you could not put down?",
  travel: "We both like to travel. Where is the best place you have ever been?",
  fishing: "I like fishing too. Do you have a favourite spot?",
  music: "We both love music. What have you been listening to lately?",
  movies: "A fellow movie fan! Seen anything good recently?",
  hiking: "I enjoy hiking as well. Do you have a favourite trail?",
  photography: "I see you like photography. What do you most enjoy taking pictures of?",
  "board games": "We both like board games. Which one do you always win?",
  coffee: "Coffee person here too. How do you take yours?",
  art: "I noticed you like art. Do you make it, or enjoy looking at it?",
  yoga: "I see we both do yoga. How long have you been practising?",
  woodworking: "Woodworking! What are you building at the moment?",
  crafts: "We both like crafts. What are you working on?",
  chess: "A chess player! Fancy telling me your favourite opening?",
  church: "I see faith is important to you as well. Tell me about your church community.",
}

const GENERAL = [
  "Hello! It is nice to match with you. How is your week going?",
  "Hi there! What does a good weekend look like for you?",
  "Hello! Are you going to any of the District events coming up?",
]

export function conversationStarters(
  myInterests: string[] | undefined,
  theirInterests: string[] | undefined,
  theirFirstName?: string
): string[] {
  const mine = new Set((myInterests || []).map((i) => i.toLowerCase().trim()))
  const shared = (theirInterests || []).filter((i) => mine.has(i.toLowerCase().trim()))
  const starters: string[] = []

  for (const interest of shared) {
    const key = interest.toLowerCase().trim()
    starters.push(BY_INTEREST[key] || `I see we both like ${interest.toLowerCase()}. What do you enjoy most about it?`)
    if (starters.length === 2) break
  }

  // Something they like that I have not listed: a natural thing to ask about.
  if (starters.length < 2) {
    const theirs = (theirInterests || []).find((i) => !mine.has(i.toLowerCase().trim()))
    if (theirs) starters.push(`I noticed you like ${theirs.toLowerCase()}. How did you get into that?`)
  }

  for (const line of GENERAL) {
    if (starters.length >= 3) break
    starters.push(line)
  }

  return starters.slice(0, 3).map((line) =>
    theirFirstName && line.startsWith("Hello!") ? line.replace("Hello!", `Hello ${theirFirstName}!`) : line
  )
}

/** Interests two members share, in the other person's order. */
export function sharedInterests(mine: string[] | undefined, theirs: string[] | undefined): string[] {
  const set = new Set((mine || []).map((i) => i.toLowerCase().trim()))
  return (theirs || []).filter((i) => set.has(i.toLowerCase().trim()))
}
