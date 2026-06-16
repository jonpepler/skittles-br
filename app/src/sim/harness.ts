/**
 * Headless game simulator.
 *
 * The whole game is a pure, deterministic reducer (`applyAction`), so we can
 * play full games in-process with no UI or network: seat some bots, drive their
 * actions, trigger and resolve Events, and read metrics straight off the
 * (already structured) event log plus the final state. Everything keys off a
 * seed, so a given (seed, config) reproduces a game exactly.
 *
 * The economy is the starting-hand + per-round-allotment model (no tapping);
 * the redesigned Event-queue/Tech/Battle mechanics will layer on top, and the
 * bot seam (`Policy`) is the same one those will use.
 */
import { Rng } from '../lib/rng.js'
import { SKITTLE_COLOURS, type SkittleColour, type SkittleSet } from '../generators/event.js'
import { addPlayer, applyAction, createGame, redactStateFor } from '../game/state.js'
import type { GameState } from '../game/types.js'
import type { Policy } from './bots.js'

const COLS = SKITTLE_COLOURS
const zero = (): SkittleSet => ({ red: 0, orange: 0, yellow: 0, purple: 0, green: 0 })
const oneOf = (c: SkittleColour): SkittleSet => ({ ...zero(), [c]: 1 })
const total = (s: SkittleSet | null): number => (s ? COLS.reduce((a, c) => a + s[c], 0) : 0)

/** A five-letter room code derived from the seed, so Events differ per game. */
function roomFromSeed(seed: string): string {
  const r = new Rng(`room:${seed}`)
  return Array.from({ length: 5 }, () => String.fromCharCode(65 + r.int(26))).join('')
}

export interface GameConfig {
  players: number
  rounds: number
  policies: Policy[]
}

export interface GameResult {
  players: number
  survivors: number
  length: number
  firstElim: number | null
  turn1Deaths: number
  topShare: number
  events: number
  transfers: number
  eliminations: number
  conquests: number
  /** alive / seated, per archetype name. */
  archetype: Record<string, { alive: number; seated: number }>
}

/** Play one full game deterministically and return its metrics. */
export function runGame(seed: string, cfg: GameConfig): GameResult {
  const rng = new Rng(`bot:${seed}`)
  const room = roomFromSeed(seed)
  let s = createGame(room, 'p0')
  const seats = Array.from({ length: cfg.players }, (_, i) => `p${i}`)
  for (const id of seats) s = addPlayer(s, id)
  s = applyAction(s, 'p0', { type: 'setRounds', rounds: cfg.rounds })
  s = applyAction(s, 'p0', { type: 'setEventDuration', seconds: 5 })
  s = applyAction(s, 'p0', { type: 'start' })

  const policyOf = (id: string): Policy => cfg.policies[seats.indexOf(id) % cfg.policies.length]!
  const alive = (id: string): boolean => !!s.players[id] && !s.players[id]!.out

  let now = 0
  while (s.phase === 'active') {
    // Aggressors commit Force against a neighbour...
    for (const id of seats) {
      if (!alive(id)) continue
      const atk = policyOf(id).attack?.(redactStateFor(s, id), id, rng)
      if (atk) s = applyAction(s, id, { type: 'declareAttack', to: atk.to, force: atk.force })
    }
    // ...and a targeted nation defends with what red it can muster.
    for (const id of seats) {
      if (!alive(id)) continue
      for (const a of s.attacks.filter((a) => a.to === id)) {
        const commit = Math.min(s.players[id]?.skittles?.red ?? 0, a.force)
        if (commit > 0) s = applyAction(s, id, { type: 'defend', attackId: a.id, force: commit })
      }
    }
    // Income arrives automatically via the round's allotment (below). Bots only
    // make social moves: propose gifts, then accept any addressed to you.
    for (const id of seats) {
      if (!alive(id)) continue
      const gift = policyOf(id).aid(redactStateFor(s, id), id, rng)
      if (gift) s = applyAction(s, id, { type: 'proposeTrade', to: gift.to, give: oneOf(gift.colour), receive: zero() })
    }
    for (const id of seats) {
      if (!alive(id)) continue
      for (const o of s.offers.filter((o) => o.to === id)) {
        s = applyAction(s, id, { type: 'acceptTrade', offerId: o.id })
      }
    }
    // The host (a neutral arbiter, like the teacher) reveals and resolves.
    now += 5000
    s = applyAction(s, 'p0', { type: 'triggerEvent' }, now)
    s = applyAction(s, 'p0', { type: 'resolveEvent' })
  }

  return metrics(s, seats, policyOf)
}

