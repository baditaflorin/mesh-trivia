import { useEffect, useMemo, useState } from "react";
import {
  loadSignalingUrl,
  loadTurnTokenUrl,
  resetIceServers,
  saveSignalingUrl,
  saveTurnTokenUrl,
} from "../sync/iceConfig";
import { appConfig } from "../../shared/config";
import { validatePack } from "../trivia/packs";

type Props = {
  open: boolean;
  onClose: () => void;
  roomId: string;
  onRoomChange: (next: string) => void;
  myName: string;
  onNameChange: (next: string) => void;
  customPackJson: string;
  onCustomPackChange: (next: string) => void;
};

export function SettingsDrawer({
  open,
  onClose,
  roomId,
  onRoomChange,
  myName,
  onNameChange,
  customPackJson,
  onCustomPackChange,
}: Props) {
  const [signaling, setSignaling] = useState(loadSignalingUrl());
  const [tokenUrl, setTokenUrl] = useState(loadTurnTokenUrl());
  const [draftPack, setDraftPack] = useState(customPackJson);

  useEffect(() => {
    if (open) {
      setSignaling(loadSignalingUrl());
      setTokenUrl(loadTurnTokenUrl());
      setDraftPack(customPackJson);
    }
  }, [open, customPackJson]);

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

  if (!open) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-drawer" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <label>
          <span>Room ID</span>
          <input value={roomId} onChange={(e) => onRoomChange(e.target.value)} />
        </label>

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

        <div className="settings-actions">
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

        <hr />

        <h3>Self-hosted infra (advanced)</h3>
        <p className="settings-help">
          Override the default signaling and TURN endpoints. Leave blank to use the built-in
          defaults (<code>{appConfig.signalingUrl}</code> and <code>{appConfig.turnTokenUrl}</code>
          ).
        </p>

        <label>
          <span>Signaling URL</span>
          <input
            value={signaling}
            onChange={(e) => setSignaling(e.target.value)}
            placeholder={appConfig.signalingUrl}
          />
        </label>

        <label>
          <span>TURN credentials URL</span>
          <input
            value={tokenUrl}
            onChange={(e) => setTokenUrl(e.target.value)}
            placeholder={appConfig.turnTokenUrl}
          />
        </label>

        <div className="settings-actions">
          <button
            type="button"
            onClick={() => {
              saveSignalingUrl(signaling);
              saveTurnTokenUrl(tokenUrl);
              onClose();
              location.reload();
            }}
          >
            Save and reload
          </button>
          <button
            type="button"
            onClick={() => {
              saveSignalingUrl("");
              saveTurnTokenUrl("");
              resetIceServers();
              onClose();
              location.reload();
            }}
          >
            Reset to defaults
          </button>
        </div>

        <hr />

        <footer className="settings-footer">
          <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer">
            source on github
          </a>
          <span>
            v{appConfig.version} · {appConfig.commit}
          </span>
        </footer>
      </div>
    </div>
  );
}
