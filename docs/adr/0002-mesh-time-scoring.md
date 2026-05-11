---
status: accepted
date: 2026-05-12
---

# 0002 — Mesh-time scoring

## Context

The product promise is "fair first-to-answer across any number of phones." Naive timing — "I reveal the question now, you reveal it 30 ms later, my fast answer wins" — is unfair: the inter-phone latency dominates the response-time signal for fast players. We need a comparison metric where the network and clock skew between phones cancels out and only the actual human response-time matters.

## Decision

Reveal and tap are both measured in **mesh-time** on the same phone that's answering.

1. Pressing "start a question" writes to the game Y.Map: `{ revealAtMesh: meshNow() + 1200, ... }` — i.e., schedules the reveal 1.2 s in the future. Every phone reads the same `revealAtMesh`.
2. Each phone renders its "buttons unlock" UI when its local `clock.meshNow() >= revealAtMesh`. Because mesh-clock is the same function on every phone fed by the same awareness state, that boundary lands on every phone within clock-sync precision (~10–30 ms).
3. When a peer taps, that peer records `atMesh = clock.meshNow()` into the answer Y.Map.
4. The score is computed against the response time as observed by that peer's own clock-sync: `responseMs = atMesh - revealAtMesh`. Per-phone wall-clock drift cancels out because both numbers come from the same `clock.meshNow()`.
5. Formula: `basePoints = max(0, 1000 - responseMs)` (clamped, no floor below zero). The first-correct answerer gets an additional **+500** bonus. Wrong answers always score 0 — no participation prize.

```ts
points = correct ? max(0, 1000 - responseMs) + (firstCorrect ? 500 : 0) : 0;
```

## Consequences

- **Two phones with different wall-clocks score identically** for the same human response-time. That's the whole point.
- **The 1.2 s reveal delay** smooths over slow clock-sync convergence. A fresh joiner whose clock-sync hasn't settled gets 1+ second before buttons unlock; by that time the offset has had two awareness rounds to stabilize.
- **First-correct is a meaningful +500.** With base capped at 1000 and 1 point/ms decay, the bonus is worth ~500 ms of speed. So a slower-by-half-a-second first-correct still beats a faster-but-second correct, which feels right for a trivia mechanic.
- **No latency-fairness for slow phones.** A phone whose WebRTC mesh has 300 ms of latency to the rest of the room still sees the question render exactly when everyone else does (because the reveal time is shared CRDT state). The render-time delta is the responsiveness of that phone's local UI, which can't be hidden.

## Alternatives considered

- **Each phone reveals on its own `setTimeout` after the start press.** Rejected — the start press itself takes time to propagate, so the start-times diverge. Mesh-time fixes the comparison point.
- **Score by Date.now() difference.** Rejected — wall-clock skew between phones would be visible in the score.
- **Server-authoritative scoring (server sees all answers, awards points).** Rejected — Mode A constraint (no backend). Also the surveillance affordance is wrong for a free P2P toy.
