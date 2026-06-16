# ADR 0001 — Game model, vocabulary, and the unified rules engine

- **Status:** Accepted (design). Not yet implemented.
- **Date:** 2026-06-16
- **Context source:** the original classroom "Skittles" simulation described on the
  [No Dumb Questions podcast](https://www.reddit.com/r/NDQ/comments/1eqjuzw/skittles_game/).

## Context

The current prototype lets players mint skittles by tapping a button. That was
only ever infra-testing scaffolding, not a designed mechanic. This ADR records
the intended game and the vocabulary it is built from, so naming, UI, summaries,
card text, and the log all draw from one agreed lexicon.

The design honours the source simulation's pillars:

- **It is not fair.** Resources are dealt in unequal, random handfuls — and the
  unfairness *recurs* every round, not just at the start.
- **The goal is survival, not wealth.** Surviving to the end is the win; giving
  everything away to survive is a legitimate, even optimal, strategy.
- **Governance is emergent.** Kings, serfdom, and the occasional democratic
  coalition must *emerge* from primitives (allotment, trade, binding deals,
  force, information), never be hard-coded.
- **The system is a neutral arbiter.** The host-authoritative reducer enforces
  rules without moralising ("tough nuts").

## Decisions

### Economy

- **Remove tap-to-mint.** Skittles enter the world only via: a random, unequal
  **starting hand**; the recurring **Local Event** allotment; **Global Event**
  gains; **Opportunity** investments that yield **Tech**; **Tech** that
  **Produces** over time; and **Battle** spoils. Trades/Contracts only
  redistribute existing skittles (zero-sum).
- **Win condition is survival** to the round cap. Wealth is instrumental and is
  never scored.

### Keywords (player-facing, capitalised, one meaning everywhere)

Any capitalised term below is a defined mechanic with a single meaning in every
context, and should announce itself consistently in the UI (extending the
existing phrasing token model, which already renders colours as dots).

| Keyword | Kind | Meaning |
|---|---|---|
| **Civ** | noun | A player. |
| **Event** | noun | The thing you resolve: meet a cost and/or take a gain (either side may be zero, so a positive-only Event is valid). Local Events resolve at the **start** of a round; Global Events sit on the resolution queue and resolve at the **end**. The local/global distinction is purely queue timing — mechanically identical. |
| **Force** | noun | A specific set of your red skittles committed to a specific **Battle**. |
| **Attack** | verb / Event | The unique kind of Event describing an upcoming **Battle**. Its cost is the attacker's committed **Force**. |
| **Defend** | verb | Meet an **Attack**'s Force cost. (Pure cost-based — there is no defender tie-break advantage.) |
| **Battle** | noun | Resolution of an Attack; costly to both sides (attrition). Asymmetry comes only from Tech (e.g. "your Red counts double"), never from tactics. |
| **Conquer** | verb | **Eliminate** by losing a Battle. Spoils go to the victor; the loser's bequests are ignored. |
| **Collapse** | verb | **Eliminate** by failing a non-Attack Event. The loser's Contracts/bequests fire. |
| **Eliminate** | verb | Leave the game — by **Conquer** or **Collapse** (the umbrella). |
| **Contract** | noun | A binding agreement: *when/whenever X → Give/do Y*. A **Trade** is a self-closing Contract (executes once and expires). A **Coalition** is a named Contract. |
| **Peace** | noun | A Contract establishing a *period* of non-aggression between parties, and withdrawing any standing **Attack**. |
| **Neighbour** | noun | The visibility primitive. Neighbours can see each other's state and log. Granted naturally by the seating ring, or created with a Civ of your choice via a Tech (mutual; with counterplay). *(Replaces the earlier "Embassy" idea — the mechanic is "become Neighbours".)* |
| **Tech** | noun | A persistent card you develop: it **Produces**, or carries a triggered ability. (One-shot effects are simply Events placed on the queue, so they need no separate frame.) |
| **Tag** | noun | A label on a Tech that other Techs count or scale from (the synergy hook). |

**Action verbs** — the shared vocabulary used inside *both* Techs and Contracts:
**Produce · Invest · Convert · Give · Receive** (plus the aggression verbs
above). This is the key unification: a **Tech** is these verbs pointed at
*yourself*; a **Contract** points them at *another Civ*. One trigger→action
engine, two targets.

Collapsed / rejected as keywords:
- **Threat / Opportunity** — every Event is already a cost/benefit pair, so these
  are descriptions of an Event, not separate mechanics.
- **Trade** — folded into **Contract** (a self-closing one).
- **Embassy** — folded into **Neighbour**.

### Internal concepts (never surfaced as player keywords)

- **Frontier** — the highest Tech reached by *any* Civ.
- **Median Tech** — the median Tech level across living Civs.
- Event difficulty/era **trends toward the lower of {Median, Frontier}**, with
  occasional flavour spikes, so advancing Civs stay a step ahead rather than
  dragging everyone up at once. A slow baseline creep is a backstop so a table of
  turtles can't stall. *Difficulty is driven by collective technological
  progress ("bandits get firearms because a Civ developed gunpowder"), never by
  wealth.*
- **Era / age labels** (Stone Age, etc.) are used only to theme content and
  **must never be shown to players**.
- The **resolution queue**: Local Event (round start) → open window
  (Contracts/Trades resolve live, Attacks are declared) → Global Event → Battle.
  Some Tech may reorder or inject Events (content, not core).

### Colour leanings (loose, not laws)

Used for flavour and the occasional mechanic; cards/Events stay mostly
colour-agnostic otherwise.

| Colour | Leaning |
|---|---|
| Red | **Force** (military; internal and external defence) |
| Green | **Food** |
| Yellow | **Gold / Money** |
| Purple | **Tech / Knowledge** |
| Orange | **Resources / Industry** |

### Coalitions

- A **Coalition is a named Contract**; `become member of [name]` is a Contract
  clause that labels the agreement. Named Contracts are part of the visibility
  system.
- Membership may be a flat list of Civs *and* other Coalitions (nestable).
- Coalitions do **not** inherently prohibit aggression; behaviour is defined by
  the Contract's clauses, supporting modules such as a NATO-Article-5
  defence-only pact, trade pacts, or a full EU-style union.
- Allied **Force** is pledged per the pact's terms (leaning opt-in, so betrayal
  is possible) rather than an automatic war-on-all.

### Local Event flavour

Local Events are era-themed and narrated from the *shape* of the random
allotment (e.g. green-heavy → "An abundant harvest"; red-heavy → "Your
population is booming"). Flavour only — not a per-skittle accounting.

## Open questions

1. **Coalition visibility to an attacker** — should a Civ know, by default,
   whether its target belongs to a Coalition before committing an Attack?
2. **Peace enforcement** — purely player-led (break it freely, wear the
   reputational story), or a built-in penalty for breaking it?
3. **Battle attrition accounting** — exact bookkeeping of committed Force on both
   sides and how spoils (the remainder) transfer to the victor.
4. **Force fog** — Force is a fixed, public value by default (so an Attack is a
   routine Event); a Tech may later muddle it to a range for the target.

## Consequences

- Contracts and Techs become two faces of one declarative trigger→action engine,
  reusing and extending the existing `AmountExpr`/contract layer.
- The vocabulary above is the naming contract for all future UI, summaries, card
  text, and log entries.
