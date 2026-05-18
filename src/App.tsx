import { useEffect, useMemo, useState } from "react";
import { Trivia } from "./features/trivia/Trivia";
import { SettingsDrawer } from "./features/settings/SettingsDrawer";
import { appConfig } from "./shared/config";
import { InviteShareButton } from "@baditaflorin/mesh-common";

const STORAGE = {
  room: `${appConfig.storagePrefix}:room`,
  name: `${appConfig.storagePrefix}:name`,
  peerId: `${appConfig.storagePrefix}:peerId`,
  customPack: `${appConfig.storagePrefix}:customPack`,
};

function readString(key: string, fallback: string): string {
  return localStorage.getItem(key) ?? fallback;
}

function suggestName(): string {
  const adjectives = ["fast", "quiet", "bright", "lucky", "calm", "bold", "wry"];
  const nouns = ["otter", "moth", "ibis", "panda", "fox", "lynx", "owl"];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)] ?? "anon";
  const n = nouns[Math.floor(Math.random() * nouns.length)] ?? "player";
  return `${a}-${n}`;
}

export function App() {
  const [roomId, setRoomId] = useState(() => readString(STORAGE.room, "default"));
  const [myName, setMyName] = useState(() => readString(STORAGE.name, suggestName()));
  const [customPackJson, setCustomPackJson] = useState(() => readString(STORAGE.customPack, ""));
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Stable peer identity across reloads
  const myPeerId = useMemo(() => {
    const existing = localStorage.getItem(STORAGE.peerId);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(STORAGE.peerId, fresh);
    return fresh;
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE.room, roomId);
  }, [roomId]);
  useEffect(() => {
    localStorage.setItem(STORAGE.name, myName);
  }, [myName]);
  useEffect(() => {
    localStorage.setItem(STORAGE.customPack, customPackJson);
  }, [customPackJson]);

  return (
    <div className="app-root">
      <Trivia roomId={roomId} myName={myName} myPeerId={myPeerId} customPackJson={customPackJson} />

      <InviteShareButton appName={appConfig.appName} roomId={roomId} />
      <button
        type="button"
        className="settings-fab"
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
      >
        ⚙
      </button>

      <div className="self-ref">
        <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer">
          source
        </a>
        <span aria-hidden="true">·</span>
        <a href={appConfig.paypalUrl} target="_blank" rel="noreferrer">
          tip ♥
        </a>
        <span aria-hidden="true">·</span>
        <span>
          v{appConfig.version} · {appConfig.commit}
        </span>
      </div>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        roomId={roomId}
        onRoomChange={setRoomId}
        myName={myName}
        onNameChange={setMyName}
        customPackJson={customPackJson}
        onCustomPackChange={setCustomPackJson}
      />
    </div>
  );
}
