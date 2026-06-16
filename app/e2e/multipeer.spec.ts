import { test, expect } from '@playwright/test'

// Real multi-peer test in one browser. The app's transport is swapped for a
// BroadcastChannel implementation (set before load), so pages in the same
// context actually connect — exercising the real game logic, host failover and
// (since 127.0.0.1 is a secure context) the threshold-encrypted backup.
test.describe('multi-peer (local transport)', () => {
  test('three peers connect, and a guest takes over when the host leaves', async ({
    browser
  }) => {
    const ctx = await browser.newContext()
    await ctx.addInitScript(() => {
      ;(window as unknown as { __SKITTLES_TRANSPORT__?: string }).__SKITTLES_TRANSPORT__ = 'local'
    })

    const host = await ctx.newPage()
    await host.goto('/')
    await host.getByRole('button', { name: 'Create game' }).click()
    const code = (await host.locator('.game__code').first().innerText()).trim()

    const g1 = await ctx.newPage()
    await g1.goto(`/?room=${code}`)
    const g2 = await ctx.newPage()
    await g2.goto(`/?room=${code}`)

    // All three discover each other.
    await expect(host.locator('.player-card')).toHaveCount(3, { timeout: 15_000 })
    await expect(g1.locator('.player-card')).toHaveCount(3, { timeout: 15_000 })

    // Host starts the game; guests enter the active phase.
    await host.getByRole('button', { name: 'Start game' }).click()
    await expect(g1.getByRole('heading', { name: 'Your skittles' })).toBeVisible({
      timeout: 10_000
    })

    // The host disconnects — a remaining guest must promote itself (failover).
    await host.close()
    await expect
      .poll(
        async () => (await g1.locator('.game__host').count()) + (await g2.locator('.game__host').count()),
        { timeout: 15_000 }
      )
      .toBeGreaterThan(0)

    // The game continues with the two survivors.
    await expect(g1.locator('.player-card')).toHaveCount(2, { timeout: 10_000 })
    await ctx.close()
  })
})
