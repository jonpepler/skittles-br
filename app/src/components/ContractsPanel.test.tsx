import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContractsPanel } from './ContractsPanel.js'
import { emptySkittles } from '../game/skittles.js'
import type { PlayerState } from '../game/types.js'
import type { Contract } from '../game/contracts.js'

const player = (id: string, name: string): PlayerState => ({
  id,
  name,
  flagSeed: id,
  skittles: emptySkittles(),
  out: false
})

const players = [player('me', 'Mine'), player('them', 'Theirs')]

describe('ContractsPanel', () => {
  it('proposes a gift contract (one-way onSign transfer)', async () => {
    const onPropose = vi.fn()
    render(
      <ContractsPanel
        players={players}
        selfId="me"
        contracts={[]}
        onPropose={onPropose}
        onSign={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    await userEvent.clear(screen.getByLabelText('You give green'))
    await userEvent.type(screen.getByLabelText('You give green'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Propose contract' }))

    expect(onPropose).toHaveBeenCalledTimes(1)
    const [parties, onSign, onEvent] = onPropose.mock.calls[0]!
    expect(parties).toEqual(['me', 'them'])
    expect(onSign).toEqual([{ from: 'me', to: 'them', give: { green: 3 } }])
    expect(onEvent).toEqual([])
  })

  it('signs an incoming contract', async () => {
    const onSign = vi.fn()
    const contract: Contract = {
      id: 'contract-0',
      parties: ['them', 'me'],
      signed: ['them'],
      onSign: [{ from: 'them', to: 'me', give: { red: 2 } }],
      onEvent: [],
      onReceive: [],
      expiresRound: null,
      signFired: false
    }
    render(
      <ContractsPanel
        players={players}
        selfId="me"
        contracts={[contract]}
        onPropose={vi.fn()}
        onSign={onSign}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText(/1\/2 signed/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign' }))
    expect(onSign).toHaveBeenCalledWith('contract-0')
  })
})
