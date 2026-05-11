# Privacy threat model — mesh-trivia

## What other peers in the same room can see

- The current game state: which pack is being played, which question is current, when the reveal happened, whether the answer has been shown.
- Your display name and your running score, in the shared scoreboard.
- Your individual answers (which choice you picked and the mesh-time of the tap), kept in `Y.Map<peerId, AnswerEntry>` keyed by question index for the duration of the room session. This is genuinely shared state — peers need it to compute scoring.
- Your `peerId` — a UUID persisted in `localStorage` (see below). This is stable across reloads on the same device.

## What stays local

- The pasted JSON pack (`mesh-trivia:customPack`) is in your `localStorage`. It does **not** sync to other peers automatically. When you press "Start" with that pack, the pack content is written into the shared game state (so other peers can render the questions); at that point those peers can see it.
- Your name, room ID, and your `peerId` are in `localStorage`.

## Permissions asked

None. No microphone, camera, motion, or notifications.

## Stable peer identity

Unlike `mesh-firefly-walk` and `mesh-pomodoro-room`, this app **does** persist a per-device identity (`peerId`). A `crypto.randomUUID()` is generated on first visit and kept in `localStorage`, so:

- Your score survives a page reload (you rejoin under the same `peerId` and the scoreboard already knows you).
- Other peers can attribute "the player who got question 3 right and question 4 wrong" to a single identity within a session.

This is a tradeoff: we lose the per-session anonymity that other mesh apps have, but gain a working leaderboard. If you don't want it, clear site data — a fresh UUID will be generated.

## What the signaling server sees

`signaling-server` (mine, source at https://github.com/baditaflorin/signaling-server) sees:

- The room name (`mesh-trivia:<roomId>`).
- Encrypted SDP offer/answer blobs being relayed.
- The IP address of the peer making the WebSocket connection.

It does **not** see game state, answers, or scores.

## What the TURN server sees

`coturn-hetzner` (mine) relays encrypted WebRTC data when peers cannot connect directly. Peer IPs, plus encrypted DTLS-SRTP bytes it cannot decrypt.

## Non-properties

- **No anti-cheat.** A peer with a Yjs decoder running before the reveal can see the `Y.Map<"singleton", { pack }>` content and thus all the future questions. We don't try to prevent this — the mechanic is "fun trivia with your friends," not "high-stakes game show."
- **No global leaderboard.** There is no off-mesh logging, no API, no Google Analytics, no Sentry. Scores die when the room dies.
