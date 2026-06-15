// Friendly, speakable word list — codes are three words joined by hyphens
// (e.g. "amber-otter-canyon"), easy to read aloud and type. ~110 words gives
// over a million combinations.
const WORDS = [
  'amber', 'anchor', 'apple', 'arrow', 'aspen', 'autumn', 'badger', 'bamboo',
  'beacon', 'birch', 'bison', 'bramble', 'brave', 'breeze', 'bronze', 'canyon',
  'cedar', 'cinder', 'clever', 'clover', 'comet', 'copper', 'coral', 'cosmic',
  'cricket', 'crimson', 'crystal', 'dawn', 'delta', 'dusk', 'eagle', 'ember',
  'falcon', 'fern', 'fjord', 'forest', 'fox', 'galaxy', 'garnet', 'glacier',
  'golden', 'granite', 'harbor', 'hazel', 'heron', 'hollow', 'indigo', 'island',
  'ivory', 'jade', 'jasper', 'jolly', 'jungle', 'kestrel', 'lagoon', 'lantern',
  'lily', 'lunar', 'lynx', 'maple', 'marble', 'meadow', 'meteor', 'mint',
  'misty', 'nimble', 'nova', 'oasis', 'ocean', 'olive', 'onyx', 'orchid',
  'otter', 'pebble', 'pine', 'prairie', 'quartz', 'quiet', 'quill', 'raven',
  'reef', 'ripple', 'river', 'rowan', 'ruby', 'sable', 'saffron', 'sage',
  'sandy', 'sequoia', 'shadow', 'silver', 'solar', 'spruce', 'storm', 'summit',
  'sunny', 'thistle', 'thunder', 'tiger', 'topaz', 'tundra', 'velvet', 'violet',
  'walnut', 'willow', 'winter', 'zephyr'
]

function randomInt(maxExclusive: number): number {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0]! % maxExclusive
}

/** Generate a human-readable room code like "amber-otter-canyon". */
export function makeRoomCode(words = 3): string {
  return Array.from({ length: words }, () => WORDS[randomInt(WORDS.length)]).join('-')
}

/** Normalise a user-entered code: lowercase, spaces → hyphens, strip noise. */
export function normaliseRoomCode(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export { WORDS as ROOM_CODE_WORDS }
