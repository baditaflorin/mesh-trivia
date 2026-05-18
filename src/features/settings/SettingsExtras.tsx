import { useMemo, useState } from "react";
import { validatePack } from "../trivia/packs";

type Props = {
  myName: string;
  onNameChange: (next: string) => void;
  customPackJson: string;
  onCustomPackChange: (next: string) => void;
};

export function SettingsExtras({
  myName,
  onNameChange,
  customPackJson,
  onCustomPackChange,
}: Props) {
  const [draftPack, setDraftPack] = useState(customPackJson);

  const packValidation = useMemo<
    { ok: true; name: string; count: number } | { ok: false; error: string } | null
  >(() => {
    if (!draftPack.trim()) return null;
    try {
      const parsed = JSON.parse(draftPack);
      const r = validatePack(parsed);
      if ("error" in r) return { ok: false, error: r.error };
      return { ok: true, name: r.name, count: r.questions.length };
    } catch (err) {
      return { ok: false, error: `JSON parse error: ${(err as Error).message}` };
    }
  }, [draftPack]);

  return (
    <>
      <label>
        <span>Your display name</span>
        <input
          value={myName}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={32}
          placeholder="bright-otter"
        />
      </label>

      <label>
        <span>Custom pack (JSON, optional)</span>
        <textarea
          className="trivia-pack-textarea"
          value={draftPack}
          onChange={(e) => setDraftPack(e.target.value)}
          placeholder={
            '{\n  "name": "My pack",\n  "questions": [\n    { "prompt": "...", "choices": ["a","b","c","d"], "correct": 0 }\n  ]\n}'
          }
          rows={8}
        />
      </label>

      {packValidation && (
        <div className={"trivia-pack-validation " + (packValidation.ok ? "ok" : "err")}>
          {packValidation.ok
            ? `Looks good — "${packValidation.name}" (${packValidation.count} questions)`
            : packValidation.error}
        </div>
      )}

      <div className="trivia-pack-actions">
        <button
          type="button"
          onClick={() => {
            onCustomPackChange(draftPack);
          }}
        >
          Save pack
        </button>
        <button
          type="button"
          onClick={() => {
            setDraftPack("");
            onCustomPackChange("");
          }}
        >
          Clear pack
        </button>
      </div>
    </>
  );
}
