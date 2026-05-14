export interface EchoV3 {
  input: GainNode;
  output: GainNode;
  setMix(amount: number): void;
  setTime(ms: number): void;
  setFeedback(amount: number): void;
  setBpm(bpm: number | null): void;
  setDivision(div: EchoDivision): void;
  dispose(): void;
}

export type EchoDivision = "1/4" | "1/8" | "dotted-1/8" | "triplet-1/8";

const DIVISION_MULTIPLIERS: Record<EchoDivision, number> = {
  "1/4": 1.0,
  "1/8": 0.5,
  "dotted-1/8": 0.75,
  "triplet-1/8": 1 / 3,
};

function bpmToMs(bpm: number, division: EchoDivision): number {
  const quarterNoteMs = 60000 / bpm;
  return quarterNoteMs * DIVISION_MULTIPLIERS[division];
}

export function createEchoV3(ctx: AudioContext): EchoV3 {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();

  // Delay line
  const delay = ctx.createDelay(2.0); // max 2 seconds
  delay.delayTime.value = 0.2; // 200ms default

  // Feedback loop with filtering (each repeat gets darker)
  const feedbackGain = ctx.createGain();
  feedbackGain.gain.value = 0.4;

  const feedbackHpf = ctx.createBiquadFilter();
  feedbackHpf.type = "highpass";
  feedbackHpf.frequency.value = 200;
  feedbackHpf.Q.value = 0.707;

  const feedbackLpf = ctx.createBiquadFilter();
  feedbackLpf.type = "lowpass";
  feedbackLpf.frequency.value = 6000;
  feedbackLpf.Q.value = 0.707;

  // Mix controls
  dryGain.gain.value = 1.0;
  wetGain.gain.value = 0.0;

  // Wiring: dry path
  input.connect(dryGain);
  dryGain.connect(output);

  // Wiring: wet path — input → delay → wetGain → output
  input.connect(delay);
  delay.connect(wetGain);
  wetGain.connect(output);

  // Feedback: delay → HPF → LPF → feedbackGain → delay
  delay.connect(feedbackHpf);
  feedbackHpf.connect(feedbackLpf);
  feedbackLpf.connect(feedbackGain);
  feedbackGain.connect(delay);

  let currentBpm: number | null = null;
  let currentDivision: EchoDivision = "1/4";
  let currentTimeMs = 200;

  function updateDelayTime(): void {
    const ms = currentBpm !== null
      ? bpmToMs(currentBpm, currentDivision)
      : currentTimeMs;
    delay.delayTime.setTargetAtTime(
      Math.max(0.05, Math.min(2.0, ms / 1000)),
      ctx.currentTime,
      0.01
    );
  }

  function setMix(amount: number): void {
    const a = Math.max(0, Math.min(1, amount));
    const now = ctx.currentTime;
    dryGain.gain.setTargetAtTime(1.0, now, 0.01);
    wetGain.gain.setTargetAtTime(a * 0.6, now, 0.01);
  }

  function setTime(ms: number): void {
    currentTimeMs = Math.max(50, Math.min(1000, ms));
    if (currentBpm === null) updateDelayTime();
  }

  function setFeedback(amount: number): void {
    feedbackGain.gain.setTargetAtTime(
      Math.max(0, Math.min(0.8, amount)),
      ctx.currentTime,
      0.01
    );
  }

  function setBpm(bpm: number | null): void {
    currentBpm = bpm;
    updateDelayTime();
  }

  function setDivision(div: EchoDivision): void {
    currentDivision = div;
    if (currentBpm !== null) updateDelayTime();
  }

  function dispose(): void {
    input.disconnect();
    delay.disconnect();
    feedbackGain.disconnect();
    feedbackHpf.disconnect();
    feedbackLpf.disconnect();
    dryGain.disconnect();
    wetGain.disconnect();
    output.disconnect();
  }

  return { input, output, setMix, setTime, setFeedback, setBpm, setDivision, dispose };
}
