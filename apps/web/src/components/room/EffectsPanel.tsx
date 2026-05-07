"use client";

import { useRoom } from "./RoomProvider";

export function EffectsPanel() {
  const { micGain, setMicGain, reverbMix, setReverbMix, echoMix, setEchoMix, vocalBoost, setVocalBoost, isMicActive } = useRoom();

  if (!isMicActive) return null;

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
      <h2 className="text-white/90 font-semibold text-sm tracking-wide uppercase">
        Vocal Effects
      </h2>

      <EffectSlider
        label="Mic Gain"
        icon="🎤"
        value={micGain}
        onChange={setMicGain}
        max={2}
        defaultValue={1}
      />

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

      <div className="border-t border-white/10 pt-3 mt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`block w-7 h-7 rounded-full text-center text-sm leading-7 transition-shadow ${
                vocalBoost
                  ? "shadow-[0_0_6px_1px_rgba(168,85,247,0.5)] bg-purple-500/20"
                  : "bg-white/5"
              }`}
              aria-hidden="true"
            >
              ✨
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-white/80 text-sm font-medium">Vocal Boost</span>
              <span className="text-white/30 text-[10px] font-medium uppercase tracking-wider">Beta</span>
            </div>
          </div>
          <button
            role="switch"
            aria-checked={vocalBoost}
            aria-label="Toggle Vocal Boost"
            onClick={() => setVocalBoost(!vocalBoost)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-purple-400 outline-none ${
              vocalBoost ? "bg-purple-600" : "bg-white/20"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                vocalBoost ? "translate-x-[18px]" : "translate-x-[3px]"
              }`}
            />
          </button>
        </div>
        <p className="text-white/30 text-xs mt-1.5 ml-9 leading-relaxed">
          Recovers vocals that get suppressed when playing on speakers
        </p>
      </div>
    </div>
  );
}

interface EffectSliderProps {
  label: string;
  icon: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
  defaultValue?: number;
}

function EffectSlider({ label, icon, value, onChange, max = 1, defaultValue = 0.5 }: EffectSliderProps) {
  const pct = Math.round((value / max) * 100);
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
          onChange={(e) => onChange((Number(e.target.value) / 100) * max)}
          aria-label={`${label} level`}
          className="flex-1 h-1 appearance-none bg-transparent cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/20
            [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-purple-400 [&::-moz-range-thumb]:border-0
            [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-white/20
            focus-visible:outline-none focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-purple-400"
        />
        <button
          onClick={() => onChange(value > 0 ? 0 : defaultValue)}
          aria-label={value > 0 ? `Mute ${label}` : `Reset ${label}`}
          className="text-white/50 hover:text-white/80 transition-colors flex-none text-xs"
        >
          {active ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
}
