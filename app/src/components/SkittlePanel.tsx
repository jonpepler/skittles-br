import { SKITTLE_COLOURS, type SkittleColour, type SkittleSet } from '../generators/event.js'

/** Buttons for the player to collect skittles. Each click is a request to the
 *  host, which validates and applies it (the player can't set values directly). */
export function SkittlePanel({
  skittles,
  onIncrement
}: {
  skittles: SkittleSet
  onIncrement: (colour: SkittleColour) => void
}) {
  return (
    <div className="skittle-panel">
      {SKITTLE_COLOURS.map((colour) => (
        <button
          key={colour}
          className={`skittle-btn skittle-btn--${colour}`}
          onClick={() => onIncrement(colour)}
        >
          <span className="skittle__dot" />
          {colour}: {skittles[colour]}
        </button>
      ))}
    </div>
  )
}
