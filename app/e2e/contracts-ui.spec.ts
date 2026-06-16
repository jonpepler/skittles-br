import { test } from '@playwright/test'

// Drives peers into the active phase (local transport) and screenshots the
// command-style contract editor under different statements, for visual review.
test.describe('contract/trade UI', () => {
  test('renders the command editor under various statements', async ({ browser }) => {
    const ctx = await browser.newContext()
    await ctx.addInitScript(() => {
      ;(window as unknown as { __SKITTLES_TRANSPORT__?: string }).__SKITTLES_TRANSPORT__ = 'local'
    })

    const host = await ctx.newPage()
    await host.setViewportSize({ width: 960, height: 1200 })
    await host.goto('/')
    await host.getByRole('button', { name: 'Create game' }).click()
    const code = (await host.locator('.game__code').first().innerText()).trim()

    const g1 = await ctx.newPage()
    await g1.goto(`/?room=${code}`)
    const g2 = await ctx.newPage()
    await g2.goto(`/?room=${code}`)

    await host.locator('.player-card').nth(2).waitFor({ timeout: 15_000 })
    await host.getByRole('button', { name: 'Start game' }).click()
    await host.getByRole('button', { name: 'Begin' }).click() // dismiss the start splash
    await host.getByRole('heading', { name: 'Collect skittles' }).waitFor()

    const contracts = host.locator('.contracts')
    const shot = (name: string) => contracts.screenshot({ path: `e2e/screenshots/${name}.png` })

    // 1. Default clause → a one-shot gift of two colours.
    await host.getByLabel('red amount').fill('3')
    await host.getByLabel('green', { exact: true }).click()
    await host.getByLabel('green amount').fill('2')
    await shot('contract-1-gift')

    // 2. Recurring: cover the event's required colour each event.
    await host.getByLabel('When').selectOption('event')
    await host.getByLabel('amount kind').selectOption('eventReq')
    await shot('contract-2-eventcover')

    // 3. Reactive: each time I receive red, give 50% of it.
    await host.getByLabel('When').selectOption('receive')
    await host.getByLabel('amount kind').selectOption('percent')
    await host.getByLabel('amount percent').fill('50')
    await shot('contract-3-receive-percent')

    // 4. Capped: a percentage, but at most a fixed number.
    await host.getByRole('button', { name: /limit/ }).click()
    await host.getByLabel('red limit').fill('5')
    await shot('contract-4-nested')

    // 5. Add a third party and a second clause.
    await host.getByRole('button', { name: '+ party' }).click()
    await host.getByRole('button', { name: '+ Add clause' }).click()
    await shot('contract-5-parties-multiclause')

    // 6. Propose, then show it in the active-contracts list.
    await host.getByRole('button', { name: 'Propose contract' }).click()
    await host.locator('.contracts__item').first().waitFor()
    await shot('contract-6-active')

    // 7. Negotiation: open the counter editor on the received contract.
    await host.locator('.contracts__item').getByRole('button', { name: 'Counter' }).click()
    await host.locator('.contracts__item .editor').waitFor()
    await shot('contract-7-counter')

    // 8. The quick-trade panel.
    await host.locator('.trade').screenshot({ path: 'e2e/screenshots/trade-panel.png' })

    await ctx.close()
  })
})
