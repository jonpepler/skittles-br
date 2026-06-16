import { SKITTLE_COLOURS } from '../generators/event.js'
import type { SkittleSet } from '../generators/event.js'
import type { LogEntry, PlayerState } from '../game/types.js'
import { FactionTitle } from './FactionTitle.js'
import { SkittleToken } from './SkittleToken.js'

/** A skittle set as inline tokens; renders "nothing" when empty. */
function Skittles({ set }: { set: SkittleSet }) {
  const parts = SKITTLE_COLOURS.filter((c) => set[c] > 0)
  if (parts.length === 0) return <span className="log__none">nothing</span>
  return (
    <>
      {parts.map((c) => (
        <SkittleToken key={c} colour={c} count={set[c]} />
      ))}
    </>
  )
}

/**
 * A reverse-chronological chronicle of core happenings: eliminations, event
 * outcomes (a cost paid for a reward) and skittles moving between players.
 * Entries are already redacted to what the viewer may see.
 */
export function GameLog({
  log,
  players,
  selfId
}: {
  log: LogEntry[]
  players: Record<string, PlayerState>
  selfId: string | null
}) {
  if (log.length === 0) return null

  const who = (id: string) => {
    const p = players[id]
    return <FactionTitle seed={p?.flagSeed ?? id} name={p?.name ?? id} self={id === selfId} size="sm" />
  }

  return (
    <section className="log" aria-label="Event log">
      <h3 className="log__title">Log</h3>
      <ol className="log__list">
        {[...log].reverse().map((e) => (
          <li key={e.id} className={`log__entry log__entry--${e.kind}`}>
            <span className="log__round">R{e.round}</span>
            <span className="log__text">
              {e.kind === 'eliminated' && <>💀 {who(e.player)} was eliminated</>}
              {e.kind === 'event' && (
                <>
                  {who(e.player)} paid <Skittles set={e.paid} /> and gained <Skittles set={e.gained} />
                </>
              )}
              {e.kind === 'transfer' && (
                <>
                  {who(e.from)} gave {who(e.to)} <Skittles set={e.skittles} />
                </>
              )}
              {e.kind === 'local' && (
                <>
                  {who(e.player)} — {e.note} <Skittles set={e.gained} />
                </>
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
