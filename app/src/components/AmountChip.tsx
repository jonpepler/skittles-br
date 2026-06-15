import type { SkittleColour } from '../generators/event.js'
import type { AmountExpr } from '../game/contracts.js'
import { ColourPicker } from './ColourPicker.js'

type Kind = 'number' | 'all' | 'eventReq' | 'received' | 'percent' | 'min' | 'sum'

function kindOf(e: AmountExpr): Kind {
  if (typeof e === 'number') return 'number'
  if ('all' in e) return 'all'
  if ('eventReq' in e) return 'eventReq'
  if ('received' in e) return 'received'
  if ('percent' in e) return 'percent'
  if ('min' in e) return 'min'
  return 'sum'
}

function defaultFor(kind: Kind, colour: SkittleColour): AmountExpr {
  switch (kind) {
    case 'number':
      return 1
    case 'all':
      return { all: colour }
    case 'eventReq':
      return { eventReq: colour }
    case 'received':
      return { received: colour }
    case 'percent':
      return { percent: 50, of: { received: colour } }
    case 'min':
      return { min: [{ all: colour }, 1] }
    case 'sum':
      return { sum: [1, 1] }
  }
}

const clampPct = (n: number): number => Math.min(100, Math.max(0, Math.floor(n || 0)))

/** A composable, nestable editor for one amount expression (a "token block"). */
export function AmountChip({
  value,
  defaultColour,
  onChange,
  label = 'amount'
}: {
  value: AmountExpr
  defaultColour: SkittleColour
  onChange: (next: AmountExpr) => void
  label?: string
}) {
  const kind = kindOf(value)

  return (
    <span className="amt">
      <select
        className="chip"
        aria-label={`${label} kind`}
        value={kind}
        onChange={(e) => onChange(defaultFor(e.target.value as Kind, defaultColour))}
      >
        <option value="number">a number of</option>
        <option value="all">all their</option>
        <option value="eventReq">the required</option>
        <option value="received">what they received</option>
        <option value="percent">% of…</option>
        <option value="min">smallest of…</option>
        <option value="sum">total of…</option>
      </select>

      {kind === 'number' && (
        <input
          className="chip chip--num"
          type="number"
          min={0}
          aria-label={label}
          value={value as number}
          onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        />
      )}

      {(kind === 'all' || kind === 'eventReq' || kind === 'received') && (
        <ColourPicker
          label={`${label} colour`}
          value={(value as Record<string, SkittleColour>)[kind]!}
          onChange={(c) => onChange({ [kind]: c } as AmountExpr)}
        />
      )}

      {kind === 'percent' &&
        (() => {
          const v = value as { percent: number; of: AmountExpr }
          return (
            <>
              <input
                className="chip chip--num"
                type="number"
                min={0}
                max={100}
                aria-label={`${label} percent`}
                value={v.percent}
                onChange={(e) => onChange({ percent: clampPct(Number(e.target.value)), of: v.of })}
              />
              <span className="amt__kw">% of</span>
              <span className="amt__nest">
                <AmountChip
                  value={v.of}
                  defaultColour={defaultColour}
                  label={`${label} of`}
                  onChange={(of) => onChange({ percent: v.percent, of })}
                />
              </span>
            </>
          )
        })()}

      {(kind === 'min' || kind === 'sum') &&
        (() => {
          const items = (value as Record<string, AmountExpr[]>)[kind]!
          const setItems = (arr: AmountExpr[]): void => onChange({ [kind]: arr } as AmountExpr)
          return (
            <span className="amt__list">
              <span className="amt__kw">{kind === 'min' ? 'smallest of (' : 'total of ('}</span>
              {items.map((item, i) => (
                <span key={i} className="amt__item">
                  <AmountChip
                    value={item}
                    defaultColour={defaultColour}
                    label={`${label} ${i + 1}`}
                    onChange={(ni) => setItems(items.map((x, j) => (j === i ? ni : x)))}
                  />
                  {items.length > 1 && (
                    <button
                      className="chip chip--x"
                      aria-label={`remove ${label} ${i + 1}`}
                      onClick={() => setItems(items.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
              <button
                className="chip chip--add"
                aria-label={`add to ${label}`}
                onClick={() => setItems([...items, 1])}
              >
                +
              </button>
              <span className="amt__kw">)</span>
            </span>
          )
        })()}
    </span>
  )
}
