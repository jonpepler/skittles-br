import { FlagImage } from './FlagImage.js'

/** The canonical way to render a faction: a chip with its flag and name. Every
 *  mention of a faction should go through this so it's recognisable everywhere. */
export function FactionTitle({
  seed,
  name,
  self = false,
  size = 'md'
}: {
  seed: string
  name: string
  self?: boolean
  size?: 'sm' | 'md'
}) {
  return (
    <span className={`faction faction--${size}`}>
      <FlagImage seed={seed} className="faction__flag" />
      <span className="faction__name">{name}</span>
      {self && <span className="faction__you">you</span>}
    </span>
  )
}
