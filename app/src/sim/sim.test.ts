import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ARCHETYPES } from './bots.js'
import { formatReport, runSuite, type GameConfig } from './harness.js'

const CFG: GameConfig = { players: 5, rounds: 12, policies: ARCHETYPES }
const SEEDS = Array.from({ length: 40 }, (_, i) => `sim-${i}`)

describe('simulation harness', () => {
  it('plays full games headlessly and produces sane, deterministic metrics', () => {
    const m = runSuite(SEEDS, CFG)

    // Sanity guardrails — these are the kind of checks that become balance
    // assertions once the real mechanics land.
    expect(m.games).toBe(SEEDS.length)
    expect(m.meanSurvivalRate).toBeGreaterThanOrEqual(0)
    expect(m.meanSurvivalRate).toBeLessThanOrEqual(1)
    expect(m.meanLength).toBeLessThanOrEqual(CFG.rounds)
    expect(m.meanLength).toBeGreaterThan(0)

    // Determinism: a second run is byte-identical (this is what makes the
    // committed baseline a trustworthy experiment log).
    const again = formatReport(runSuite(SEEDS, CFG))
    const report = formatReport(m)
    expect(again).toBe(report)

    // Refresh the committed baseline. Skipped on a read-only FS.
    try {
      writeFileSync(resolve(process.cwd(), 'src/sim/BASELINE.md'), report)
    } catch (err) {
      console.warn('sim: could not write BASELINE.md', err)
    }
  })
})
