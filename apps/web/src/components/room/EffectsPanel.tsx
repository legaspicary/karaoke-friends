"use client";

import { useRoom } from "./RoomProvider";

export function EffectsPanel() {
  const { reverbMix, setReverbMix, echoMix, setEchoMix, isMicActive } = useRoom();

  if (!isMicActive) return null;

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
      <h2 className="text-white/90 font-semibold text-sm tracking-wide uppercase">
        Vocal Effects
      </h2>

      <EffectSlider
        label="Reverb"
        icon="🌊"
        value={reverbMix}
        onChange={setReverbMix}
      />
      <EffectSlider
        label="Echo"
        icon="📣"
        value={echoMix}
        onChange={setEchoMix}
      />
    </div>
  );
}

interface EffectSliderProps {
  label: string;
  icon: string;
  value: number;
  onChange: (v: number) => void;
}

function EffectSlider({ label, icon, value, onChange }: EffectSliderProps) {
  const pct = Math.round(value * 100);
  const active = value > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span
          className={`block w-7 h-7 rounded-full text-center text-sm leading-7 transition-shadow ${
            active
              ? "shadow-[0_0_6px_1px_rgba(168,85,247,0.5)] bg-purple-500/20"
              : "bg-white/5"
          }`}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="text-white/80 text-sm font-medium flex-1">{label}</span>
        <span className="text-white/40 text-xs tabular-nums w-10 text-right">
          {pct}%
        </span>
      </div>

      <div className="flex items-center gap-2 ml-9">
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          aria-label={`${label} mix`}
          className="flex-1 h-1 appearance-none bg-transparent cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/20
            [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-purple-400 [&::-moz-range-thumb]:border-0
            [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-white/20
            focus-visible:outline-none focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-purple-400"
        />
        <button
          onClick={() => onChange(value > 0 ? 0 : 0.5)}
          aria-label={value > 0 ? `Disable ${label}` : `Enable ${label}`}
          className="text-white/50 hover:text-white/80 transition-colors flex-none text-xs"
        >
          {active ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
}
