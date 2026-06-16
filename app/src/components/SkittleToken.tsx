import type { SkittleColour } from '../generators/event.js'

/** One skittle holding shown as a coloured coin with the count inside. This is
 *  the consistent way to render a skittle quantity across the app. */
export function SkittleToken({ colour, count }: { colour: SkittleColour; count: number }) {
  return (
    <span className={`token skittle--${colour}`} title={colour}>
      {count}
    </span>
  )
}
