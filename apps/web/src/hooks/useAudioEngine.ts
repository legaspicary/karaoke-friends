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

  reverbEnabled: boolean;
  setReverbEnabled: (on: boolean) => void;
  echoEnabled: boolean;
  setEchoEnabled: (on: boolean) => void;
  monitorVolume: number;
  setMonitorVolume: (vol: number) => void;

  error: string | null;
  clearError: () => void;
}

export function useAudioEngine(): UseAudioEngineReturn {
  const engineRef = useRef<AudioEngine | null>(null);

  const [isSharing, setIsSharing] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [reverbEnabled, setReverbEnabledState] = useState(false);
  const [echoEnabled, setEchoEnabledState] = useState(false);
  const [monitorVolume, setMonitorVolumeState] = useState(0);
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
    setReverbEnabledState(false);
    setEchoEnabledState(false);
    setMonitorVolumeState(0);
  }, []);

  const setReverbEnabled = useCallback((on: boolean) => {
    getEngine().setReverbEnabled(on);
    setReverbEnabledState(on);
  }, [getEngine]);

  const setEchoEnabled = useCallback((on: boolean) => {
    getEngine().setEchoEnabled(on);
    setEchoEnabledState(on);
  }, [getEngine]);

  const setMonitorVolume = useCallback((vol: number) => {
    getEngine().setMonitorVolume(vol);
    setMonitorVolumeState(vol);
  }, [getEngine]);

  const clearError = useCallback(() => setError(null), []);

  return {
    startScreenShare, stopScreenShare, isSharing,
    startMic, stopMic, isMicActive,
    reverbEnabled, setReverbEnabled,
    echoEnabled, setEchoEnabled,
    monitorVolume, setMonitorVolume,
    error, clearError,
  };
}
