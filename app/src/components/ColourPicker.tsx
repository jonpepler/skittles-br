import { SKITTLE_COLOURS, type SkittleColour } from '../generators/event.js'

/** A single compact, colour-tinted dropdown for choosing a skittle colour.
 *  One control instead of a row of dots, to keep clause-building uncluttered. */
export function ColourPicker({
  label,
  value,
  onChange
}: {
  label: string
  value: SkittleColour
  onChange: (c: SkittleColour) => void
}) {
  return (
    <select
      className={`chip cpick-select skittle--${value}`}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as SkittleColour)}
    >
      {SKITTLE_COLOURS.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  )
}
