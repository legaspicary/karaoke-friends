"use client";

import { useRoom } from "./RoomProvider";
import type { ReverbPresetName } from "@/lib/audio/presets/reverb-presets";

export function EffectsPanel() {
  const { micGain, setMicGain, reverbMix, setReverbMix, echoMix, setEchoMix, isMicActive, engineVersion, setEngineVersion, vocalPreset, setVocalPreset, reverbPreset, setReverbPreset } = useRoom();

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-white/90 font-semibold text-sm tracking-wide uppercase">
          Vocal Effects
        </h2>
        <select
          value={engineVersion}
          onChange={(e) => setEngineVersion(e.target.value as "v1" | "v2" | "v3")}
          className="bg-white/10 text-white/80 text-xs rounded-md px-2 py-1 border border-white/10 focus:outline-none focus:ring-1 focus:ring-purple-400"
        >
          <option value="v1">V1 — Simple</option>
          <option value="v2">V2 — Enhanced</option>
          <option value="v3">V3 — Studio</option>
        </select>
      </div>

      {isMicActive ? (
        <>
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

          {engineVersion === "v3" && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-white/60 text-xs font-medium ml-9">Vocal Preset</span>
                <div className="flex gap-2 ml-9">
                  {(["warm", "bright", "neutral"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setVocalPreset(p)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors border ${
                        vocalPreset === p
                          ? "bg-purple-500/30 text-white border-purple-400/50"
                          : "bg-white/10 text-white/70 hover:bg-purple-500/20 border-white/10"
                      }`}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-white/60 text-xs font-medium ml-9">Reverb Type</span>
                <select
                  value={reverbPreset}
                  onChange={(e) => setReverbPreset(e.target.value as ReverbPresetName)}
                  className="ml-9 bg-white/10 text-white/80 text-xs rounded-md px-2 py-1.5 border border-white/10 focus:outline-none focus:ring-1 focus:ring-purple-400"
                >
                  <option value="small-room">Small Room</option>
                  <option value="medium-hall">Medium Hall</option>
                  <option value="large-hall">Large Hall</option>
                  <option value="plate">Plate</option>
                  <option value="spring">Spring</option>
                </select>
              </div>
            </>
          )}
        </>
      ) : (
        <p className="text-white/40 text-xs">Enable mic to adjust effects</p>
      )}
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
