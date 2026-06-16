import { test, expect, type Browser, type Page } from '@playwright/test'

/**
 * The event log over the local transport: a trade is chronicled as a transfer,
 * and resolving an event records pay/gain plus eliminations. Also serves as a
 * visual check that a log line's chips and tokens sit on one level.
 */

const zero = { red: 0, orange: 0, yellow: 0, purple: 0, green: 0 }

async function startGame(
  browser: Browser,
  forceEvent?: object
): Promise<{ host: Page; guest: Page; close: () => Promise<void> }> {
  const ctx = await browser.newContext({ deviceScaleFactor: 2 })
  await ctx.addInitScript(() => {
    ;(window as unknown as { __SKITTLES_TRANSPORT__?: string }).__SKITTLES_TRANSPORT__ = 'local'
  })
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
  host.setViewportSize({ width: 900, height: 1300 })
  return { host, guest, close: () => ctx.close() }
}

const collect = async (page: Page, colour: string, n: number): Promise<void> => {
  const btn = page.locator(`.skittle-btn--${colour}`)
  for (let i = 0; i < n; i++) await btn.click()
  await expect(btn).toHaveAttribute('aria-label', `${colour}: ${n}`)
}

test.describe('event log', () => {
  test('chronicles an accepted trade as a transfer', async ({ browser }) => {
    const { host, guest, close } = await startGame(browser)
    await host.getByRole('button', { name: 'Start game' }).click()
    await host.getByRole('button', { name: 'Begin' }).click()
    await host.getByRole('heading', { name: 'Collect skittles' }).waitFor()
    await guest.getByRole('button', { name: 'Begin' }).click()

    await collect(host, 'red', 2)
    await collect(guest, 'green', 1)

    const form = host.locator('.trade__form')
    await form.getByLabel('You give red').fill('2')
    await form.getByLabel('You get green').fill('1')
    await host.getByRole('button', { name: 'Propose trade' }).click()
    await guest.locator('.trade__offer').getByRole('button', { name: 'Accept' }).click()

    // Both parties (neighbours in a 2-player ring) see the swap chronicled.
    const transfers = host.locator('.log__entry--transfer')
    await expect(transfers.first()).toBeVisible({ timeout: 10_000 })
    await expect(host.locator('.log')).toContainText('gave')
    await expect(guest.locator('.log__entry--transfer').first()).toBeVisible({ timeout: 10_000 })

    await host.locator('.log').scrollIntoViewIfNeeded()
    await host.locator('.log').screenshot({ path: 'e2e/screenshots/log.png' })
    await close()
  })

  test('records event pay/gain and eliminations', async ({ browser }) => {
    // A threat demanding 2 red: the host (3 red) pays and survives; the guest
    // (nothing) is eliminated.
    const threat = {
      name: 'Forced Threat',
      description: '',
      kind: 'threat',
      fail: 'eliminate',
      requirement: { ...zero, red: 2 },
      reward: { ...zero, green: 1 },
      penalty: zero
    }
    const { host, guest, close } = await startGame(browser, threat)
    await host.locator('.game__duration').fill('5')
    await host.getByRole('button', { name: 'Start game' }).click()
    await host.getByRole('button', { name: 'Begin' }).click()
    await host.getByRole('heading', { name: 'Collect skittles' }).waitFor()

    await collect(host, 'red', 3)
    await host.getByRole('button', { name: 'Trigger first event' }).click()

    // After the window the host resolves: the guest can't pay and is out.
    await expect(guest.locator('.player-card--self').getByText('OUT')).toBeVisible({
      timeout: 15_000
    })

    // The host's log shows its own pay/gain and the (public) elimination.
    await expect(host.locator('.log__entry--event')).toBeVisible({ timeout: 10_000 })
    await expect(host.locator('.log__entry--eliminated')).toBeVisible({ timeout: 10_000 })
    await expect(host.locator('.log__entry--event')).toContainText('paid')

    await close()
  })
})
