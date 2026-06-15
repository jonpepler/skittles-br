import { useState } from 'react'
import type { Contract, Transfer } from '../game/contracts.js'
import type { PlayerState } from '../game/types.js'
import { ContractEditor } from './ContractEditor.js'
import { contractToClauses, describeClause } from './contractDraft.js'

export function ContractsPanel({
  players,
  selfId,
  contracts,
  round,
  onPropose,
  onSign,
  onRevise,
  onCancel
}: {
  players: PlayerState[]
  selfId: string
  contracts: Contract[]
  round: number
  onPropose: (
    parties: string[],
    onSign: Transfer[],
    onEvent: Transfer[],
    onReceive: Transfer[],
    expiresRound: number | null
  ) => void
  onSign: (contractId: string) => void
  onRevise: (
    contractId: string,
    parties: string[],
    onSign: Transfer[],
    onEvent: Transfer[],
    onReceive: Transfer[],
    expiresRound: number | null
  ) => void
  onCancel: (contractId: string) => void
}) {
  const others = players.filter((p) => p.id !== selfId && !p.out)
  const [draftKey, setDraftKey] = useState(0)
  const [countering, setCountering] = useState<string | null>(null)

  const nameOf = (id: string): string => players.find((p) => p.id === id)?.name ?? id

  return (
    <section className="contracts">
      <h2>Contracts</h2>

      {others.length === 0 ? (
        <p className="game__hint">No one to make a contract with yet.</p>
      ) : (
        <ContractEditor
          key={draftKey}
          players={players}
          selfId={selfId}
          round={round}
          submitLabel="Propose contract"
          onSubmit={(parties, onSignT, onEventT, onReceiveT, expires) => {
            onPropose(parties, onSignT, onEventT, onReceiveT, expires)
            setDraftKey((k) => k + 1)
          }}
        />
      )}

      {contracts.length > 0 && (
        <div className="contracts__list">
          {contracts.map((c) => {
            const mine = c.signed.includes(selfId)
            const clauses = contractToClauses(c)
            return (
              <div key={c.id} className="contracts__item">
                <div className="contracts__item-body">
                  <div>
                    <strong>{c.parties.map(nameOf).join(' · ')}</strong>{' '}
                    <span className="game__hint">
                      ({c.signed.length}/{c.parties.length} signed
                      {mine ? ', incl. you' : ''})
                    </span>
                  </div>
                  <ul className="contracts__clauses">
                    {clauses.map((cl) => (
                      <li key={cl.key}>{describeClause(cl, nameOf)}</li>
                    ))}
                  </ul>

                  {countering === c.id ? (
                    <ContractEditor
                      players={players}
                      selfId={selfId}
                      round={round}
                      initialParties={c.parties}
                      initialClauses={contractToClauses(c)}
                      submitLabel="Send counter-offer"
                      onSubmit={(parties, onSignT, onEventT, onReceiveT, expires) => {
                        onRevise(c.id, parties, onSignT, onEventT, onReceiveT, expires)
                        setCountering(null)
                      }}
                      onCancel={() => setCountering(null)}
                    />
                  ) : (
                    <div className="contracts__item-actions">
                      {!mine && (
                        <button className="btn" onClick={() => onSign(c.id)}>
                          Sign
                        </button>
                      )}
                      <button className="btn" onClick={() => setCountering(c.id)}>
                        Counter
                      </button>
                      <button className="btn" onClick={() => onCancel(c.id)}>
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
