import { writeFileSync, mkdirSync } from "fs";

function encodeWav(samples, sampleRate, channels) {
  const numSamples = samples[0].length;
  const bytesPerSample = 2;
  const dataSize = numSamples * channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const s = Math.max(-1, Math.min(1, samples[ch][i]));
      view.setInt16(offset, s * 32767, true);
      offset += 2;
    }
  }
  return Buffer.from(buffer);
}

function generateIR(sampleRate, durationSec, earlyTaps, decayPow, tailStart, amplitude) {
  const length = Math.ceil(sampleRate * durationSec);
  const channels = [new Float64Array(length), new Float64Array(length)];

  for (let ch = 0; ch < 2; ch++) {
    for (const { time, gain } of earlyTaps) {
      const idx = Math.floor(time * sampleRate);
      if (idx < length) {
        channels[ch][idx] += (Math.random() * 2 - 1) * gain * (ch === 0 ? 1 : 0.8);
      }
    }
    const tailIdx = Math.floor(tailStart * sampleRate);
    for (let i = tailIdx; i < length; i++) {
      const t = (i - tailIdx) / (length - tailIdx);
      channels[ch][i] += (Math.random() * 2 - 1) * Math.pow(1 - t, decayPow) * amplitude;
    }
  }
  return channels;
}

const SR = 48000;
mkdirSync("apps/web/public/ir", { recursive: true });

const presets = [
  {
    name: "small-room",
    duration: 0.5,
    taps: [{ time: 0.002, gain: 0.9 }, { time: 0.006, gain: 0.6 }, { time: 0.012, gain: 0.3 }],
    decayPow: 3.5, tailStart: 0.015, amplitude: 0.5,
  },
  {
    name: "medium-hall",
    duration: 1.5,
    taps: [{ time: 0.008, gain: 0.7 }, { time: 0.018, gain: 0.5 }, { time: 0.032, gain: 0.35 }, { time: 0.05, gain: 0.2 }],
    decayPow: 2.0, tailStart: 0.06, amplitude: 0.7,
  },
  {
    name: "large-hall",
    duration: 3.0,
    taps: [{ time: 0.015, gain: 0.6 }, { time: 0.035, gain: 0.4 }, { time: 0.06, gain: 0.25 }, { time: 0.09, gain: 0.15 }],
    decayPow: 1.5, tailStart: 0.1, amplitude: 0.8,
  },
  {
    name: "plate",
    duration: 1.8,
    taps: [{ time: 0.001, gain: 0.5 }, { time: 0.003, gain: 0.4 }, { time: 0.005, gain: 0.35 }, { time: 0.008, gain: 0.3 }],
    decayPow: 1.8, tailStart: 0.01, amplitude: 0.9,
  },
  {
    name: "spring",
    duration: 1.2,
    taps: [{ time: 0.01, gain: 0.8 }, { time: 0.035, gain: 0.6 }, { time: 0.07, gain: 0.7 }, { time: 0.11, gain: 0.4 }],
    decayPow: 2.5, tailStart: 0.12, amplitude: 0.6,
  },
];

for (const p of presets) {
  const ir = generateIR(SR, p.duration, p.taps, p.decayPow, p.tailStart, p.amplitude);
  const wav = encodeWav(ir, SR, 2);
  writeFileSync(`apps/web/public/ir/${p.name}.wav`, wav);
  console.log(`Generated ${p.name}.wav (${(wav.length / 1024).toFixed(0)} KB)`);
}
