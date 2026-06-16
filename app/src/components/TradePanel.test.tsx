import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TradePanel } from './TradePanel.js'
import { emptySkittles } from '../game/state.js'
import type { PlayerState, TradeOffer } from '../game/types.js'

const player = (id: string, name: string): PlayerState => ({
  id,
  name,
  flagSeed: id,
  skittles: emptySkittles(),
  out: false
})

const players = [player('me', 'Mine'), player('them', 'Theirs')]

describe('TradePanel', () => {
  it('proposes a trade with give/receive amounts', async () => {
    const onPropose = vi.fn()
    render(
      <TradePanel
        players={players}
        selfId="me"
        offers={[]}
        onPropose={onPropose}
        onAccept={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    await userEvent.clear(screen.getByLabelText('You give red'))
    await userEvent.type(screen.getByLabelText('You give red'), '2')
    await userEvent.clear(screen.getByLabelText('You get green'))
    await userEvent.type(screen.getByLabelText('You get green'), '1')
    await userEvent.click(screen.getByRole('button', { name: 'Propose trade' }))

    expect(onPropose).toHaveBeenCalledTimes(1)
    const [to, give, receive] = onPropose.mock.calls[0]!
    expect(to).toBe('them')
    expect(give.red).toBe(2)
    expect(receive.green).toBe(1)
  })

  it('accepts and declines incoming offers', async () => {
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    const offer: TradeOffer = {
      id: 'offer-0',
      from: 'them',
      to: 'me',
      give: { ...emptySkittles(), green: 1 },
      receive: { ...emptySkittles(), red: 2 }
    }
    render(
      <TradePanel
        players={players}
        selfId="me"
        offers={[offer]}
        onPropose={vi.fn()}
        onAccept={onAccept}
        onCancel={onCancel}
      />
    )

    expect(screen.getByText('Offers to you')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(onAccept).toHaveBeenCalledWith('offer-0')
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }))
    expect(onCancel).toHaveBeenCalledWith('offer-0')
  })

  it('lets you cancel your own outgoing offer', async () => {
    const onCancel = vi.fn()
    const offer: TradeOffer = {
      id: 'offer-1',
      from: 'me',
      to: 'them',
      give: { ...emptySkittles(), red: 1 },
      receive: { ...emptySkittles(), green: 1 }
    }
    render(
      <TradePanel
        players={players}
        selfId="me"
        offers={[offer]}
        onPropose={vi.fn()}
        onAccept={vi.fn()}
        onCancel={onCancel}
      />
    )
    expect(screen.getByText('Your offers')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledWith('offer-1')
  })
})
