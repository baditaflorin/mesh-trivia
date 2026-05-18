import { useEffect, useMemo, useState } from "react";
import { MeshShell } from "@baditaflorin/mesh-common";
import { Trivia } from "./features/trivia/Trivia";
import { SettingsExtras } from "./features/settings/SettingsExtras";
import { appConfig } from "./shared/config";

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
    <MeshShell
      config={appConfig}
      roomId={roomId}
      onRoomChange={setRoomId}
      settingsExtras={
        <SettingsExtras
          myName={myName}
          onNameChange={setMyName}
          customPackJson={customPackJson}
          onCustomPackChange={setCustomPackJson}
        />
      }
    >
      <Trivia roomId={roomId} myName={myName} myPeerId={myPeerId} customPackJson={customPackJson} />
    </MeshShell>
  );
}
