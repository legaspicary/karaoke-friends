export interface VocalPreset {
  name: string;
  label: string;
  eq: {
    hpf: number;
    lowMid: { freq: number; gain: number; q: number };
    highMid: { freq: number; gain: number; q: number };
    lpf: number;
  };
  compressor: {
    threshold: number;
    ratio: number;
    knee: number;
    attackMs: number;
    releaseMs: number;
  };
  deesser: {
    threshold: number;
    frequency: number;
    range: number;
  };
  saturation: {
    drive: number;
    mix: number;
  };
}

export const VOCAL_PRESETS: Record<string, VocalPreset> = {
  warm: {
    name: "warm",
    label: "Warm",
    eq: {
      hpf: 60,
      lowMid: { freq: 300, gain: 3.0, q: 0.8 },
      highMid: { freq: 3500, gain: -1.0, q: 1.0 },
      lpf: 14000,
    },
    compressor: { threshold: -18, ratio: 3, knee: 8, attackMs: 25, releaseMs: 100 },
    deesser: { threshold: -18, frequency: 6000, range: 6 },
    saturation: { drive: 6, mix: 0.15 },
  },
  bright: {
    name: "bright",
    label: "Bright",
    eq: {
      hpf: 100,
      lowMid: { freq: 350, gain: -1.5, q: 1.0 },
      highMid: { freq: 4000, gain: 3.0, q: 1.2 },
      lpf: 16000,
    },
    compressor: { threshold: -16, ratio: 4, knee: 4, attackMs: 5, releaseMs: 80 },
    deesser: { threshold: -15, frequency: 6500, range: 8 },
    saturation: { drive: 3, mix: 0.08 },
  },
  neutral: {
    name: "neutral",
    label: "Neutral",
    eq: {
      hpf: 80,
      lowMid: { freq: 350, gain: 0, q: 1.0 },
      highMid: { freq: 3500, gain: 0, q: 1.0 },
      lpf: 16000,
    },
    compressor: { threshold: -18, ratio: 2.5, knee: 6, attackMs: 10, releaseMs: 80 },
    deesser: { threshold: -20, frequency: 6000, range: 6 },
    saturation: { drive: 0, mix: 0 },
  },
};

export type VocalPresetName = keyof typeof VOCAL_PRESETS;
