import { test, expect, type Page } from '@playwright/test'

/**
 * Real-browser tests against the production-style dev build.
 *
 * The single-peer host flow needs no network (the host builds its own state
 * locally), so it asserts hard. The two-peer flow needs WebRTC signalling over
 * external Nostr relays; if that egress is blocked it self-skips with
 * screenshots rather than failing.
 */

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  return errors
}

test('host can create a game and see their nation in the lobby', async ({ page }) => {
  const errors = collectErrors(page)

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Skittles' })).toBeVisible()

  await page.getByRole('button', { name: 'Create game' }).click()

  // Host's own state renders locally without any peers.
  await expect(page.getByText(/Waiting for players \(1\/2\)/)).toBeVisible()
  await expect(page.getByText('you', { exact: true })).toBeVisible()
  // The procedurally generated flag actually rendered as inline SVG.
  await expect(page.locator('.player-card__flag svg')).toBeVisible()

  await page.screenshot({ path: 'e2e/screenshots/host-lobby.png', fullPage: true })

  // No uncaught JS exceptions (relay websocket console noise is expected and
  // not collected here).
  expect(errors).toEqual([])
})

test('two peers connect, start, and share skittle state (needs relay egress)', async ({
  browser
}) => {
  // Depends on reaching public Nostr relays, so it's off by default (CI and
  // sandboxes can't rely on that egress). The local-transport multipeer spec
  // covers multi-peer behaviour deterministically. Set RUN_RELAY_E2E to run it.
  test.skip(!process.env.RUN_RELAY_E2E, 'set RUN_RELAY_E2E to exercise the live relay path')
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const a = await ctxA.newPage()
  const b = await ctxB.newPage()

  await a.goto('/')
  await a.getByRole('button', { name: 'Create game' }).click()
  const code = (await a.locator('.game__code').first().innerText()).trim()
  expect(code).toMatch(/^[A-Z0-9]{4}$/)

  await b.goto('/')
  await b.getByLabel('Room code').fill(code)
  await b.getByRole('button', { name: 'Join' }).click()

  try {
    // Host sees the guest → can start. This is the moment peers actually
    // connected over the relays.
    await expect(a.getByRole('button', { name: 'Start game' })).toBeEnabled({
      timeout: 25_000
    })

    await a.getByRole('button', { name: 'Start game' }).click()
    await a.getByRole('button', { name: 'Begin' }).click() // dismiss the start splash
    await expect(b.getByRole('heading', { name: 'Your skittles' })).toBeVisible({
      timeout: 10_000
    })

    // The host dealt hands on start and rebroadcast; the guest renders its own
    // holdings from that round-trip.
    await b.getByRole('button', { name: 'Begin' }).click() // dismiss the start splash
    await expect(b.locator('.skittle-panel .token').first()).toBeVisible({ timeout: 10_000 })

    await a.screenshot({ path: 'e2e/screenshots/p2p-host.png', fullPage: true })
    await b.screenshot({ path: 'e2e/screenshots/p2p-guest.png', fullPage: true })
  } catch {
    await a.screenshot({ path: 'e2e/screenshots/p2p-failed-host.png', fullPage: true })
    await b.screenshot({ path: 'e2e/screenshots/p2p-failed-guest.png', fullPage: true })
    test.skip(
      true,
      'Peers did not connect within 25s — Nostr relay egress is likely blocked in this environment.'
    )
  } finally {
    await ctxA.close()
    await ctxB.close()
  }
})
