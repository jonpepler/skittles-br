import { useState } from 'react'
import type { Attack, PlayerState } from '../game/types.js'
import { FactionTitle } from './FactionTitle.js'

/** Defend an incoming Attack, pre-filled to match the attacker's Force. */
function DefendRow({
  attack,
  myRed,
  attackerName,
  attackerSeed,
  onDefend
}: {
  attack: Attack
  myRed: number
  attackerName: string
  attackerSeed: string
  onDefend: (attackId: string, force: number) => void
}) {
  const [force, setForce] = useState(attack.force)
  return (
    <div className="war__row">
      <span className="war__who">
        <FactionTitle seed={attackerSeed} name={attackerName} size="sm" /> attacks with{' '}
        <strong>{attack.force}</strong> red
        {attack.defense > 0 && <> · you hold off {attack.defense}</>}
      </span>
      <span className="war__act">
        <input
          className="chip chip--num"
          type="number"
          min={0}
          max={myRed}
          aria-label={`Defend force for ${attackerName}`}
          value={force}
          onChange={(e) => setForce(Math.max(0, Math.min(myRed, Math.floor(Number(e.target.value) || 0))))}
        />
        <button className="btn" onClick={() => onDefend(attack.id, force)} disabled={force < 1}>
          Defend
        </button>
      </span>
    </div>
  )
}

/**
 * Wage war: commit Force (red) to Attack a rival, defend incoming Attacks, or
 * withdraw your own (Peace). Attacks resolve at the next event — the attacker
 * must exceed the defence to Conquer.
 */
export function WarPanel({
  players,
  selfId,
  attacks,
  onAttack,
  onDefend,
  onWithdraw
}: {
  players: PlayerState[]
  selfId: string
  attacks: Attack[]
  onAttack: (to: string, force: number) => void
  onDefend: (attackId: string, force: number) => void
  onWithdraw: (attackId: string) => void
}) {
  const self = players.find((p) => p.id === selfId)
  const myRed = self?.skittles?.red ?? 0
  const others = players.filter((p) => p.id !== selfId && !p.out)
  const [target, setTarget] = useState(others[0]?.id ?? '')
  const [force, setForce] = useState(1)

  const nameOf = (id: string): string => players.find((p) => p.id === id)?.name ?? id
  const seedOf = (id: string): string => players.find((p) => p.id === id)?.flagSeed ?? id
  const incoming = attacks.filter((a) => a.to === selfId)
  const outgoing = attacks.filter((a) => a.from === selfId)

  const declare = (e: React.FormEvent): void => {
    e.preventDefault()
    if (target && force > 0 && force <= myRed) onAttack(target, force)
  }

  return (
    <section className="war">
      <h2>War</h2>
      <p className="game__hint">Your Force (red): {myRed}</p>

      {others.length === 0 ? (
        <p className="game__hint">No one to fight.</p>
      ) : (
        <form className="war__form" onSubmit={declare}>
          <label>
            Attack{' '}
            <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Attack target">
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            with{' '}
            <input
              className="chip chip--num"
              type="number"
              min={1}
              max={myRed}
              aria-label="Attack force"
              value={force}
              onChange={(e) => setForce(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            />{' '}
            red
          </label>
          <button className="btn" type="submit" disabled={myRed < 1 || force > myRed}>
            Declare Attack
          </button>
        </form>
      )}

      {incoming.length > 0 && (
        <div className="war__list">
          <h3>Under attack</h3>
          {incoming.map((a) => (
            <DefendRow
              key={a.id}
              attack={a}
              myRed={myRed}
              attackerName={nameOf(a.from)}
              attackerSeed={seedOf(a.from)}
              onDefend={onDefend}
            />
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="war__list">
          <h3>Your campaigns</h3>
          {outgoing.map((a) => (
            <div key={a.id} className="war__row">
              <span className="war__who">
                Marching <strong>{a.force}</strong> red on{' '}
                <FactionTitle seed={seedOf(a.to)} name={nameOf(a.to)} size="sm" />
                {a.defense > 0 && <> · they brace with {a.defense}</>}
              </span>
              <button className="btn" onClick={() => onWithdraw(a.id)}>
                Withdraw (Peace)
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
