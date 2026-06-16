import { SKITTLE_COLOURS, type SkittleSet } from '../generators/event.js'
import { SkittleToken } from './SkittleToken.js'

/** Your nation's current holdings. Read-only — skittles now arrive from your
 *  starting hand and each round's allotment, not by tapping. */
export function SkittlePanel({ skittles }: { skittles: SkittleSet }) {
  return (
    <div className="skittle-panel">
      {SKITTLE_COLOURS.map((colour) => (
        <SkittleToken key={colour} colour={colour} count={skittles[colour]} />
      ))}
    </div>
  )
}
