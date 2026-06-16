import { SKITTLE_COLOURS, type SkittleColour } from '../generators/event.js'

/** A row of skittle dots for choosing one or more colours. Selected dots are
 *  lit; at least one stays selected. */
export function ColourPicker({
  label,
  values,
  onChange
}: {
  label: string
  values: SkittleColour[]
  onChange: (c: SkittleColour[]) => void
}) {
  const toggle = (c: SkittleColour): void => {
    const on = values.includes(c)
    if (on && values.length === 1) return // keep at least one
    onChange(on ? values.filter((x) => x !== c) : SKITTLE_COLOURS.filter((x) => x === c || values.includes(x)))
  }
  return (
    <span className="cpick" role="group" aria-label={label}>
      {SKITTLE_COLOURS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          aria-label={`${label} ${c}`}
          aria-pressed={values.includes(c)}
          className={`cpick__dot skittle--${c}${values.includes(c) ? ' cpick__dot--on' : ''}`}
          onClick={() => toggle(c)}
        />
      ))}
    </span>
  )
}
