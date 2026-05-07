"use client";

import { useRoom } from "./RoomProvider";

export function EffectsPanel() {
  const { reverbEnabled, setReverbEnabled, echoEnabled, setEchoEnabled, isMicActive } = useRoom();

  if (!isMicActive) return null;

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
      <h2 className="text-white/90 font-semibold text-sm tracking-wide uppercase">
        Vocal Effects
      </h2>

      <div className="flex flex-wrap gap-2">
        <EffectPill
          label="Reverb"
          icon="🌊"
          active={reverbEnabled}
          onToggle={() => setReverbEnabled(!reverbEnabled)}
          ariaLabel="Toggle reverb"
        />
        <EffectPill
          label="Echo"
          icon="📣"
          active={echoEnabled}
          onToggle={() => setEchoEnabled(!echoEnabled)}
          ariaLabel="Toggle echo"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pill button
// ---------------------------------------------------------------------------

interface EffectPillProps {
  label: string;
  icon: string;
  active: boolean;
  onToggle: () => void;
  ariaLabel: string;
}

function EffectPill({ label, icon, active, onToggle, ariaLabel }: EffectPillProps) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all focus-visible:ring-2 focus-visible:ring-purple-400 outline-none ${
        active
          ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-900/40 scale-[1.03]"
          : "bg-white/8 text-white/60 hover:bg-white/12 hover:text-white/80 border border-white/10"
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
