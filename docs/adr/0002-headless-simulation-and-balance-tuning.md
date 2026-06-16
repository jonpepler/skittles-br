# ADR 0002 — Headless simulation for balance tuning

- **Status:** Accepted. Spike implemented against the current engine
  (`app/src/sim/`); to grow with the mechanics in [ADR 0001](./0001-game-model-and-keywords.md).
- **Date:** 2026-06-16

## Context

We want to get the mechanisms (Events, Tech, Battle, Contracts) in place and
then **fine-tune them via simulation** rather than guesswork. The game logic is
already a pure, deterministic, host-authoritative reducer (`applyAction`) with no
DOM or network, and the redacted view and structured event log already exist —
so playing full games headlessly is cheap.

## Decisions

### Design for simulation (the discipline that keeps it cheap)

- **All rules stay in the `game/` layer.** Nothing mechanically meaningful lives
  in React. Every decision a player or bot can make is expressible as a
  `GameAction` passed to `applyAction`. (This is already true; we must keep it
  true as the new mechanics land.)
- **The bot seam is one function:** a `Policy` decides actions from the
  **redacted** view a real player would see (`redactStateFor`), driven by a
  seeded `Rng`. The same seam will later let AI fill empty seats in real games.

### Determinism → git is the experiment log

- Every choice — engine *and* bot — keys off a seed. A `(seed, config)` pair
  reproduces an entire game byte-for-byte (the sim test asserts a second run is
  identical).
- The aggregated report is written to a **committed** file,
  `app/src/sim/BASELINE.md`. Because it only changes when the engine or bots
  change, **its git history _is_ the balance record** — no separate datastore or
  dashboard needed. Diff it across commits to see how a tuning change moved the
  numbers.

### What simulation is (and isn't) for

- **Tunes the physics**, not the politics: is the economy survivable-but-unfair?
  does anyone die on turn one? is escalation bounded? does the substrate *permit
  and pressure toward* hierarchy?
- It does **not** reproduce human negotiation, trust, or spite — the soul of the
  game. The classroom's "a king every time" came from people. Heuristic bots
  under-use Contracts/Coalitions/Peace, so sims under-explore exactly that
  space. Keep humans for the politics.

### Metrics (read from the event log + final state)

Survival rate, mean survivors, game length, round of first elimination,
**turn-1 death rate** (the "unfair but not instantly fatal" check), final wealth
concentration (top share), Events / transfers / eliminations per game, and
**survival by archetype**.

### Bots & the human-in-a-coalition idea

- Start with dumb **archetypes** (Spreader, Hoarder, Patron…) to stress the
  economy; negotiating/coalition bots are later, harder work.
- Seed bots that **start already in a Coalition** (a named Contract per ADR
  0001), and support **human + AI games where a human begins allied to a bot** —
  so players get tangible support without the maddening, bad-faith AI deal-making
  of games like Civ. AI allies *honour* the pact rather than negotiate it.

### Pre-commit hook (mandatory snapshot)

A repo-tracked hook at `.githooks/pre-commit` regenerates `BASELINE.md` and
stages it on every commit, so each commit carries a verified balance snapshot;
a simulation failure aborts the commit (the engine is broken). Enable once per
clone with:

```
git config core.hooksPath .githooks
```

## Guardrails as tests

The sim spec (`sim.test.ts`) currently asserts only sanity invariants and
determinism. As mechanics stabilise, promote tuning targets into **balance
assertions** (e.g. "turn-1 death rate < 5%", "median game length ∈ [x, y]",
"a dominant power emerges in > N% of games"), so regressions in feel are caught
like any other test.

## Notes / current findings

The first baseline (against the pre-redesign collect-by-action economy) shows
~2–3% survival with games over by ~round 3 — confirming that economy only ever
worked with frantic human tapping, and is exactly the kind of nit this harness
will let us tune out once the ADR 0001 mechanics exist.

## Consequences

- `npm run sim` regenerates the baseline; the sim also runs within `npm test`
  for its guardrails.
- Files: `app/src/sim/{bots,harness,sim.test}.ts` and the committed
  `app/src/sim/BASELINE.md`.