function metrics(s: GameState, seats: string[], policyOf: (id: string) => Policy): GameResult {
  const totals = seats.map((id) => total(s.players[id]?.skittles ?? null))
  const sum = totals.reduce((a, b) => a + b, 0)
  const archetype: Record<string, { alive: number; seated: number }> = {}
  for (const id of seats) {
    const name = policyOf(id).name
    const a = (archetype[name] ??= { alive: 0, seated: 0 })
    a.seated++
    if (s.players[id] && !s.players[id]!.out) a.alive++
  }
  const elim = s.log.filter((e) => e.kind === 'eliminated')
  return {
    players: seats.length,
    survivors: seats.filter((id) => s.players[id] && !s.players[id]!.out).length,
    length: s.round,
    firstElim: elim.length ? Math.min(...elim.map((e) => e.round)) : null,
    turn1Deaths: elim.filter((e) => e.round === 1).length,
    topShare: sum > 0 ? Math.max(...totals) / sum : 0,
    events: s.log.filter((e) => e.kind === 'event').length,
    transfers: s.log.filter((e) => e.kind === 'transfer').length,
    eliminations: elim.length,
    conquests: s.log.filter((e) => e.kind === 'conquered').length,
    archetype
  }
}

export interface SuiteMetrics {
  games: number
  players: number
  rounds: number
  meanSurvivalRate: number
  meanSurvivors: number
  meanLength: number
  meanFirstElim: number | null
  turn1DeathRate: number
  meanTopShare: number
  meanTransfers: number
  meanEvents: number
  meanEliminations: number
  meanConquests: number
  conquestRate: number
  archetypeSurvival: Record<string, number>
}

/** Run many seeded games and aggregate. Deterministic for a fixed seed list. */
export function runSuite(seeds: string[], cfg: GameConfig): SuiteMetrics {
  const results = seeds.map((seed) => runGame(seed, cfg))
  const mean = (f: (r: GameResult) => number): number =>
    results.reduce((a, r) => a + f(r), 0) / results.length
  const firstElims = results.map((r) => r.firstElim).filter((x): x is number => x !== null)

  const arch: Record<string, { alive: number; seated: number }> = {}
  for (const r of results)
    for (const [name, a] of Object.entries(r.archetype)) {
      const acc = (arch[name] ??= { alive: 0, seated: 0 })
      acc.alive += a.alive
      acc.seated += a.seated
    }
  const archetypeSurvival = Object.fromEntries(
    Object.entries(arch).map(([n, a]) => [n, a.seated ? a.alive / a.seated : 0])
  )

  return {
    games: results.length,
    players: cfg.players,
    rounds: cfg.rounds,
    meanSurvivalRate: mean((r) => r.survivors / r.players),
    meanSurvivors: mean((r) => r.survivors),
    meanLength: mean((r) => r.length),
    meanFirstElim: firstElims.length ? firstElims.reduce((a, b) => a + b, 0) / firstElims.length : null,
    turn1DeathRate: results.filter((r) => r.turn1Deaths > 0).length / results.length,
    meanTopShare: mean((r) => r.topShare),
    meanTransfers: mean((r) => r.transfers),
    meanEvents: mean((r) => r.events),
    meanEliminations: mean((r) => r.eliminations),
    meanConquests: mean((r) => r.conquests),
    conquestRate: results.filter((r) => r.conquests > 0).length / results.length,
    archetypeSurvival
  }
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`
const n2 = (x: number | null): string => (x === null ? '—' : x.toFixed(2))

/** Render a deterministic markdown report (committed, so git diffs track drift). */
export function formatReport(m: SuiteMetrics): string {
  const arch = Object.entries(m.archetypeSurvival)
    .map(([name, rate]) => `| ${name} | ${pct(rate)} |`)
    .join('\n')
  return `# Simulation baseline

_Generated by \`src/sim/sim.test.ts\` (run \`npm run sim\`). Deterministic: this
file only changes when the engine or bots change, so its git history is the
balance experiment log. Tunes the economy's physics, not the game's politics._

- **Games:** ${m.games} (${m.players} bots each, up to ${m.rounds} rounds)
- **Economy:** random starting hand + per-round allotment (no tapping)

| Metric | Value |
|---|---|
| Mean survival rate | ${pct(m.meanSurvivalRate)} |
| Mean survivors | ${m.meanSurvivors.toFixed(2)} / ${m.players} |
| Mean game length (rounds) | ${m.meanLength.toFixed(2)} |
| Mean round of first elimination | ${n2(m.meanFirstElim)} |
| Games with a turn-1 death | ${pct(m.turn1DeathRate)} |
| Mean final wealth concentration (top share) | ${pct(m.meanTopShare)} |
| Mean Events logged / game | ${m.meanEvents.toFixed(2)} |
| Mean transfers logged / game | ${m.meanTransfers.toFixed(2)} |
| Mean eliminations / game | ${m.meanEliminations.toFixed(2)} |
| Mean conquests / game | ${m.meanConquests.toFixed(2)} |
| Games with a conquest | ${pct(m.conquestRate)} |

## Survival by archetype

| Archetype | Survival rate |
|---|---|
${arch}
`
}
