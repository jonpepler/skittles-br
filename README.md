# Skittles

A multiplayer browser game inspired by the "skittles" game from the
[No Dumb Questions](https://www.reddit.com/r/NDQ/comments/1eqjuzw/skittles_game/)
podcast. Players are procedurally generated nations, each with a flag and a
fictional name, who collect and trade coloured skittles in response to events.

## Architecture

The game is a single static site that runs peer-to-peer in the browser, so it
can be hosted for free on GitHub Pages with no backend.

Everything that used to be a separate network service is now a pure,
seed-driven TypeScript module bundled into the app. The generators are
deterministic, so peers share a tiny seed (the room code plus their peer id)
instead of transmitting flags, names or events. Every browser computes the same
output locally.

```
app/
  src/
    generators/   flag, event and name generators (pure, seedable)
    lib/          seedable PRNG + room-code helpers
    game/         host-authoritative game state (pure reducer)
    net/          Trystero (WebRTC) networking adapter
    hooks/        useGameRoom: wires transport to game state
    components/   React UI
```

### Peer-to-peer model

There is no game server. The connected peer with the lowest id is the
authoritative host. It owns the game state, validates every action, and
broadcasts the result. Guests render what they receive and route their actions
back to the host. That is also the security model: a player can only request to
collect a skittle (+1), and the host validates it, so clients can't set
arbitrary values (the gap flagged in the original Rails prototype).

Authority fails over automatically. If the host disconnects, the next-lowest
peer promotes itself and adopts the last broadcast state (preserving phase and
skittles), so a single departure doesn't end the game.

Players are seated in a ring. When the host turns it on (a lobby toggle), each
player can only see their own and their immediate neighbours' skittles. This is
enforced by true redaction (the host sends each peer only what they're allowed
to see), not just hidden in the UI. To keep failover working under redaction,
the host privately snapshots the full state, threshold-encrypted with Shamir
secret sharing, so no single peer can read the hidden skittles but any quorum
can recover the game if the host leaves.

During the active phase the host triggers events, generated deterministically
per round by the bundled event generator. Events come in two kinds. Threats
(barbarians, famine, raids) make you pay a requirement, and failing either
eliminates you or costs you skittles depending on the event. Opportunities
(technologies) let you pay to gain a reward, and if you can't afford one you
just miss out and fall behind. Flavour climbs through technological eras as the
richest player's wealth grows, so events escalate over the game. An event
happens a host-configurable number of seconds after it's revealed, and in that
window players trade skittles with anyone. The game runs for a set number of
rounds (Short, Normal or Long, or a custom count), and everyone still alive at
the end wins. It isn't last one standing; the goal is simply to last.

Trading is generalised into a declarative contracts system: smart-contracts for
skittles, expressed as data rather than code. A contract bundles transfers whose
amounts are expressions (a literal, `all of my <colour>`, `the event's required
<colour>`, a percentage of another amount, or `what I just received`) under
clauses that fire once on signing, every event, or whenever a party receives
skittles. Gifts, swaps, n-way circular trades, recurring "cover my event reds",
and "every time I get red, you get 50%" are all the same primitive. Players build
them with a guided sentence editor, and a recipient can sign or counter-offer.

The one thing that can't be fully static is WebRTC signalling: peers need a
broker to find each other before they connect directly. That is handled by
[Trystero](https://github.com/dmotz/trystero) over public Nostr relays, so
there's still no server we run.

## Develop

```sh
cd app
npm install
npm run dev        # local dev server
npm test           # vitest suite
npm run typecheck  # tsc --noEmit
npm run build      # production build into app/dist
npm run test:e2e   # Playwright tests (run `npx playwright install chromium` first)
```

To play locally across browser windows, open the dev server twice: create a
game in one (note the room code) and join with that code in the other. The
Playwright e2e tests connect several pages in one browser using a local
transport, so they exercise real multiplayer flows without external relays.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which runs the tests,
builds `app/`, and publishes `app/dist` to GitHub Pages. Enable Pages for the
repo under Settings, Pages, Source: GitHub Actions. The Vite `base` is
`/skittles-br/`; override it with the `BASE_PATH` env var if the repo is renamed
or served from a custom domain.

## History

This replaces an earlier Docker-Compose prototype (a Rails, React, Postgres and
Redis web app, with Go, Python and Node microservices for flags, events and
names). That behaviour now lives entirely in `app/` as bundled modules and a P2P
client. See the git history for the original implementation.
