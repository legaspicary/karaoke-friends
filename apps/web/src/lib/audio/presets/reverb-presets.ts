export interface ReverbPreset {
  name: string;
  label: string;
  irUrl: string;
  preDelayMs: number;
  wetHpfHz: number;
  wetLpfHz: number;
  defaultMix: number;
}

export const REVERB_PRESETS: Record<string, ReverbPreset> = {
  "small-room": {
    name: "small-room",
    label: "Small Room",
    irUrl: "/ir/small-room.wav",
    preDelayMs: 10,
    wetHpfHz: 150,
    wetLpfHz: 10000,
    defaultMix: 0.3,
  },
  "medium-hall": {
    name: "medium-hall",
    label: "Medium Hall",
    irUrl: "/ir/medium-hall.wav",
    preDelayMs: 25,
    wetHpfHz: 100,
    wetLpfHz: 12000,
    defaultMix: 0.4,
  },
  "large-hall": {
    name: "large-hall",
    label: "Large Hall",
    irUrl: "/ir/large-hall.wav",
    preDelayMs: 40,
    wetHpfHz: 80,
    wetLpfHz: 10000,
    defaultMix: 0.35,
  },
  plate: {
    name: "plate",
    label: "Plate",
    irUrl: "/ir/plate.wav",
    preDelayMs: 5,
    wetHpfHz: 200,
    wetLpfHz: 14000,
    defaultMix: 0.4,
  },
  spring: {
    name: "spring",
    label: "Spring",
    irUrl: "/ir/spring.wav",
    preDelayMs: 15,
    wetHpfHz: 120,
    wetLpfHz: 8000,
    defaultMix: 0.3,
  },
};

export type ReverbPresetName = keyof typeof REVERB_PRESETS;
