import type { SkittleColour } from '../generators/event.js'

/** One skittle holding: a small colour circle for the unit, then the count.
 *  The consistent way to render a skittle quantity across the app. */
export function SkittleToken({ colour, count }: { colour: SkittleColour; count: number }) {
  return (
    <span className="token">
      <span className={`dot skittle--${colour}`} />
      {count}
    </span>
  )
}
