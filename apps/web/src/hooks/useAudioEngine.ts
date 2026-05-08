"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioEngine, type ScreenShareStreams } from "@/lib/audio/engine";
import { AudioEngineV2 } from "@/lib/audio/engine-v2";

export type EngineVersion = "v1" | "v2";

export interface UseAudioEngineReturn {
  startScreenShare: () => Promise<ScreenShareStreams>;
  stopScreenShare: () => void;
  isSharing: boolean;

  startMic: () => Promise<MediaStream>;
  stopMic: () => void;
  isMicActive: boolean;

  micGain: number;
  setMicGain: (vol: number) => void;
  reverbMix: number;
  setReverbMix: (amount: number) => void;
  echoMix: number;
  setEchoMix: (amount: number) => void;
  monitorVolume: number;
  setMonitorVolume: (vol: number) => void;

  error: string | null;
  clearError: () => void;
}

export function useAudioEngine(engineVersion: EngineVersion): UseAudioEngineReturn {
  const engineRef = useRef<AudioEngine | AudioEngineV2 | null>(null);

  const [isSharing, setIsSharing] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [micGain, setMicGainState] = useState(1);
  const [reverbMix, setReverbMixState] = useState(0);
  const [echoMix, setEchoMixState] = useState(0);
  const [monitorVolume, setMonitorVolumeState] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const getEngine = useCallback((): AudioEngine | AudioEngineV2 => {
    if (!engineRef.current) {
      engineRef.current = engineVersion === "v2" ? new AudioEngineV2() : new AudioEngine();
    }
    return engineRef.current;
  }, [engineVersion]);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const prevVersionRef = useRef(engineVersion);
  useEffect(() => {
    if (prevVersionRef.current === engineVersion) return;
    prevVersionRef.current = engineVersion;
    engineRef.current?.dispose();
    engineRef.current = null;
    setIsSharing(false);
    setIsMicActive(false);
    setMicGainState(1);
    setReverbMixState(0);
    setEchoMixState(0);
    setMonitorVolumeState(0);
  }, [engineVersion]);

  const startScreenShare = useCallback(async (): Promise<ScreenShareStreams> => {
    setError(null);
    try {
      const streams = await getEngine().startScreenShare();
      setIsSharing(true);
      return streams;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to share screen";
      setError(message);
      throw err;
    }
  }, [getEngine]);

  const stopScreenShare = useCallback(() => {
    engineRef.current?.stopScreenShare();
    setIsSharing(false);
  }, []);

  const startMic = useCallback(async (): Promise<MediaStream> => {
    setError(null);
    try {
      const stream = await getEngine().startMic();
      setIsMicActive(true);
      return stream;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to access microphone";
      setError(message);
      throw err;
    }
  }, [getEngine]);

  const stopMic = useCallback(() => {
    engineRef.current?.stopMic();
    setIsMicActive(false);
    setMicGainState(1);
    setReverbMixState(0);
    setEchoMixState(0);
    setMonitorVolumeState(0);
  }, []);

  const setMicGain = useCallback((vol: number) => {
    getEngine().setMicGain(vol);
    setMicGainState(vol);
  }, [getEngine]);

  const setReverbMix = useCallback((amount: number) => {
    getEngine().setReverbMix(amount);
    setReverbMixState(amount);
  }, [getEngine]);

  const setEchoMix = useCallback((amount: number) => {
    getEngine().setEchoMix(amount);
    setEchoMixState(amount);
  }, [getEngine]);

  const setMonitorVolume = useCallback((vol: number) => {
    getEngine().setMonitorVolume(vol);
    setMonitorVolumeState(vol);
  }, [getEngine]);

  const clearError = useCallback(() => setError(null), []);

  return {
    startScreenShare, stopScreenShare, isSharing,
    startMic, stopMic, isMicActive,
    micGain, setMicGain,
    reverbMix, setReverbMix,
    echoMix, setEchoMix,
    monitorVolume, setMonitorVolume,
    error, clearError,
  };
}
