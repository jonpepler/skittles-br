import type { CSSProperties } from 'react'
import { factionColour } from '../lib/faction.js'

/** A colour-coded faction picker (a chip-styled native select, so it stays
 *  keyboard- and test-friendly while showing the faction's colour). */
export function FactionSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: { id: string; name: string }[]
  onChange: (id: string) => void
}) {
  return (
    <span className="fselect chip" style={{ '--fc': factionColour(value) } as CSSProperties}>
      <span className="faction__dot" />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </span>
  )
}
