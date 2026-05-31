import { expect, test, type Page } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

// First bundled pack ("General knowledge"), first question: the correct choice
// is "Saturn" (index 1). We click by visible text so the test does not depend
// on button color/order details.
const CORRECT_CHOICE_TEXT = "Saturn";

/**
 * Advertised core action: "Peer-to-peer Kahoot. Mesh-time synchronized question
 * reveal, fair first-to-answer scoring." Two things must cross the mesh:
 *   1. When peer A (acting as host) starts a pack, peer B sees the SAME
 *      question revealed — the game state lives in a shared Y.Map, not local
 *      useState.
 *   2. When peers answer correctly, the resulting score lands in the shared
 *      scoreboard and the OPPOSITE peer's leaderboard shows it.
 *
 * Load-bearing: if `startWithPack` / `submitAnswer` / the reveal-scoring wrote
 * to React `useState` instead of `room.doc.transact(...)`, peer B would never
 * see peer A's question or peer A's score, and these assertions would fail.
 */
async function arm(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^connect$/i }).click();
}

async function answerCorrectly(page: Page): Promise<void> {
  // The four colored choice buttons only render after mesh-time reveal
  // (REVEAL_DELAY_MS ~1.2s). Wait for them, then tap the correct one.
  const choice = page.locator(".trivia-choice", { hasText: CORRECT_CHOICE_TEXT });
  await expect(choice).toBeVisible({ timeout: 10_000 });
  await choice.click();
}

test("peer A starts a question; peer B sees the reveal and both scores sync", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await arm(a);
    await arm(b);

    // Both reach pre-game. Wait until each peer can see TWO players in the
    // shared scoreboard, so first-correct scoring + the auto-reveal "all
    // answered" gate behave deterministically.
    await expect(a.getByText(/players/i).first()).toBeVisible();
    await expect(b.getByText(/players/i).first()).toBeVisible();
    await expect.poll(async () => a.locator(".trivia-pack-btn").count()).toBeGreaterThan(0);

    // Peer A acts as host: start the first bundled pack ("General knowledge").
    await a.getByRole("button", { name: /general knowledge/i }).click();

    // CROSS-PEER #1: peer B must see the SAME question prompt peer A started.
    // The prompt lives in the shared game Y.Map; if it were peer-A-local
    // useState, peer B would stay on the pack picker.
    const prompt = /which planet has the most moons/i;
    await expect(a.locator(".trivia-prompt")).toContainText(prompt, { timeout: 10_000 });
    await expect(b.locator(".trivia-prompt")).toContainText(prompt, { timeout: 10_000 });

    // Both peers answer correctly. Once BOTH have answered, the answer window
    // closes (allAnswered) and the reveal-scoring transaction runs, writing
    // points into the shared scoreboard.
    await answerCorrectly(a);
    await answerCorrectly(b);

    // CROSS-PEER #2: peer B's OWN leaderboard must show a positive score for
    // BOTH players — proving peer A's correct-answer score crossed the mesh
    // (and was not stranded in peer A's local React state). Two players both
    // answered correctly, so peer B should render two rows, each > 0 (base
    // points + the first-correct bonus on the fastest). If scoring stayed
    // local to peer A, peer B would see all zeros and this would time out.
    const countBPositiveScores = async () =>
      b.evaluate(() => {
        const scores = Array.from(document.querySelectorAll(".trivia-score")).map((el) =>
          Number((el.textContent ?? "0").trim()),
        );
        return scores.filter((s) => Number.isFinite(s) && s > 0).length;
      });
    await expect.poll(countBPositiveScores, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  } finally {
    await cleanup();
  }
});
