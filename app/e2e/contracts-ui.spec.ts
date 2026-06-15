import { test } from '@playwright/test'

// Drives two peers into the active phase (local transport) and screenshots the
// contract/trade UI under different statements, for visual review.
test.describe('contract/trade UI', () => {
  test('renders the builder under various statements', async ({ browser }) => {
    const ctx = await browser.newContext()
    await ctx.addInitScript(() => {
      ;(window as unknown as { __SKITTLES_TRANSPORT__?: string }).__SKITTLES_TRANSPORT__ = 'local'
    })

    const host = await ctx.newPage()
    await host.setViewportSize({ width: 900, height: 1000 })
    await host.goto('/')
    await host.getByRole('button', { name: 'Create game' }).click()
    const code = (await host.locator('.game__code').first().innerText()).trim()

    const guest = await ctx.newPage()
    await guest.goto(`/?room=${code}`)

    await host.locator('.player-card').nth(1).waitFor({ timeout: 15_000 })
    await host.getByRole('button', { name: 'Start game' }).click()
    await host.getByRole('heading', { name: 'Collect skittles' }).waitFor()

    const contracts = host.locator('.contracts')
    const shot = (name: string) =>
      contracts.screenshot({ path: `e2e/screenshots/${name}.png` })

    // 1. Default clause: a one-shot gift.
    await host.getByLabel('Amount', { exact: true }).fill('3')
    await host.getByLabel('Colour', { exact: true }).selectOption('green')
    await shot('contract-1-gift')

    // 2. Recurring: cover the event's required colour each event.
    await host.getByLabel('When').selectOption('event')
    await host.getByLabel('Amount kind').selectOption('eventReq')
    await host.getByLabel('Colour', { exact: true }).selectOption('red')
    await shot('contract-2-eventcover')

    // 3. Reactive: each time I receive red, you get 50%.
    await host.getByLabel('When').selectOption('receive')
    await host.getByLabel('Received colour').selectOption('red')
    await host.getByLabel('Amount', { exact: true }).fill('50')
    await shot('contract-3-receive-percent')

    // 4. Multiple stacked clauses.
    await host.getByRole('button', { name: '+ Add clause' }).click()
    await shot('contract-4-multiclause')

    // 5. Propose it, then show it in the active-contracts list.
    await host.getByRole('button', { name: 'Propose contract' }).click()
    await host.locator('.contracts__item').first().waitFor()
    await shot('contract-5-active')

    // 6. The quick-trade panel.
    await host.locator('.trade').screenshot({ path: 'e2e/screenshots/trade-panel.png' })

    await ctx.close()
  })
})
