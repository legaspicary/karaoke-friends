"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import { useSignaling, type ConnectionStatus } from "@/hooks/useSignaling";
import { useRoomState, type RoomState } from "@/hooks/useRoomState";
import { usePeerMesh } from "@/hooks/usePeerMesh";
import { useAudioEngine } from "@/hooks/useAudioEngine";

export interface RoomContextValue {
  roomState: RoomState;
  myPeerId: string | null;
  isDJ: boolean;

  // Screen sharing (DJ)
  startSharing: () => Promise<void>;
  stopSharing: () => void;
  isSharing: boolean;
  localScreenStream: MediaStream | null;

  // Mic (everyone)
  toggleMic: () => Promise<void>;
  isMicActive: boolean;

  // Room actions
  addSong: (song: { title: string; url?: string }) => void;
  removeSong: (id: string) => void;
  reorderQueue: (ids: string[]) => void;
  setCurrentSong: (id: string | null) => void;

  // Effects (work on your mic)
  reverbEnabled: boolean;
  setReverbEnabled: (on: boolean) => void;
  echoEnabled: boolean;
  setEchoEnabled: (on: boolean) => void;
  monitorEnabled: boolean;
  setMonitorEnabled: (on: boolean) => void;
  audioError: string | null;
  clearAudioError: () => void;

  // WebRTC
  remoteStreams: Map<string, MediaStream>;
  connectionStates: Map<string, RTCPeerConnectionState>;
  connectionStatus: ConnectionStatus;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be used inside <RoomProvider>");
  return ctx;
}

interface RoomProviderProps {
  roomCode: string;
  playerName: string;
  children: ReactNode;
}

export function RoomProvider({ roomCode, playerName, children }: RoomProviderProps) {
  const workerUrl = process.env.NEXT_PUBLIC_PARTY_URL ?? "ws://localhost:8787";

  const signaling = useSignaling(roomCode, workerUrl, playerName);
  const { roomState, addSong, removeSong, reorderQueue, setCurrentSong } =
    useRoomState(signaling.client);
  const { mesh, remoteStreams, connectionStates } = usePeerMesh(signaling.client);
  const audioEngine = useAudioEngine();

  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);

  const myPeerId = roomState.myPeerId;
  const isDJ = myPeerId !== null && roomState.djId === myPeerId;

  const startSharing = useCallback(async () => {
    try {
      const { screenStream } = await audioEngine.startScreenShare();
      // Screen share has video + tab audio tracks — send as one stream
      mesh?.setLocalStream("screen", screenStream);
      setLocalScreenStream(screenStream);
      signaling.send({ type: "take-mic" });
    } catch (err) {
      console.error("[RoomProvider] startSharing failed", err);
    }
  }, [audioEngine, mesh, signaling]);

  const stopSharing = useCallback(() => {
    audioEngine.stopScreenShare();
    mesh?.setLocalStream("screen", null);
    setLocalScreenStream(null);
    signaling.send({ type: "drop-mic" });
  }, [audioEngine, mesh, signaling]);

  const toggleMic = useCallback(async () => {
    if (audioEngine.isMicActive) {
      audioEngine.stopMic();
      mesh?.setLocalStream("mic", null);
    } else {
      try {
        const micStream = await audioEngine.startMic();
        mesh?.setLocalStream("mic", micStream);
      } catch (err) {
        console.error("[RoomProvider] toggleMic failed", err);
      }
    }
  }, [audioEngine, mesh]);

  const value: RoomContextValue = {
    roomState, myPeerId, isDJ,
    startSharing, stopSharing, isSharing: audioEngine.isSharing,
    localScreenStream,
    toggleMic, isMicActive: audioEngine.isMicActive,
    addSong, removeSong, reorderQueue, setCurrentSong,
    reverbEnabled: audioEngine.reverbEnabled,
    setReverbEnabled: audioEngine.setReverbEnabled,
    echoEnabled: audioEngine.echoEnabled,
    setEchoEnabled: audioEngine.setEchoEnabled,
    monitorEnabled: audioEngine.monitorEnabled,
    setMonitorEnabled: audioEngine.setMonitorEnabled,
    audioError: audioEngine.error,
    clearAudioError: audioEngine.clearError,
    remoteStreams, connectionStates,
    connectionStatus: signaling.connectionStatus,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}
