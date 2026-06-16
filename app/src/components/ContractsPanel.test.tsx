import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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
    onRevise: vi.fn(),
    onCancel: vi.fn(),
    ...overrides
  }
  render(<ContractsPanel {...props} />)
  return props
}

describe('ContractsPanel command editor', () => {
  it('proposes a one-shot gift from the default clause', async () => {
    const onPropose = vi.fn()
    renderPanel({ onPropose })
    // Add green, set it to 3, then drop the default red: a gift of 3 green.
    await userEvent.click(screen.getByLabelText('green', { exact: true }))
    await userEvent.clear(screen.getByLabelText('green amount'))
    await userEvent.type(screen.getByLabelText('green amount'), '3')
    await userEvent.click(screen.getByLabelText('red', { exact: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Propose contract' }))

    const [parties, onSign, onEvent, onReceive] = onPropose.mock.calls[0]!
    expect(parties).toEqual(['me', 'them'])
    expect(onSign).toEqual([{ from: 'me', to: 'them', give: { green: 3 } }])
    expect(onEvent).toEqual([])
    expect(onReceive).toEqual([])
  })

  it('composes a nested receive clause: 50% of what I received', async () => {
    const onPropose = vi.fn()
    renderPanel({ onPropose })
    await userEvent.selectOptions(screen.getByLabelText('When'), 'receive')
    await userEvent.selectOptions(screen.getByLabelText('amount kind'), 'percent')
    await userEvent.clear(screen.getByLabelText('amount percent'))
    await userEvent.type(screen.getByLabelText('amount percent'), '50')
    await userEvent.click(screen.getByRole('button', { name: 'Propose contract' }))

    const [, , , onReceive] = onPropose.mock.calls[0]!
    expect(onReceive).toEqual([
      { from: 'me', to: 'them', give: { red: { percent: 50, of: { received: 'red' } } } }
    ])
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
      onEliminate: [],
      onDefault: [],
      expiresRound: null,
      unpaid: false,
      signFired: false
    }
    renderPanel({ contracts: [contract], onSign })
    expect(screen.getByText(/1\/2 signed/)).toBeInTheDocument()
    // The merged summary renders faction chips + colour dots, so check the
    // summary region's text rather than one contiguous string.
    const summary = document.querySelector('.contracts__item .summary')
    expect(summary?.textContent).toMatch(/On signing/)
    expect(summary?.textContent).toMatch(/2/)
    await userEvent.click(screen.getByRole('button', { name: 'Sign' }))
    expect(onSign).toHaveBeenCalledWith('contract-0')
  })

  it('counters an incoming contract with a revised clause', async () => {
    const onRevise = vi.fn()
    const contract: Contract = {
      id: 'contract-0',
      parties: ['them', 'me'],
      signed: ['them'],
      onSign: [{ from: 'them', to: 'me', give: { red: 2 } }],
      onEvent: [],
      onReceive: [],
      onEliminate: [],
      onDefault: [],
      expiresRound: null,
      unpaid: false,
      signFired: false
    }
    renderPanel({ contracts: [contract], onRevise })
    const item = screen.getByText(/1\/2 signed/).closest('.contracts__item') as HTMLElement
    await userEvent.click(within(item).getByRole('button', { name: 'Counter' }))
    // The counter editor is pre-filled with the contract's clause (2 red).
    await userEvent.clear(within(item).getByLabelText('red amount'))
    await userEvent.type(within(item).getByLabelText('red amount'), '1')
    await userEvent.click(within(item).getByRole('button', { name: 'Send counter-offer' }))

    expect(onRevise).toHaveBeenCalledTimes(1)
    const [id, parties, onSign] = onRevise.mock.calls[0]!
    expect(id).toBe('contract-0')
    expect(parties).toEqual(['them', 'me'])
    expect(onSign).toEqual([{ from: 'them', to: 'me', give: { red: 1 } }])
  })
})
