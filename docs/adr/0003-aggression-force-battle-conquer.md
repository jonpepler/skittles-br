# ADR 0003 — Aggression: Force, Attack, Battle, Conquer

- **Status:** Accepted. Implementation in progress (engine → sim → UI → e2e).
- **Date:** 2026-06-16
- **Builds on:** [ADR 0001](./0001-game-model-and-keywords.md) (keywords, Conquer/Collapse), [ADR 0002](./0002-headless-simulation-and-balance-tuning.md) (sim baseline).

## Context

The economy is in place but there's no way to commit force against another
nation — and per the source simulation, *conquest* is the climax: it's how
kings, serfdom, and coalitions actually form. This ADR locks the v1 aggression
model and resolves the questions ADR 0001 parked.

## Decisions (v1)

- **Force** is red skittles committed to a specific **Attack**. Committing moves
  the red *out of your holdings into escrow* on the Attack, so it can't be spent
  twice.
- **Attack** — a nation declares an Attack on a target, committing some Force.
  The committed amount is a **fixed, public** value (an Attack is a routine,
  legible event; a fog-of-war Tech can muddle it to a range later).
- **Defend** — the target commits matching Force to its defence (also escrowed).
- **Battle resolution** happens at the **Battle step of the cycle**, which for
  now runs inside `resolveEvent` (event consequences first, then Battles), until
  the full Local→Global→Battle queue exists. The attacker must **exceed** the
  defender (ties favour the defender). Win or lose, **both committed Forces are
  consumed** — war is costly to both; asymmetry comes only from future Tech
  (e.g. "your Red counts double"), never from tactics.
- **Conquer** — losing a Battle. The victor seizes the loser's entire remaining
  holdings; the loser is Eliminated and their **onEliminate bequests are
  suppressed** (the conqueror takes the spoils, not the contractual heirs).
- **Collapse** — Eliminated by failing a Threat (unchanged): onEliminate
  bequests **do** fire. So *how* you die matters — a cornered nation can choose
  to Collapse (deliberately default, handing everything to an ally) rather than
  be Conquered. Both are **Eliminate**.
- **Peace** — the attacker **withdrawing** the Attack (escrow returned). v1 ships
  a `withdrawAttack` action; peace is *brokered* by the target giving the
  attacker a reason to withdraw via the existing Contract system (tribute /
  serfdom). Folding withdrawal into a first-class **Peace** Contract clause is a
  follow-up.
- **Log** — a Conquer emits a public `conquered` entry `{ attacker, target,
  spoils }`, so the sim can measure conquest and the UI can show it.

## Deferred (not in v1)

- **Coalitions / pooled Force** — multiple attackers (and pledged allied
  defence) summing in one Battle. Needs the named-Contract coalition model from
  ADR 0001.
- **Fog of war** — Force hidden as a range; a Tech.
- **Embassy/Neighbour-created visibility** and the full Local→Global→Battle
  resolution queue.

## Verification

The done-condition is the sim baseline: an **Aggressor** bot that commits Force,
plus metrics for conquests/game and wealth concentration, should show conquest
*emerging* (kings forming) — deterministically, tracked in `BASELINE.md`. Plus
unit tests for Battle resolution and an e2e for the Attack→Conquer / →repel /
→Peace flows.

## Draft goal for the next stage

**Tech & Tags (the engine layer).** Opportunities grant persistent **Tech**
cards (Terraforming-Mars-style: Automated/Produce, Active/triggered, with
**Tags** other cards scale from), built on a unified **trigger→action** language
that generalises Contracts (actions aimed at others) and Tech (actions aimed at
yourself): `Produce / Invest / Convert / Give / Receive`. This is what turns the
survival economy into the "living card game" and gives the Frontier difficulty
signal (median/highest Tech) real meaning — superseding the interim round-based
ramp.
