import { FlagImage } from './FlagImage.js'

/** A faction picker showing the chosen faction's flag (a chip-styled native
 *  select, so it stays keyboard- and test-friendly). */
export function FactionSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: { id: string; name: string; seed: string }[]
  onChange: (id: string) => void
}) {
  const current = options.find((o) => o.id === value)
  return (
    <span className="fselect chip">
      {current && <FlagImage seed={current.seed} className="faction__flag" />}
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
