import { test, expect, type Browser, type Page } from '@playwright/test'

/**
 * Cross-peer gameplay flows over the local (BroadcastChannel) transport: things
 * unit tests can't reach — state broadcast between pages, the host's event
 * timer, and a contract negotiated back and forth.
 */

async function startGame(browser: Browser): Promise<{ host: Page; guest: Page; close: () => Promise<void> }> {
  const ctx = await browser.newContext()
  await ctx.addInitScript(() => {
    ;(window as unknown as { __SKITTLES_TRANSPORT__?: string }).__SKITTLES_TRANSPORT__ = 'local'
  })
  const host = await ctx.newPage()
  await host.goto('/')
  await host.getByRole('button', { name: 'Create game' }).click()
  const code = (await host.locator('.game__code').first().innerText()).trim()
  const guest = await ctx.newPage()
  await guest.goto(`/?room=${code}`)
  await expect(host.locator('.player-card')).toHaveCount(2, { timeout: 15_000 })
  return { host, guest, close: () => ctx.close() }
}

/** Collect `n` of a colour on a page, waiting for the count to settle. */
async function collect(page: Page, colour: string, n: number): Promise<void> {
  const btn = page.locator(`.skittle-btn--${colour}`)
  for (let i = 0; i < n; i++) await btn.click()
  await expect(btn).toContainText(`${colour}: ${n}`)
}

test.describe('cross-peer gameplay', () => {
  test('an event is revealed to all peers and resolves after its window', async ({ browser }) => {
    const { host, guest, close } = await startGame(browser)
    await host.locator('.game__duration').fill('5') // shortest allowed window
    await host.getByRole('button', { name: 'Start game' }).click()
    await host.getByRole('heading', { name: 'Collect skittles' }).waitFor()

    await host.getByRole('button', { name: 'Trigger event' }).click()

    // Both the host and the guest see the same event with a countdown.
    await expect(host.getByText('Event 1')).toBeVisible()
    await expect(host.getByText(/Resolves in/)).toBeVisible()
    await expect(guest.getByText('Event 1')).toBeVisible({ timeout: 10_000 })

    // After the window elapses the host resolves it and the event clears.
    await expect(host.getByText(/Resolves in/)).toHaveCount(0, { timeout: 10_000 })

    await close()
  })

  test('a contract is negotiated back and forth, then executes', async ({ browser }) => {
    const { host, guest, close } = await startGame(browser)
    await host.getByRole('button', { name: 'Start game' }).click()
    await host.getByRole('heading', { name: 'Collect skittles' }).waitFor()

    // Host stocks up so it can honour the contract.
    await collect(host, 'red', 3)

    // Host proposes: "when signed, I give you 2 red".
    await host.getByLabel('amount', { exact: true }).fill('2')
    await host.getByLabel('Colour red').click()
    await host.getByRole('button', { name: 'Propose contract' }).click()

    // Guest counters it down to 1 red.
    await guest.locator('.contracts__item').getByRole('button', { name: 'Counter' }).click()
    const counter = guest.locator('.contracts__item .editor')
    await counter.getByLabel('amount', { exact: true }).fill('1')
    await counter.getByRole('button', { name: 'Send counter-offer' }).click()

    // Host re-signs the countered version, which fires: host −1 red, guest +1.
    await host.locator('.contracts__item').getByRole('button', { name: 'Sign' }).click()

    await expect(host.locator('.skittle-btn--red')).toContainText('red: 2', { timeout: 10_000 })
    await expect(guest.locator('.skittle-btn--red')).toContainText('red: 1', { timeout: 10_000 })

    await close()
  })

  test('an onEliminate contract hands skittles over when a player is knocked out', async ({
    browser
  }) => {
    const { host, guest, close } = await startGame(browser)
    await host.locator('.game__duration').fill('5')
    await host.getByRole('button', { name: 'Start game' }).click()
    await host.getByRole('heading', { name: 'Collect skittles' }).waitFor()

    // Host collects only red, so it will fail an event gate (which needs some
    // of every colour) and get eliminated, with red to hand over.
    await collect(host, 'red', 3)

    // Contract: "if I'm eliminated, give you all my red."
    await host.getByLabel('When').selectOption('eliminate')
    await host.getByLabel('amount kind').selectOption('all')
    await host.getByRole('button', { name: 'Propose contract' }).click()
    await guest.locator('.contracts__item').getByRole('button', { name: 'Sign' }).click()

    await host.getByRole('button', { name: 'Trigger event' }).click()

    // After the event resolves, the host is out and its red has been handed over
    // (would still be 3 if onEliminate hadn't fired, since elimination keeps
    // skittles).
    const self = host.locator('.player-card--self')
    await expect(self.getByText('OUT')).toBeVisible({ timeout: 10_000 })
    await expect(self.locator('.skittle--red')).toContainText('0', { timeout: 10_000 })

    await close()
  })

  test('a direct two-way trade swaps skittles when accepted', async ({ browser }) => {
    const { host, guest, close } = await startGame(browser)
    await host.getByRole('button', { name: 'Start game' }).click()
    await host.getByRole('heading', { name: 'Collect skittles' }).waitFor()

    await collect(host, 'red', 2)
    await collect(guest, 'green', 1)

    // Host offers 2 red for 1 green via the quick-trade panel.
    const form = host.locator('.trade__form')
    await form.getByLabel('You give red').fill('2')
    await form.getByLabel('You get green').fill('1')
    await host.getByRole('button', { name: 'Propose trade' }).click()

    // Guest accepts.
    await guest.locator('.trade__offer').getByRole('button', { name: 'Accept' }).click()

    await expect(host.locator('.skittle-btn--green')).toContainText('green: 1', { timeout: 10_000 })
    await expect(host.locator('.skittle-btn--red')).toContainText('red: 0', { timeout: 10_000 })
    await expect(guest.locator('.skittle-btn--red')).toContainText('red: 2', { timeout: 10_000 })

    await close()
  })
})
