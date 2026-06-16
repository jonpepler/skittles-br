import { test, type Page } from '@playwright/test'

/**
 * Phone-viewport screenshots of every key screen, for visual review of mobile
 * responsiveness. Uses the same-browser BroadcastChannel transport so a single
 * context can host + join a game and reach the in-game UI.
 *
 * Screenshots land in e2e/screenshots/mobile-*.png and are full-page so we can
 * spot horizontal overflow and rows that should stack.
 */

const PHONE = { width: 390, height: 844 } // iPhone 12/13/14 logical size

/** Reach the active phase with two peers; returns the host page (mobile). */
async function startActiveGame(page: Page, guest: Page): Promise<void> {
  await page.setViewportSize(PHONE)
  await page.goto('/')
  await page.getByRole('button', { name: 'Create game' }).click()
  const code = (await page.locator('.game__code').first().innerText()).trim()

  await guest.goto(`/?room=${code}`)
  await page.locator('.player-card').nth(1).waitFor({ timeout: 15_000 })
}

test.describe('mobile responsiveness', () => {
  test('landing page', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.goto('/')
    await page.getByRole('button', { name: 'Create game' }).waitFor()
    await page.screenshot({ path: 'e2e/screenshots/mobile-landing.png', fullPage: true })
  })

  test('host lobby and active game', async ({ browser }) => {
    const ctx = await browser.newContext()
    await ctx.addInitScript(() => {
      ;(window as unknown as { __SKITTLES_TRANSPORT__?: string }).__SKITTLES_TRANSPORT__ = 'local'
    })

    const host = await ctx.newPage()
    await host.setViewportSize(PHONE)
    await host.goto('/')
    await host.getByRole('button', { name: 'Create game' }).click()
    const code = (await host.locator('.game__code').first().innerText()).trim()

    // Three players so the contract editor's "+ party" control is reachable.
    const g1 = await ctx.newPage()
    await g1.goto(`/?room=${code}`)
    const g2 = await ctx.newPage()
    await g2.goto(`/?room=${code}`)
    await host.locator('.player-card').nth(2).waitFor({ timeout: 15_000 })

    // Lobby: share link + QR, the Short/Normal/Long control, host settings.
    await host.getByRole('button', { name: 'Start game' }).waitFor()
    await host.screenshot({ path: 'e2e/screenshots/mobile-lobby.png', fullPage: true })

    // Start and reach the active phase.
    await host.getByRole('button', { name: 'Start game' }).click()
    await host.getByRole('heading', { name: 'Collect skittles' }).waitFor()

    // Trigger an event so the event panel is populated.
    await host.getByRole('button', { name: 'Trigger first event' }).click()
    await host.getByText(/Event 1/).waitFor({ timeout: 10_000 })

    // Active game, full page: skittle buttons, event panel, trade, contracts.
    await host.screenshot({ path: 'e2e/screenshots/mobile-active.png', fullPage: true })

    // Individual panels for close inspection.
    await host.locator('.skittle-panel').screenshot({
      path: 'e2e/screenshots/mobile-skittles.png'
    })
    await host.locator('.event').screenshot({ path: 'e2e/screenshots/mobile-event.png' })
    await host.locator('.trade').screenshot({ path: 'e2e/screenshots/mobile-trade.png' })

    // The chip-heavy contract editor under a rich, nested statement.
    await host.getByLabel('amount', { exact: true }).fill('3')
    await host.getByLabel('Colour green').click()
    await host.getByLabel('When').selectOption('receive')
    await host.getByLabel('Received colour red').click()
    await host.getByLabel('amount kind').selectOption('min')
    await host.getByRole('button', { name: '+ party' }).click()
    await host.getByRole('button', { name: '+ Add clause' }).click()
    await host.locator('.contracts').screenshot({
      path: 'e2e/screenshots/mobile-contract-editor.png'
    })

    // Proposed contract in the list (parties, summary sticky-note, actions).
    await host.getByRole('button', { name: 'Propose contract' }).click()
    await host.locator('.contracts__item').first().waitFor()
    await host.locator('.contracts__item').first().screenshot({
      path: 'e2e/screenshots/mobile-contract-item.png'
    })

    await ctx.close()
  })

  test('game over screen', async ({ browser }) => {
    const ctx = await browser.newContext()
    await ctx.addInitScript(() => {
      ;(window as unknown as { __SKITTLES_TRANSPORT__?: string }).__SKITTLES_TRANSPORT__ = 'local'
    })
    const host = await ctx.newPage()
    const guest = await ctx.newPage()
    await guest.setViewportSize(PHONE)
    await startActiveGame(host, guest)

    // Shortest game: 1 round, so it completes after a single event resolves.
    await host.locator('.game__duration').fill('5')
    await host.getByRole('checkbox', { name: 'Custom' }).check()
    await host.getByLabel('Custom rounds').fill('1')
    await host.getByRole('button', { name: 'Start game' }).click()
    await host.getByRole('heading', { name: 'Collect skittles' }).waitFor()

    await host.getByRole('button', { name: 'Trigger first event' }).click()
    // Wait for the game to reach the complete phase (host resolves after window).
    await host.getByRole('heading', { name: 'Game over' }).waitFor({ timeout: 30_000 })
    await host.screenshot({ path: 'e2e/screenshots/mobile-gameover.png', fullPage: true })

    await ctx.close()
  })
})
