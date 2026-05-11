# mesh-trivia

[![Live](https://img.shields.io/badge/live-baditaflorin.github.io%2Fmesh--trivia-A07CF0?style=flat-square)](https://baditaflorin.github.io/mesh-trivia/)
[![Version](https://img.shields.io/github/package-json/v/baditaflorin/mesh-trivia?style=flat-square&color=8a7a4a)](https://github.com/baditaflorin/mesh-trivia/blob/main/package.json)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![No backend](https://img.shields.io/badge/backend-none-1a160a?style=flat-square)](docs/adr/0001-deployment-mode.md)

> Peer-to-peer Kahoot. Mesh-time synchronized question reveal, fair first-to-answer scoring, unlimited players, free.

**Live:** https://baditaflorin.github.io/mesh-trivia/

Open the page on every phone in the room. Pick a pack — there are three bundled (general knowledge, tech history, geography) or paste your own JSON. Anyone presses **start**, and every phone reveals the four answers at the exact same mesh-time instant. Tap an answer; faster correct answers score higher; the running leaderboard updates after each question.

There's no host phone, no app to install, no account. You can play with a hundred phones across the world over a TURN relay and the math still works because the response-time comparison happens entirely in mesh-time on the answering phone — every phone agrees what "the instant of reveal" was.

## How it works

- Each phone joins a Yjs room over y-webrtc and runs the [mesh clock-sync](src/features/sync/clockSync.ts) primitive from `mesh-firefly-walk`.
- The game state is a `Y.Map<"singleton", { pack, currentIdx, revealAtMesh, showAnswer }>`. `revealAtMesh` is the mesh-time at which the four colored buttons unlock.
- Each answer is `Y.Map<peerId, { choice, atMesh }>`, keyed by question index.
- Scoring: `points = max(0, 1000 - (atMesh - revealAtMesh))` for correct answers, plus a +500 bonus for the first-correct. Wrong answers score 0. ([ADR 0002](docs/adr/0002-mesh-time-scoring.md))
- Packs are a flat JSON schema. Bundled packs ship with the app; users can paste their own in Settings, validated by a hand-rolled schema. ([ADR 0003](docs/adr/0003-pack-format.md))

## Question pack format

```json
{
  "name": "My pack",
  "questions": [{ "prompt": "...", "choices": ["a", "b", "c", "d"], "correct": 0 }]
}
```

`correct` is an index 0–3 into `choices`.

## Privacy threat model

See [docs/privacy.md](docs/privacy.md). Names and scores are public to peers in the room. There is no off-mesh logging.

## Architecture

- **Mode A** — pure GitHub Pages.
- **WebRTC** — Yjs + y-webrtc with self-hosted signaling and TURN.

## Run it locally

```bash
git clone https://github.com/baditaflorin/mesh-trivia.git
cd mesh-trivia
npm install
npm run dev
```

## Self-hosted infrastructure

| Repo                                                                   | Endpoint                               | Role                      |
| ---------------------------------------------------------------------- | -------------------------------------- | ------------------------- |
| [signaling-server](https://github.com/baditaflorin/signaling-server)   | `wss://turn.0docker.com/ws`            | y-webrtc protocol fan-out |
| [turn-token-server](https://github.com/baditaflorin/turn-token-server) | `https://turn.0docker.com/credentials` | HMAC TURN creds           |
| [coturn-hetzner](https://github.com/baditaflorin/coturn-hetzner)       | `turn:turn.0docker.com:3479`           | TURN relay                |

## ADRs

- [0001 — Deployment mode](docs/adr/0001-deployment-mode.md)
- [0002 — Mesh-time scoring](docs/adr/0002-mesh-time-scoring.md)
- [0003 — Pack format and paste-JSON UX](docs/adr/0003-pack-format.md)
- [0010 — GitHub Pages publishing](docs/adr/0010-pages-publishing.md)

## License

[MIT](LICENSE) © 2026 Florin Badita
