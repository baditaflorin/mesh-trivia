---
status: accepted
date: 2026-05-12
---

# 0003 — Pack format and paste-JSON UX

## Context

The app needs a way for users to bring their own questions. We can't host an upload server (Mode A constraint, ADR 0001), and we don't want a full editor in the app — that turns a 200 LOC mechanic into a 2000 LOC content-management product. We need a format that's hand-writable, copy-pasteable, easy to validate, and ships with sensible defaults so first-time users have something to play with immediately.

## Decision

A flat JSON schema, validated on paste with a hand-rolled checker — no `zod`, no `ajv`, no dependency footprint.

```ts
type QuestionPack = {
  name: string;
  questions: {
    prompt: string;
    choices: [string, string, string, string];
    correct: 0 | 1 | 2 | 3;
  }[];
};
```

- **Bundled.** Three packs ship in `src/features/trivia/packs/`: general knowledge, tech history, geography. Each has 10 questions. They're imported as JSON modules and tree-shake into the bundle.
- **Custom.** A `<textarea>` in Settings lets users paste pack JSON. The validator runs on every keystroke and shows either `Looks good — "Pack name" (12 questions)` or the first specific error (e.g. `Question 3.choices must have exactly 4 entries`).
- **Persistence.** The pasted pack is in `localStorage`; it does not auto-propagate to other peers. When a peer presses "Start with this pack," the pack itself is written into the Y.Map game state — so the other peers get the questions they need to render without trusting any one peer's local storage.
- **No upload, no remote loading.** The textarea is the only entry point. Paste from anywhere, but it has to be paste.

## Consequences

- **Friction = 0 if you have the JSON.** Drop it in, hit save, pick the pack on the pre-game screen, go.
- **The whole pack is in the Y.Map after Start.** For a 100-question pack this is fine; for a 10,000-question pack the y-webrtc message would be huge. Limit is implicit, not enforced — users with insanely large packs will discover it themselves.
- **No malicious-content scanning.** Anyone with a pack can write any prompt. This is a property of "user-generated content with no server"; same as a private wiki on someone's laptop.
- **No question-pack discovery.** There's no "browse community packs" UX. Users share packs by sharing JSON. We may add an `examples/` directory of public-domain trivia packs in a future PR.

## Alternatives considered

- **`zod` schema.** Rejected — adds 12+ KB to the bundle for a 60-line hand validator that's perfectly adequate.
- **Upload-from-file.** Considered. Paste is simpler and works on every phone (file pickers are still iffy on iOS Safari for some MIME types).
- **A separate "pack editor" UI.** Rejected — out of scope. The mechanic is "play trivia," not "be a CMS."
- **Per-question shared rendering** (each phone fetches the prompt from a peer). Rejected — too clever; the pack is small and Yjs replication is fine.
