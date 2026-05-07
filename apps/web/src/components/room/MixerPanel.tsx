"use client";

import { useMemo } from "react";
import { useRoom } from "./RoomProvider";
import { useAudioLevels } from "@/hooks/useAudioLevels";

export function MixerPanel() {
  const {
    roomState,
    myPeerId,
    remoteStreams,
    localMicStream,
    isMicActive,
    screenVolume,
    setScreenVolume,
    peerVolumes,
    setPeerVolume,
    monitorVolume,
    setMonitorVolume,
  } = useRoom();

  const djId = roomState.djId;

  // Build a map of all audio streams for level detection
  const allStreams = useMemo(() => {
    const map = new Map<string, MediaStream | null>();
    for (const [id, stream] of remoteStreams) {
      map.set(id, stream);
    }
    if (myPeerId && localMicStream) {
      map.set(myPeerId, localMicStream);
    }
    return map;
  }, [remoteStreams, myPeerId, localMicStream]);

  const levels = useAudioLevels(allStreams);

  const hasDJ = djId !== null;

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
      <h2 className="text-white/90 font-semibold text-sm tracking-wide uppercase">
        Mixer
      </h2>

      {/* Screen share volume */}
      {hasDJ && (
        <MixerRow
          label="Screen Share"
          icon="📺"
          badge="LIVE"
          badgeColor="bg-red-500"
          volume={screenVolume}
          onVolume={setScreenVolume}
          level={0}
          isSpeaking={false}
        />
      )}

      {/* Participants */}
      {roomState.participants.map((p) => {
        const isMe = p.id === myPeerId;
        const isSharing = p.id === djId;
        const level = levels.get(p.id) ?? 0;
        const speaking = level > 0.02;

        if (isMe) {
          return (
            <MixerRow
              key={p.id}
              label={`${p.name} (You)`}
              icon={isMicActive ? "🎤" : "🔇"}
              badge={isSharing ? "SHARING" : undefined}
              badgeColor="bg-red-500"
              volume={monitorVolume}
              onVolume={setMonitorVolume}
              level={level}
              isSpeaking={speaking && isMicActive}
              subtitle={isMicActive ? "Monitor vol" : "Mic off"}
              disabled={!isMicActive}
            />
          );
        }

        return (
          <MixerRow
            key={p.id}
            label={p.name}
            icon="🎤"
            badge={isSharing ? "SHARING" : undefined}
            badgeColor="bg-red-500"
            volume={peerVolumes.get(p.id) ?? 1}
            onVolume={(v) => setPeerVolume(p.id, v)}
            level={level}
            isSpeaking={speaking}
          />
        );
      })}

      {/* Headphone warning */}
      {monitorVolume > 0 && (
        <p className="text-amber-300/80 text-xs leading-relaxed bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          Monitor is on — use headphones to avoid feedback.
        </p>
      )}
    </div>
  );
}

interface MixerRowProps {
  label: string;
  icon: string;
  badge?: string;
  badgeColor?: string;
  volume: number;
  onVolume: (v: number) => void;
  level: number;
  isSpeaking: boolean;
  subtitle?: string;
  disabled?: boolean;
}

function MixerRow({
  label,
  icon,
  badge,
  badgeColor = "bg-red-500",
  volume,
  onVolume,
  level,
  isSpeaking,
  subtitle,
  disabled,
}: MixerRowProps) {
  const pct = Math.round(volume * 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {/* Speaking glow ring */}
        <div className="relative flex-none">
          <span
            className={`block w-7 h-7 rounded-full text-center text-sm leading-7 transition-shadow ${
              isSpeaking
                ? "shadow-[0_0_8px_2px_rgba(34,197,94,0.6)] bg-green-500/20"
                : "bg-white/5"
            }`}
            aria-hidden="true"
          >
            {icon}
          </span>
          {isSpeaking && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full motion-safe:animate-pulse" />
          )}
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-white/80 text-sm font-medium truncate">{label}</span>
          {badge && (
            <span className={`${badgeColor} text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none flex-none`}>
              {badge}
            </span>
          )}
        </div>

        <span className="text-white/40 text-xs tabular-nums w-8 text-right flex-none">
          {pct}%
        </span>
      </div>

      {subtitle && !disabled && (
        <p className="text-white/40 text-[11px] ml-9">{subtitle}</p>
      )}

      {/* Volume slider */}
      <div className="flex items-center gap-2 ml-9">
        <div className="relative flex-1 h-5 flex items-center">
          {/* Level meter behind slider */}
          <div className="absolute inset-y-0 left-0 right-0 flex items-center pointer-events-none">
            <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-green-500/50 transition-[width] duration-75"
                style={{ width: `${Math.min(level * 5, 1) * 100}%` }}
              />
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={pct}
            disabled={disabled}
            onChange={(e) => onVolume(Number(e.target.value) / 100)}
            aria-label={`${label} volume`}
            className="relative w-full h-1 appearance-none bg-transparent cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10
              [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/20
              [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:relative [&::-moz-range-thumb]:z-10
              [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-white/20
              focus-visible:outline-none focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-purple-400"
          />
        </div>
        <button
          onClick={() => onVolume(volume > 0 ? 0 : 1)}
          disabled={disabled}
          aria-label={volume > 0 ? `Mute ${label}` : `Unmute ${label}`}
          className="text-white/50 hover:text-white/80 disabled:opacity-30 transition-colors flex-none text-xs"
        >
          {volume > 0 ? "🔊" : "🔇"}
        </button>
      </div>
    </div>
  );
}
