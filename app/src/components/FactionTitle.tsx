import type { CSSProperties } from 'react'
import { factionColour } from '../lib/faction.js'

/** The canonical way to render a faction: a colour-coded chip. Every mention of
 *  a faction should go through this so colours stay consistent everywhere. */
export function FactionTitle({
  id,
  name,
  self = false,
  size = 'md'
}: {
  id: string
  name: string
  self?: boolean
  size?: 'sm' | 'md'
}) {
  return (
    <span
      className={`faction faction--${size}`}
      style={{ '--fc': factionColour(id) } as CSSProperties}
    >
      <span className="faction__dot" />
      <span className="faction__name">{name}</span>
      {self && <span className="faction__you">you</span>}
    </span>
  )
}
