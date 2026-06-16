import { test, expect, type Browser, type Page } from '@playwright/test'

/**
 * Cross-peer gameplay flows over the local (BroadcastChannel) transport: things
 * unit tests can't reach — state broadcast between pages, the host's event
 * timer, and a contract negotiated back and forth.
 */

// A fixed starting hand (and per-round allotment) for deterministic holdings.
// No orange, so a famine demanding orange is unpayable.
const HAND = { red: 6, orange: 0, yellow: 6, purple: 6, green: 6 }

async function startGame(
  browser: Browser,
  forceEvent?: object
): Promise<{ host: Page; guest: Page; close: () => Promise<void> }> {
  const ctx = await browser.newContext()
  await ctx.addInitScript(() => {
    ;(window as unknown as { __SKITTLES_TRANSPORT__?: string }).__SKITTLES_TRANSPORT__ = 'local'
  })
  await ctx.addInitScript((h) => {
    ;(window as unknown as { __SKITTLES_FORCE_HAND__?: object }).__SKITTLES_FORCE_HAND__ = h
  }, HAND)
  if (forceEvent) {
    await ctx.addInitScript((ev) => {
      ;(window as unknown as { __SKITTLES_FORCE_EVENT__?: object }).__SKITTLES_FORCE_EVENT__ = ev
    }, forceEvent)
  }
  const host = await ctx.newPage()
  await host.goto('/')
  await host.getByRole('button', { name: 'Create game' }).click()
  const code = (await host.locator('.game__code').first().innerText()).trim()
  const guest = await ctx.newPage()
  await guest.goto(`/?room=${code}`)
  await expect(host.locator('.player-card')).toHaveCount(2, { timeout: 15_000 })
  return { host, guest, close: () => ctx.close() }
}

/** Read a colour count from a page's own holdings panel. */
async function holding(page: Page, colour: string): Promise<number> {
  const txt = await page.locator(`.skittle-panel .skittle--${colour}`).first().innerText()
  return Number(txt.replace(/[^0-9]/g, '')) || 0
}

test.describe('cross-peer gameplay', () => {
  test('an event is revealed to all peers and resolves after its window', async ({ browser }) => {
    const { host, guest, close } = await startGame(browser)
    await host.locator('.game__duration').fill('5') // shortest allowed window
    await host.getByRole('button', { name: 'Start game' }).click()
    await host.getByRole('button', { name: 'Begin' }).click() // dismiss the start splash
    await host.getByRole('heading', { name: 'Your skittles' }).waitFor()

    await host.getByRole('button', { name: 'Trigger first event' }).click()

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
    await host.getByRole('button', { name: 'Begin' }).click() // dismiss the start splash
    await host.getByRole('heading', { name: 'Your skittles' }).waitFor()

    const hostRed0 = await holding(host, 'red')
    const guestRed0 = await holding(guest, 'red')

    // Host proposes "when signed, I give you 2 red" (red is the default colour).
    await host.getByLabel('red amount').fill('2')
    await host.getByRole('button', { name: 'Propose contract' }).click()

    // Guest counters it down to 1 red.
    await guest.getByRole('button', { name: 'Begin' }).click() // dismiss the start splash
    await guest.locator('.contracts__item').getByRole('button', { name: 'Counter' }).click()
    const counter = guest.locator('.contracts__item .editor')
    await counter.getByLabel('red amount').fill('1')
    await counter.getByRole('button', { name: 'Send counter-offer' }).click()

    // Host re-signs the countered version, which fires: host −1 red, guest +1.
    await host.locator('.contracts__item').getByRole('button', { name: 'Sign' }).click()

    await expect.poll(() => holding(host, 'red'), { timeout: 10_000 }).toBe(hostRed0 - 1)
    await expect.poll(() => holding(guest, 'red'), { timeout: 10_000 }).toBe(guestRed0 + 1)

    await close()
  })

  test('an onEliminate contract hands skittles over when a player is knocked out', async ({
    browser
  }) => {
    // Force a threat that demands orange, which nobody has, so the host is
    // deterministically eliminated.
    const famine = {
      name: 'Forced Famine',
      description: '',
      kind: 'threat',
      fail: 'eliminate',
      requirement: { red: 0, orange: 5, yellow: 0, purple: 0, green: 0 },
      reward: { red: 0, orange: 0, yellow: 0, purple: 0, green: 0 },
      penalty: { red: 0, orange: 0, yellow: 0, purple: 0, green: 0 }
    }
    const { host, guest, close } = await startGame(browser, famine)
    await host.locator('.game__duration').fill('5')
    await host.getByRole('button', { name: 'Start game' }).click()
    await host.getByRole('button', { name: 'Begin' }).click() // dismiss the start splash
    await host.getByRole('heading', { name: 'Your skittles' }).waitFor()

    // Contract: "if I'm eliminated, give you all my red."
    await host.getByLabel('When').selectOption('eliminate')
    await host.getByLabel('amount kind').selectOption('all')
    await host.getByRole('button', { name: 'Propose contract' }).click()
    await guest.getByRole('button', { name: 'Begin' }).click() // dismiss the start splash
    await guest.locator('.contracts__item').getByRole('button', { name: 'Sign' }).click()

    await host.getByRole('button', { name: 'Trigger first event' }).click()

    // The host can't pay, is eliminated, and its red was handed over (0 left).
    const self = host.locator('.player-card--self')
    await expect(self.getByText('OUT')).toBeVisible({ timeout: 10_000 })
    await expect(self.locator('.skittle--red')).toContainText('0', { timeout: 10_000 })

    await close()
  })

  test('a direct two-way trade swaps skittles when accepted', async ({ browser }) => {
    const { host, guest, close } = await startGame(browser)
    await host.getByRole('button', { name: 'Start game' }).click()
    await host.getByRole('button', { name: 'Begin' }).click() // dismiss the start splash
    await host.getByRole('heading', { name: 'Your skittles' }).waitFor()
    await guest.getByRole('button', { name: 'Begin' }).click() // dismiss the start splash

    const hostRed0 = await holding(host, 'red')
    const hostGreen0 = await holding(host, 'green')
    const guestRed0 = await holding(guest, 'red')

    // Host offers 2 red for 1 green via the quick-trade panel.
    const form = host.locator('.trade__form')
    await form.getByLabel('You give red').fill('2')
    await form.getByLabel('You get green').fill('1')
    await host.getByRole('button', { name: 'Propose trade' }).click()

    // Guest accepts.
    await guest.locator('.trade__offer').getByRole('button', { name: 'Accept' }).click()

    await expect.poll(() => holding(host, 'green'), { timeout: 10_000 }).toBe(hostGreen0 + 1)
    await expect.poll(() => holding(host, 'red'), { timeout: 10_000 }).toBe(hostRed0 - 2)
    await expect.poll(() => holding(guest, 'red'), { timeout: 10_000 }).toBe(guestRed0 + 2)

    await close()
  })
})
