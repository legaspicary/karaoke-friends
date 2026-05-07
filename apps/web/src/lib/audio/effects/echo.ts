export interface EchoEffect {
  /** Connect your source node to this */
  input: GainNode;
  /** Connect this to the next stage */
  output: GainNode;
  /** Set wet/dry mix: 0 = fully dry, 1 = full echo */
  setMix(amount: number): void;
  dispose(): void;
}

/**
 * Create an echo/delay effect using a DelayNode with a feedback loop.
 *
 * Signal path (when enabled):
 *   input → dryGain → output            (dry path, always gain 1.0)
 *   input → delay → feedbackGain → delay (feedback loop)
 *   delay → wetGain → output            (wet path, gain 0.5 when on / 0 when off)
 *
 * Delay time: 200ms
 * Feedback: 0.4 (40% of each repeat fed back)
 */
export function createEcho(ctx: AudioContext): EchoEffect {
  const DELAY_TIME = 0.2; // 200ms
  const FEEDBACK_GAIN = 0.4;

  const input = ctx.createGain();
  const output = ctx.createGain();

  const delay = ctx.createDelay(1.0); // max delay 1s
  delay.delayTime.value = DELAY_TIME;

  const feedbackGain = ctx.createGain();
  feedbackGain.gain.value = FEEDBACK_GAIN;

  const dryGain = ctx.createGain();
  dryGain.gain.value = 1.0;

  const wetGain = ctx.createGain();
  wetGain.gain.value = 0.0; // disabled by default

  // Dry path
  input.connect(dryGain);
  dryGain.connect(output);

  // Wet path — input feeds delay, delay feeds output and loops back via feedbackGain
  input.connect(delay);
  delay.connect(wetGain);
  wetGain.connect(output);
  delay.connect(feedbackGain);
  feedbackGain.connect(delay);

  function setMix(amount: number): void {
    const a = Math.max(0, Math.min(1, amount));
    const now = ctx.currentTime;
    wetGain.gain.setTargetAtTime(a * 0.6, now, 0.01);
  }

  function dispose(): void {
    input.disconnect();
    delay.disconnect();
    feedbackGain.disconnect();
    dryGain.disconnect();
    wetGain.disconnect();
    output.disconnect();
  }

  return { input, output, setMix, dispose };
}
