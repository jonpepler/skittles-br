# Skittles

A multiplayer browser game inspired by the "skittles" game from the
[No Dumb Questions](https://www.reddit.com/r/NDQ/comments/1eqjuzw/skittles_game/)
podcast. Players are procedurally generated nations — each with a flag and a
fictional name — who collect and trade coloured skittles in response to events.

## Architecture

The game is a **single static site** that runs **peer-to-peer** in the browser,
so it can be hosted for free on GitHub Pages with no backend.

Everything that used to be a separate network service is now a pure,
**seed-driven** TypeScript module bundled into the app. Because the generators
are deterministic, peers share a tiny seed (the room code + their peer id)
instead of transmitting flags, names or events — every browser computes
identical output locally.

```
app/
  src/
    generators/   flag, event and name generators (pure, seedable)
    lib/          seedable PRNG + room-code helpers
    game/         host-authoritative game state (pure reducer)
    net/          Trystero (WebRTC) networking adapter
    hooks/        useGameRoom — wires transport to game state
    components/   React UI
```

### Peer-to-peer model

There is no game server. The connected peer with the lowest id is the
**authoritative host**: it owns the game state, validates every action, and
broadcasts the result. Guests render what they receive and route their actions
back to the host. This is also the security model: a player can only *request*
to collect a skittle (+1); the host validates it, so clients can't set
arbitrary values (the gap flagged in the original Rails prototype).

Authority fails over automatically: if the host disconnects, the next-lowest
peer promotes itself and adopts the last broadcast state (preserving phase and
skittles), so a single departure doesn't end the game.

Players are seated in a **ring** and can only see their own and their immediate
neighbours' skittles — enforced by true redaction (the host sends each peer only
what they're allowed to see), not just in the UI. Failover is preserved by
privately snapshotting the full state to the designated successor.

During the active phase the host triggers **events** — generated
deterministically per round by the bundled event generator — which carry a
requirement, reward and penalty. An event "happens" a host-configurable number
of seconds after it's revealed; in that window players **trade** skittles with
anyone (propose/accept/cancel). On resolution each player who can afford the
requirement spends it for the reward, and everyone else takes the penalty.

The only thing that can't be fully static is **WebRTC signalling** — peers need
a broker to find each other before connecting directly. That's handled by
[Trystero](https://github.com/dmotz/trystero) over public Nostr relays, so
there's still no server we host.

## Develop

```sh
cd app
npm install
npm run dev        # local dev server
npm test           # vitest suite
npm run typecheck  # tsc --noEmit
npm run build      # production build into app/dist
npm run test:e2e   # Playwright real-browser tests (run `npx playwright install chromium` first)
```

The Playwright suite asserts the host flow in a real browser; its two-peer test
needs WebRTC relay egress and self-skips where that's unavailable.

To play locally across two browser windows, open the dev server twice: create a
game in one (note the room code) and join with that code in the other.

## Deploy

Pushing to `master` runs `.github/workflows/deploy.yml`, which builds `app/` and
publishes `app/dist` to GitHub Pages. Enable Pages for the repo with **Settings →
Pages → Source: GitHub Actions**. The Vite `base` is `/skittles-br/`; override it
with the `BASE_PATH` env var if the repo is renamed or served from a custom
domain.

## History

This replaces an earlier Docker-Compose prototype (Rails + React + Postgres +
Redis web app, with Go/Python/Node flag, event and name microservices). That
behaviour now lives entirely in `app/` as bundled modules and a P2P client; see
the git history for the original implementation.
