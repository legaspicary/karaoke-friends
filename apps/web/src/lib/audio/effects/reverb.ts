export interface ReverbEffect {
  /** Connect your source node to this */
  input: GainNode;
  /** Connect this to the next stage */
  output: GainNode;
  /** Set wet/dry mix: 0 = fully dry, 1 = full reverb */
  setMix(amount: number): void;
  dispose(): void;
}

/**
 * Generate a synthetic impulse response using an OfflineAudioContext.
 *
 * The response is exponential-decay noise (~1.5s), which produces a
 * convincing small-hall reverb without requiring an external WAV file.
 */
async function generateImpulse(
  sampleRate: number,
  durationSec = 1.5
): Promise<AudioBuffer> {
  const length = Math.ceil(sampleRate * durationSec);
  const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

  const bufferSource = offlineCtx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = bufferSource.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      // White noise attenuated by an exponential decay envelope
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
    }
  }

  const src = offlineCtx.createBufferSource();
  src.buffer = bufferSource;
  src.connect(offlineCtx.destination);
  src.start(0);

  return offlineCtx.startRendering();
}

/**
 * Create a reverb effect using a ConvolverNode with wet/dry gain routing.
 *
 * Signal path (when enabled):
 *   input → dryGain → output          (dry path, gain 0.8 when on / 1.0 when off)
 *   input → convolver → wetGain → output  (wet path, gain 0.4 when on / 0 when off)
 */
export async function createReverb(ctx: AudioContext): Promise<ReverbEffect> {
  const impulse = await generateImpulse(ctx.sampleRate);

  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;

  const input = ctx.createGain();
  const output = ctx.createGain();
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();

  // Initial state: dry only (disabled)
  dryGain.gain.value = 1.0;
  wetGain.gain.value = 0.0;

  // Dry path
  input.connect(dryGain);
  dryGain.connect(output);

  // Wet path
  input.connect(convolver);
  convolver.connect(wetGain);
  wetGain.connect(output);

  function setMix(amount: number): void {
    const a = Math.max(0, Math.min(1, amount));
    const now = ctx.currentTime;
    dryGain.gain.setTargetAtTime(1.0 - a * 0.3, now, 0.01);
    wetGain.gain.setTargetAtTime(a * 0.5, now, 0.01);
  }

  function dispose(): void {
    input.disconnect();
    convolver.disconnect();
    dryGain.disconnect();
    wetGain.disconnect();
    output.disconnect();
  }

  return { input, output, setMix, dispose };
}
