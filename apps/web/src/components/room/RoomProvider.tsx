"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSignaling, type ConnectionStatus } from "@/hooks/useSignaling";
import { useRoomState, type RoomState } from "@/hooks/useRoomState";
import { usePeerMesh } from "@/hooks/usePeerMesh";
import { useAudioEngine, type EngineVersion } from "@/hooks/useAudioEngine";
import { usePeerHealth, type PeerHealthInfo } from "@/hooks/usePeerHealth";

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
  localMicStream: MediaStream | null;

  // Room actions
  addSong: (song: { title: string; url?: string }) => void;
  removeSong: (id: string) => void;
  reorderQueue: (ids: string[]) => void;
  setCurrentSong: (id: string | null) => void;

  // Effects (work on your mic)
  micGain: number;
  setMicGain: (vol: number) => void;
  reverbMix: number;
  setReverbMix: (amount: number) => void;
  echoMix: number;
  setEchoMix: (amount: number) => void;
  engineVersion: EngineVersion;
  setEngineVersion: (v: EngineVersion) => void;
  audioError: string | null;
  clearAudioError: () => void;

  // Volume mixer
  monitorVolume: number;
  setMonitorVolume: (vol: number) => void;
  screenVolume: number;
  setScreenVolume: (vol: number) => void;
  peerVolumes: Map<string, number>;
  setPeerVolume: (peerId: string, vol: number) => void;

  // WebRTC
  remoteStreams: Map<string, MediaStream>;
  connectionStates: Map<string, RTCPeerConnectionState>;
  connectionStatus: ConnectionStatus;
  peerHealth: Map<string, PeerHealthInfo>;
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
  const peerHealth = usePeerHealth(mesh);
  const [engineVersion, setEngineVersion] = useState<EngineVersion>("v1");
  const audioEngine = useAudioEngine(engineVersion);

  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [localMicStream, setLocalMicStream] = useState<MediaStream | null>(null);
  const [screenVolume, setScreenVolume] = useState(1);
  const [peerVolumes, setPeerVolumesMap] = useState<Map<string, number>>(() => new Map());

  const setPeerVolume = useCallback((peerId: string, vol: number) => {
    setPeerVolumesMap((prev) => {
      const next = new Map(prev);
      next.set(peerId, vol);
      return next;
    });
  }, []);

  // Send the join message AFTER useRoomState and usePeerMesh have subscribed.
  // React runs effects in declaration order, so this runs last.
  const hasJoined = useRef(false);
  useEffect(() => {
    if (signaling.connectionStatus === "connected" && !hasJoined.current) {
      signaling.join();
      hasJoined.current = true;
    }
  }, [signaling.connectionStatus, signaling.join]);

  useEffect(() => {
    if (!audioEngine.isMicActive && localMicStream) {
      mesh?.setLocalStream("mic", null);
      setLocalMicStream(null);
    }
    if (!audioEngine.isSharing && localScreenStream) {
      mesh?.setLocalStream("screen", null);
      setLocalScreenStream(null);
    }
  }, [audioEngine.isMicActive, audioEngine.isSharing, localMicStream, localScreenStream, mesh]);

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
      setLocalMicStream(null);
    } else {
      try {
        const micStream = await audioEngine.startMic();
        mesh?.setLocalStream("mic", micStream);
        setLocalMicStream(micStream);
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
    localMicStream,
    addSong, removeSong, reorderQueue, setCurrentSong,
    micGain: audioEngine.micGain,
    setMicGain: audioEngine.setMicGain,
    reverbMix: audioEngine.reverbMix,
    setReverbMix: audioEngine.setReverbMix,
    echoMix: audioEngine.echoMix,
    setEchoMix: audioEngine.setEchoMix,
    engineVersion, setEngineVersion,
    audioError: audioEngine.error,
    clearAudioError: audioEngine.clearError,
    monitorVolume: audioEngine.monitorVolume,
    setMonitorVolume: audioEngine.setMonitorVolume,
    screenVolume, setScreenVolume,
    peerVolumes, setPeerVolume,
    remoteStreams, connectionStates,
    connectionStatus: signaling.connectionStatus,
    peerHealth,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}
