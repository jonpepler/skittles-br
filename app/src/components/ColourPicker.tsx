import { SKITTLE_COLOURS, type SkittleColour } from '../generators/event.js'

/** A row of clickable skittle dots for choosing a colour. */
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
    <span className="cpick" role="group" aria-label={label}>
      {SKITTLE_COLOURS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          aria-label={`${label} ${c}`}
          aria-pressed={c === value}
          className={`cpick__dot skittle--${c}${c === value ? ' cpick__dot--on' : ''}`}
          onClick={() => onChange(c)}
        />
      ))}
    </span>
  )
}
