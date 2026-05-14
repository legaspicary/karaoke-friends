import { REVERB_PRESETS, type ReverbPresetName } from "../presets/reverb-presets";

export interface ReverbV3 {
  input: GainNode;
  output: GainNode;
  setMix(amount: number): void;
  setPreset(name: ReverbPresetName): Promise<void>;
  setPreDelay(ms: number): void;
  setDecay(amount: number): void;
  setWetHpf(hz: number): void;
  setWetLpf(hz: number): void;
  dispose(): void;
}

async function loadIR(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

function applyDecayEnvelope(original: AudioBuffer, decay: number): AudioBuffer {
  if (decay >= 1.0) return original;

  const ctx = new OfflineAudioContext(
    original.numberOfChannels,
    Math.ceil(original.length * decay),
    original.sampleRate
  );
  const trimmedLength = ctx.length;
  const buffer = ctx.createBuffer(original.numberOfChannels, trimmedLength, original.sampleRate);

  for (let ch = 0; ch < original.numberOfChannels; ch++) {
    const src = original.getChannelData(ch);
    const dst = buffer.getChannelData(ch);
    for (let i = 0; i < trimmedLength; i++) {
      const t = i / trimmedLength;
      const envelope = Math.pow(1 - t, 1.5);
      dst[i] = src[i] * envelope;
    }
  }
  return buffer;
}

export async function createReverbV3(ctx: AudioContext, presetName: ReverbPresetName = "medium-hall"): Promise<ReverbV3> {
  const preset = REVERB_PRESETS[presetName];

  const input = ctx.createGain();
  const output = ctx.createGain();
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  const convolver = ctx.createConvolver();
  const preDelay = ctx.createDelay(0.1);

  const wetHpf = ctx.createBiquadFilter();
  wetHpf.type = "highpass";
  wetHpf.Q.value = 0.707;

  const wetLpf = ctx.createBiquadFilter();
  wetLpf.type = "lowpass";
  wetLpf.Q.value = 0.707;

  // Load initial IR
  let originalIR = await loadIR(ctx, preset.irUrl);
  convolver.buffer = originalIR;

  // Apply preset defaults
  dryGain.gain.value = 1.0;
  wetGain.gain.value = 0.0;
  preDelay.delayTime.value = preset.preDelayMs / 1000;
  wetHpf.frequency.value = preset.wetHpfHz;
  wetLpf.frequency.value = preset.wetLpfHz;

  // Wiring: dry path
  input.connect(dryGain);
  dryGain.connect(output);

  // Wiring: wet path
  input.connect(preDelay);
  preDelay.connect(convolver);
  convolver.connect(wetHpf);
  wetHpf.connect(wetLpf);
  wetLpf.connect(wetGain);
  wetGain.connect(output);

  let currentDecay = 1.0;

  function setMix(amount: number): void {
    const a = Math.max(0, Math.min(1, amount));
    const now = ctx.currentTime;
    dryGain.gain.setTargetAtTime(1.0 - a * 0.4, now, 0.01);
    wetGain.gain.setTargetAtTime(a * 0.85, now, 0.01);
  }

  async function setPreset(name: ReverbPresetName): Promise<void> {
    const p = REVERB_PRESETS[name];
    originalIR = await loadIR(ctx, p.irUrl);
    convolver.buffer = currentDecay < 1.0 ? applyDecayEnvelope(originalIR, currentDecay) : originalIR;
    preDelay.delayTime.setTargetAtTime(p.preDelayMs / 1000, ctx.currentTime, 0.01);
    wetHpf.frequency.setTargetAtTime(p.wetHpfHz, ctx.currentTime, 0.01);
    wetLpf.frequency.setTargetAtTime(p.wetLpfHz, ctx.currentTime, 0.01);
  }

  function setPreDelay(ms: number): void {
    preDelay.delayTime.setTargetAtTime(Math.max(0, Math.min(100, ms)) / 1000, ctx.currentTime, 0.01);
  }

  function setDecay(amount: number): void {
    currentDecay = Math.max(0.1, Math.min(1.0, amount));
    convolver.buffer = applyDecayEnvelope(originalIR, currentDecay);
  }

  function setWetHpf(hz: number): void {
    wetHpf.frequency.setTargetAtTime(Math.max(50, Math.min(400, hz)), ctx.currentTime, 0.01);
  }

  function setWetLpf(hz: number): void {
    wetLpf.frequency.setTargetAtTime(Math.max(4000, Math.min(16000, hz)), ctx.currentTime, 0.01);
  }

  function dispose(): void {
    input.disconnect();
    preDelay.disconnect();
    convolver.disconnect();
    wetHpf.disconnect();
    wetLpf.disconnect();
    dryGain.disconnect();
    wetGain.disconnect();
    output.disconnect();
  }

  return { input, output, setMix, setPreset, setPreDelay, setDecay, setWetHpf, setWetLpf, dispose };
}
