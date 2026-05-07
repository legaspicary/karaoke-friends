"use client";

import { useRoom } from "./RoomProvider";

export function EffectsPanel() {
  const {
    reverbEnabled,
    setReverbEnabled,
    echoEnabled,
    setEchoEnabled,
    monitorEnabled,
    setMonitorEnabled,
  } = useRoom();

  const { isMicActive } = useRoom();

  if (!isMicActive) return null;

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
      {/* Header */}
      <h2 className="text-white/90 font-semibold text-sm tracking-wide uppercase">
        Vocal Effects
      </h2>

      {/* Effect toggles */}
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

      {/* Monitor toggle with warning */}
      <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base" aria-hidden="true">🎧</span>
            <span className="text-white/80 text-sm font-medium">
              Monitor (headphones only)
            </span>
          </div>
          <button
            onClick={() => setMonitorEnabled(!monitorEnabled)}
            role="switch"
            aria-checked={monitorEnabled}
            aria-label="Toggle monitor audio"
            className={`relative w-11 h-6 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 outline-none ${
              monitorEnabled ? "bg-cyan-500" : "bg-white/20"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                monitorEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {monitorEnabled && (
          <p className="text-amber-300/80 text-xs leading-relaxed bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            Make sure you are wearing headphones. Without them, your mic will
            pick up the monitor and cause feedback.
          </p>
        )}

        {!monitorEnabled && (
          <p className="text-white/60 text-xs">
            Hear the mix in your local speakers — requires headphones.
          </p>
        )}
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
