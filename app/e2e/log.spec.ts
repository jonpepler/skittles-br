import { test, expect, type Browser, type Page } from '@playwright/test'

/**
 * The event log over the local transport: a trade is chronicled as a transfer,
 * an affordable event records pay/gain, and an unpayable one records an
 * elimination. Also a visual check that a log line's chips and tokens sit level.
 */

const zero = { red: 0, orange: 0, yellow: 0, purple: 0, green: 0 }
const HAND = { red: 6, orange: 0, yellow: 6, purple: 6, green: 6 }

async function startGame(
  browser: Browser,
  forceEvent?: object
): Promise<{ host: Page; guest: Page; close: () => Promise<void> }> {
  const ctx = await browser.newContext({ deviceScaleFactor: 2 })
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
  await host.setViewportSize({ width: 900, height: 1300 })
  await host.goto('/')
  await host.getByRole('button', { name: 'Create game' }).click()
  const code = (await host.locator('.game__code').first().innerText()).trim()
  const guest = await ctx.newPage()
  await guest.goto(`/?room=${code}`)
  await expect(host.locator('.player-card')).toHaveCount(2, { timeout: 15_000 })
  return { host, guest, close: () => ctx.close() }
}

const begin = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Begin' }).click()
}

test.describe('event log', () => {
  test('chronicles an accepted trade as a transfer', async ({ browser }) => {
    const { host, guest, close } = await startGame(browser)
    await host.getByRole('button', { name: 'Start game' }).click()
    await begin(host)
    await host.getByRole('heading', { name: 'Your skittles' }).waitFor()
    await begin(guest)

    const form = host.locator('.trade__form')
    await form.getByLabel('You give red').fill('2')
    await form.getByLabel('You get green').fill('1')
    await host.getByRole('button', { name: 'Propose trade' }).click()
    await guest.locator('.trade__offer').getByRole('button', { name: 'Accept' }).click()

    // Both parties (neighbours in a 2-player ring) see the swap chronicled.
    await expect(host.locator('.log__entry--transfer').first()).toBeVisible({ timeout: 10_000 })
    await expect(host.locator('.log')).toContainText('gave')
    await expect(guest.locator('.log__entry--transfer').first()).toBeVisible({ timeout: 10_000 })

    await host.locator('.log').scrollIntoViewIfNeeded()
    await host.locator('.log').screenshot({ path: 'e2e/screenshots/log.png' })
    await close()
  })

  test('records pay/gain for an affordable event', async ({ browser }) => {
    const threat = {
      name: 'Forced Tithe',
      description: '',
      kind: 'threat',
      fail: 'penalty',
      requirement: { ...zero, red: 1 },
      reward: { ...zero, green: 1 },
      penalty: zero
    }
    const { host, close } = await startGame(browser, threat)
    await host.locator('.game__duration').fill('5')
    await host.getByRole('button', { name: 'Start game' }).click()
    await begin(host)
    await host.getByRole('heading', { name: 'Your skittles' }).waitFor()

    await host.getByRole('button', { name: 'Trigger first event' }).click()

    // Host can afford 1 red, so resolution logs a pay/gain entry.
    await expect(host.locator('.log__entry--event').first()).toBeVisible({ timeout: 15_000 })
    await expect(host.locator('.log__entry--event').first()).toContainText('paid')

    await close()
  })

  test('records an elimination for an unpayable event', async ({ browser }) => {
    const famine = {
      name: 'Forced Famine',
      description: '',
      kind: 'threat',
      fail: 'eliminate',
      requirement: { ...zero, orange: 9 }, // nobody holds orange
      reward: zero,
      penalty: zero
    }
    const { host, close } = await startGame(browser, famine)
    await host.locator('.game__duration').fill('5')
    await host.getByRole('button', { name: 'Start game' }).click()
    await begin(host)
    await host.getByRole('heading', { name: 'Your skittles' }).waitFor()

    await host.getByRole('button', { name: 'Trigger first event' }).click()

    await expect(host.locator('.log__entry--eliminated').first()).toBeVisible({ timeout: 15_000 })
    await expect(host.locator('.log__entry--eliminated').first()).toContainText('eliminated')

    await close()
  })
})
