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
import { useYouTubeSearch } from "@/hooks/useYouTubeSearch";
import { AudioEngineV3 } from "@/lib/audio/engine-v3";
import type { VocalPresetName } from "@/lib/audio/presets/vocal-presets";
import type { ReverbPresetName } from "@/lib/audio/presets/reverb-presets";
import type { YouTubeSearchResult } from "@karaoke-friends/shared";

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
  addSong: (song: { title: string; url?: string; thumbnail?: string }) => void;
  removeSong: (id: string) => void;
  reorderQueue: (ids: string[]) => void;
  setCurrentSong: (id: string | null) => void;
  voteSong: (id: string) => void;

  // Playback
  playSong: (id: string) => void;
  nextSong: () => void;

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
  vocalPreset: VocalPresetName;
  setVocalPreset: (preset: VocalPresetName) => void;
  reverbPreset: ReverbPresetName;
  setReverbPreset: (preset: ReverbPresetName) => void;

  // Volume mixer
  monitorVolume: number;
  setMonitorVolume: (vol: number) => void;
  screenVolume: number;
  setScreenVolume: (vol: number) => void;
  peerVolumes: Map<string, number>;
  setPeerVolume: (peerId: string, vol: number) => void;

  // YouTube search
  youtubeSearch: (query: string) => void;
  youtubeResults: YouTubeSearchResult[];
  isSearching: boolean;
  clearSearchResults: () => void;

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
  const { roomState, addSong, removeSong, reorderQueue, setCurrentSong, voteSong } =
    useRoomState(signaling.client);
  const { mesh, remoteStreams, connectionStates } = usePeerMesh(signaling.client);
  const peerHealth = usePeerHealth(mesh);
  const { results: youtubeResults, isSearching, search: youtubeSearch, clearResults: clearSearchResults } = useYouTubeSearch(signaling.client);
  const [engineVersion, setEngineVersion] = useState<EngineVersion>("v1");
  const audioEngine = useAudioEngine(engineVersion);

  const [vocalPreset, setVocalPresetState] = useState<VocalPresetName>("neutral");
  const [reverbPreset, setReverbPresetState] = useState<ReverbPresetName>("medium-hall");

  const setVocalPreset = useCallback((preset: VocalPresetName) => {
    const engine = audioEngine.engineRef.current;
    if (engine instanceof AudioEngineV3) {
      engine.loadVocalPreset(preset);
    }
    setVocalPresetState(preset);
  }, [audioEngine.engineRef]);

  const setReverbPreset = useCallback((preset: ReverbPresetName) => {
    const engine = audioEngine.engineRef.current;
    if (engine instanceof AudioEngineV3) {
      engine.setReverbPreset(preset);
    }
    setReverbPresetState(preset);
  }, [audioEngine.engineRef]);

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

  const queueRef = useRef(roomState.queue);
  queueRef.current = roomState.queue;
  const currentSongIdRef = useRef(roomState.currentSongId);
  currentSongIdRef.current = roomState.currentSongId;

  const playbackWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    return () => {
      playbackWindowRef.current?.close();
      playbackWindowRef.current = null;
    };
  }, []);

  const openInYouTube = useCallback((url: string) => {
    const win = playbackWindowRef.current;
    if (win && !win.closed) {
      win.location.href = url;
      win.focus();
    } else {
      playbackWindowRef.current = window.open(url, "karaoke-playback");
    }
  }, []);

  const isDJRef = useRef(isDJ);
  isDJRef.current = isDJ;

  const playSong = useCallback((id: string) => {
    setCurrentSong(id);
    if (!isDJRef.current) return;
    const song = queueRef.current.find((s) => s.id === id);
    if (song?.url) openInYouTube(song.url);
  }, [setCurrentSong, openInYouTube]);

  const nextSong = useCallback(() => {
    const queue = queueRef.current;
    const curId = currentSongIdRef.current;
    if (queue.length === 0) return;
    const idx = queue.findIndex((s) => s.id === curId);
    if (idx === -1) {
      playSong(queue[0].id);
    } else if (idx < queue.length - 1) {
      playSong(queue[idx + 1].id);
    } else {
      setCurrentSong(null);
    }
  }, [playSong, setCurrentSong]);


  const value: RoomContextValue = {
    roomState, myPeerId, isDJ,
    startSharing, stopSharing, isSharing: audioEngine.isSharing,
    localScreenStream,
    toggleMic, isMicActive: audioEngine.isMicActive,
    localMicStream,
    addSong, removeSong, reorderQueue, setCurrentSong, voteSong,
    playSong, nextSong,
    micGain: audioEngine.micGain,
    setMicGain: audioEngine.setMicGain,
    reverbMix: audioEngine.reverbMix,
    setReverbMix: audioEngine.setReverbMix,
    echoMix: audioEngine.echoMix,
    setEchoMix: audioEngine.setEchoMix,
    engineVersion, setEngineVersion,
    audioError: audioEngine.error,
    clearAudioError: audioEngine.clearError,
    vocalPreset, setVocalPreset,
    reverbPreset, setReverbPreset,
    monitorVolume: audioEngine.monitorVolume,
    setMonitorVolume: audioEngine.setMonitorVolume,
    screenVolume, setScreenVolume,
    peerVolumes, setPeerVolume,
    youtubeSearch, youtubeResults, isSearching, clearSearchResults,
    remoteStreams, connectionStates,
    connectionStatus: signaling.connectionStatus,
    peerHealth,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}
