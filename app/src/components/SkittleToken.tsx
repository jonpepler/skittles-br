import type { SkittleColour } from '../generators/event.js'

/** One skittle holding shown as a coloured pill with a dot and the count, the
 *  same chip used by the collect buttons. The consistent way to render a
 *  skittle quantity across the app. */
export function SkittleToken({ colour, count }: { colour: SkittleColour; count: number }) {
  return (
    <span className={`token skittle--${colour}`}>
      <span className="skittle__dot" />
      {count}
    </span>
  )
}
