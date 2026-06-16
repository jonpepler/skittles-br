import { test, expect, type Browser, type Page } from '@playwright/test'

/**
 * Aggression end-to-end over the local transport: declare an Attack with Force,
 * the target Defends or the attacker withdraws (Peace), else Conquer at the
 * next event. Forced hands give deterministic Force; a benign forced event lets
 * the Battle — not the event — decide who's eliminated.
 */

const zero = { red: 0, orange: 0, yellow: 0, purple: 0, green: 0 }
const HAND = { red: 6, orange: 0, yellow: 6, purple: 6, green: 6 }
const CALM = {
  name: 'A Calm Year',
  description: '',
  kind: 'opportunity',
  fail: 'none',
  requirement: zero,
  reward: zero,
  penalty: zero
}

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

const begin = (page: Page): Promise<void> => page.getByRole('button', { name: 'Begin' }).click()

const declareAttack = async (host: Page, force: number): Promise<void> => {
  await host.getByLabel('Attack target').selectOption({ index: 0 })
  await host.getByLabel('Attack force').fill(String(force))
  await host.getByRole('button', { name: 'Declare Attack' }).click()
}

test.describe('aggression', () => {
  test('an undefended Attack Conquers the target at the next event', async ({ browser }) => {
    const { host, guest, close } = await startGame(browser, CALM)
    await host.locator('.game__duration').fill('5')
    await host.getByRole('button', { name: 'Start game' }).click()
    await begin(host)
    await host.getByRole('heading', { name: 'Your skittles' }).waitFor()
    await begin(guest)

    await declareAttack(host, 5) // guest does not Defend
    await host.getByRole('button', { name: 'Trigger first event' }).click()

    await expect(guest.locator('.player-card--self').getByText('OUT')).toBeVisible({ timeout: 15_000 })
    await expect(host.locator('.log__entry--conquered').first()).toBeVisible({ timeout: 10_000 })
    await expect(host.locator('.log__entry--conquered').first()).toContainText('conquered')

    await close()
  })

  test('a matched Defence repels the Attack', async ({ browser }) => {
    const { host, guest, close } = await startGame(browser, CALM)
    await host.locator('.game__duration').fill('5')
    await host.getByRole('button', { name: 'Start game' }).click()
    await begin(host)
    await host.getByRole('heading', { name: 'Your skittles' }).waitFor()
    await begin(guest)

    await declareAttack(host, 3)
    await guest.getByLabel(/Defend force/).fill('3') // ties favour the defender
    await guest.getByRole('button', { name: 'Defend' }).click()
    await host.getByRole('button', { name: 'Trigger first event' }).click()

    // Wait for resolution, then confirm the guest survived and nobody was conquered.
    await expect(host.getByText(/Resolves in/)).toHaveCount(0, { timeout: 15_000 })
    await expect(guest.locator('.player-card--self').getByText('OUT')).toHaveCount(0)
    await expect(host.locator('.log__entry--conquered')).toHaveCount(0)

    await close()
  })

  test('the attacker can withdraw (Peace) before any Battle', async ({ browser }) => {
    const { host, guest, close } = await startGame(browser)
    await host.getByRole('button', { name: 'Start game' }).click()
    await begin(host)
    await host.getByRole('heading', { name: 'Your skittles' }).waitFor()

    await declareAttack(host, 4)
    await expect(host.getByRole('button', { name: /Withdraw/ })).toBeVisible()
    await host.getByRole('button', { name: /Withdraw/ }).click()
    await expect(host.getByRole('button', { name: /Withdraw/ })).toHaveCount(0)

    await close()
  })
})
