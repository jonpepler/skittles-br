import { useState } from 'react'
import type { Contract, Transfer } from '../game/contracts.js'
import type { PlayerState } from '../game/types.js'
import { ContractEditor } from './ContractEditor.js'
import { contractToClauses } from './contractDraft.js'
import { ContractSummary } from './ContractSummary.js'
import { FactionTitle } from './FactionTitle.js'

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
    onEliminate: Transfer[],
    expiresRound: number | null
  ) => void
  onSign: (contractId: string) => void
  onRevise: (
    contractId: string,
    parties: string[],
    onSign: Transfer[],
    onEvent: Transfer[],
    onReceive: Transfer[],
    onEliminate: Transfer[],
    expiresRound: number | null
  ) => void
  onCancel: (contractId: string) => void
}) {
  const others = players.filter((p) => p.id !== selfId && !p.out)
  const [draftKey, setDraftKey] = useState(0)
  const [countering, setCountering] = useState<string | null>(null)

  const playerMap = Object.fromEntries(
    players.map((p) => [p.id, { name: p.name, flagSeed: p.flagSeed }])
  )

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
          onSubmit={(parties, onSignT, onEventT, onReceiveT, onElimT, expires) => {
            onPropose(parties, onSignT, onEventT, onReceiveT, onElimT, expires)
            setDraftKey((k) => k + 1)
          }}
        />
      )}

      {contracts.length > 0 && (
        <div className="contracts__list">
          {contracts.map((c) => {
            const mine = c.signed.includes(selfId)
            return (
              <div key={c.id} className="contracts__item">
                <div className="contracts__item-body">
                  <div className="contracts__item-parties">
                    {c.parties.map((id) => (
                      <FactionTitle
                        key={id}
                        seed={playerMap[id]?.flagSeed ?? id}
                        name={playerMap[id]?.name ?? id}
                        self={id === selfId}
                        size="sm"
                      />
                    ))}
                    <span className="game__hint">
                      {c.signed.length}/{c.parties.length} signed
                      {mine ? ', incl. you' : ''}
                    </span>
                    {c.unpaid && <span className="contracts__unpaid">⚠ payment missed</span>}
                  </div>
                  <ContractSummary
                    buckets={{
                      onSign: c.onSign,
                      onEvent: c.onEvent,
                      onReceive: c.onReceive,
                      onEliminate: c.onEliminate
                    }}
                    players={playerMap}
                    viewerId={selfId}
                  />

                  {countering === c.id ? (
                    <ContractEditor
                      players={players}
                      selfId={selfId}
                      round={round}
                      initialParties={c.parties}
                      initialClauses={contractToClauses(c)}
                      submitLabel="Send counter-offer"
                      onSubmit={(parties, onSignT, onEventT, onReceiveT, onElimT, expires) => {
                        onRevise(c.id, parties, onSignT, onEventT, onReceiveT, onElimT, expires)
                        setCountering(null)
                      }}
                      onCancel={() => setCountering(null)}
                    />
                  ) : (
                    <div className="contracts__item-actions">
                      {c.signFired ? (
                        // A live contract can't be renegotiated, only voided.
                        <button className="btn" onClick={() => onCancel(c.id)}>
                          Void contract
                        </button>
                      ) : (
                        <>
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
                        </>
                      )}
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
