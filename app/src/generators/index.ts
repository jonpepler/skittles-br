/** Bundled generator modules — the former network "services" as pure functions. */
export { generateFlag, FLAG_DIMENSIONS, FLAG_PALETTE } from './flag.js'
export type { Flag } from './flag.js'

export {
  generateEvent,
  eventMagnitude,
  EXAMPLE_EVENT,
  SKITTLE_COLOURS
} from './event.js'
export type { GameEvent, SkittleColour, SkittleSet } from './event.js'

export { generateName, generateNames } from './name.js'
