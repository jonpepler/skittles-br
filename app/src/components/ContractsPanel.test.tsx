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

function renderPanel(overrides: Partial<Parameters<typeof ContractsPanel>[0]> = {}) {
  const props = {
    players,
    selfId: 'me',
    contracts: [],
    round: 0,
    onPropose: vi.fn(),
    onSign: vi.fn(),
    onCancel: vi.fn(),
    ...overrides
  }
  render(<ContractsPanel {...props} />)
  return props
}

describe('ContractsPanel sentence-builder', () => {
  it('proposes a one-shot gift from the default clause', async () => {
    const onPropose = vi.fn()
    renderPanel({ onPropose })
    // Default clause: "When signed, I give you a fixed amount red" with amount 1.
    await userEvent.clear(screen.getByLabelText('Amount'))
    await userEvent.type(screen.getByLabelText('Amount'), '3')
    await userEvent.selectOptions(screen.getByLabelText('Colour'), 'green')
    await userEvent.click(screen.getByRole('button', { name: 'Propose contract' }))

    const [parties, onSign, onEvent, onReceive, expires] = onPropose.mock.calls[0]!
    expect(parties).toEqual(['me', 'them'])
    expect(onSign).toEqual([{ from: 'me', to: 'them', give: { green: 3 } }])
    expect(onEvent).toEqual([])
    expect(onReceive).toEqual([])
    expect(expires).toBeNull()
  })

  it('builds the "each time I receive X, you get a %" clause', async () => {
    const onPropose = vi.fn()
    renderPanel({ onPropose })
    await userEvent.selectOptions(screen.getByLabelText('When'), 'receive')
    await userEvent.selectOptions(screen.getByLabelText('Received colour'), 'red')
    // For a receive clause the default amount kind is "% of what I received".
    await userEvent.clear(screen.getByLabelText('Amount'))
    await userEvent.type(screen.getByLabelText('Amount'), '50')
    await userEvent.click(screen.getByRole('button', { name: 'Propose contract' }))

    const [, onSign, onEvent, onReceive] = onPropose.mock.calls[0]!
    expect(onSign).toEqual([])
    expect(onEvent).toEqual([])
    expect(onReceive).toEqual([
      { from: 'me', to: 'them', give: { red: { percent: 50, of: { received: 'red' } } } }
    ])
  })

  it('shows a live English preview of the clause', async () => {
    renderPanel()
    await userEvent.selectOptions(screen.getByLabelText('When'), 'event')
    await userEvent.selectOptions(screen.getByLabelText('Amount kind'), 'eventReq')
    expect(screen.getByText(/Each event, I give you the required/)).toBeInTheDocument()
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
    renderPanel({ contracts: [contract], onSign })
    expect(screen.getByText(/1\/2 signed/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign' }))
    expect(onSign).toHaveBeenCalledWith('contract-0')
  })
})
