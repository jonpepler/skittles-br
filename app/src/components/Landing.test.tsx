import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Landing } from './Landing.js'

// Landing deliberately imports no networking, so it renders in jsdom without
// touching Trystero.
describe('Landing', () => {
  it('renders the title and entry actions', () => {
    render(<Landing onStart={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Skittles' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create game' })).toBeInTheDocument()
    expect(screen.getByLabelText('Room code')).toBeInTheDocument()
  })

  it('creates a game as host with a generated room code', async () => {
    const onStart = vi.fn()
    render(<Landing onStart={onStart} />)
    await userEvent.click(screen.getByRole('button', { name: 'Create game' }))
    expect(onStart).toHaveBeenCalledTimes(1)
    const [code, role] = onStart.mock.calls[0]!
    expect(role).toBe('host')
    expect(code).toMatch(/^[A-Z0-9]{5}$/)
  })

  it('joins an existing game as guest with a normalised code', async () => {
    const onStart = vi.fn()
    render(<Landing onStart={onStart} />)
    await userEvent.type(screen.getByLabelText('Room code'), ' abcde ')
    await userEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(onStart).toHaveBeenCalledWith('ABCDE', 'guest')
  })

  it('disables Join until a code is entered', () => {
    render(<Landing onStart={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Join' })).toBeDisabled()
  })
})
