"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioEngine, type ScreenShareStreams } from "@/lib/audio/engine";

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

  vocalBoost: boolean;
  setVocalBoost: (enabled: boolean) => void;

  error: string | null;
  clearError: () => void;
}

export function useAudioEngine(): UseAudioEngineReturn {
  const engineRef = useRef<AudioEngine | null>(null);

  const [isSharing, setIsSharing] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [micGain, setMicGainState] = useState(1);
  const [reverbMix, setReverbMixState] = useState(0);
  const [echoMix, setEchoMixState] = useState(0);
  const [monitorVolume, setMonitorVolumeState] = useState(0);
  const [vocalBoost, setVocalBoostState] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getEngine = useCallback((): AudioEngine => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine();
    }
    return engineRef.current;
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

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
    setVocalBoostState(false);
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

  const setVocalBoost = useCallback((enabled: boolean) => {
    getEngine().setVocalBoost(enabled);
    setVocalBoostState(enabled);
  }, [getEngine]);

  const clearError = useCallback(() => setError(null), []);

  return {
    startScreenShare, stopScreenShare, isSharing,
    startMic, stopMic, isMicActive,
    micGain, setMicGain,
    reverbMix, setReverbMix,
    echoMix, setEchoMix,
    monitorVolume, setMonitorVolume,
    vocalBoost, setVocalBoost,
    error, clearError,
  };
}
