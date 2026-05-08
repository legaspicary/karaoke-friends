import { createEcho, type EchoEffect } from "./effects/echo";

export interface ScreenShareStreams {
  screenStream: MediaStream;
}

async function generatePlateImpulse(
  sampleRate: number,
  durationSec = 1.5
): Promise<AudioBuffer> {
  const length = Math.ceil(sampleRate * durationSec);
  const offlineCtx = new OfflineAudioContext(2, length, sampleRate);
  const buffer = offlineCtx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);

    // Early reflections — discrete taps simulating wall bounces
    const taps = [
      { time: 0.005, gain: 0.7 },
      { time: 0.012, gain: 0.5 },
      { time: 0.020, gain: 0.35 },
      { time: 0.033, gain: 0.2 },
    ];
    for (const tap of taps) {
      const idx = Math.floor(tap.time * sampleRate);
      if (idx < length) {
        data[idx] += (Math.random() * 2 - 1) * tap.gain * (ch === 0 ? 1 : -1);
      }
    }

    // Diffuse tail — exponential decay noise with steeper rolloff than v1
    const tailStart = Math.floor(0.04 * sampleRate);
    for (let i = tailStart; i < length; i++) {
      const t = (i - tailStart) / (length - tailStart);
      data[i] += (Math.random() * 2 - 1) * Math.pow(1 - t, 2.0) * 0.7;
    }
  }

  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(offlineCtx.destination);
  src.start(0);
  return offlineCtx.startRendering();
}

interface ReverbV2 {
  input: GainNode;
  output: GainNode;
  setMix(amount: number): void;
  dispose(): void;
}

async function createReverbV2(ctx: AudioContext): Promise<ReverbV2> {
  const impulse = await generatePlateImpulse(ctx.sampleRate);
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;

  const input = ctx.createGain();
  const output = ctx.createGain();
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();

  dryGain.gain.value = 1.0;
  wetGain.gain.value = 0.0;

  const preDelay = ctx.createDelay(0.1);
  preDelay.delayTime.value = 0.025;

  // Wet signal EQ — remove mud and harshness from reverb return
  const wetHpf = ctx.createBiquadFilter();
  wetHpf.type = "highpass";
  wetHpf.frequency.value = 100;
  wetHpf.Q.value = 0.7;

  const wetLpf = ctx.createBiquadFilter();
  wetLpf.type = "lowpass";
  wetLpf.frequency.value = 14000;
  wetLpf.Q.value = 0.7;

  // Dry path
  input.connect(dryGain);
  dryGain.connect(output);

  // Wet path: input → preDelay → convolver → wetHpf → wetLpf → wetGain → output
  input.connect(preDelay);
  preDelay.connect(convolver);
  convolver.connect(wetHpf);
  wetHpf.connect(wetLpf);
  wetLpf.connect(wetGain);
  wetGain.connect(output);

  function setMix(amount: number): void {
    const a = Math.max(0, Math.min(1, amount));
    const now = ctx.currentTime;
    dryGain.gain.setTargetAtTime(1.0 - a * 0.4, now, 0.01);
    wetGain.gain.setTargetAtTime(a * 0.85, now, 0.01);
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

  return { input, output, setMix, dispose };
}

export class AudioEngineV2 {
  private ctx: AudioContext | null = null;

  // Screen share (DJ)
  private tabStream: MediaStream | null = null;

  // Mic chain
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private hpf: BiquadFilterNode | null = null;
  private lpf: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private micGain: GainNode | null = null;
  private reverb: ReverbV2 | null = null;
  private echo: EchoEffect | null = null;
  private processedMicGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private micDestination: MediaStreamAudioDestinationNode | null = null;

  // Monitor taps BEFORE effects — dry signal only
  private monitorGain: GainNode | null = null;

  async startScreenShare(): Promise<ScreenShareStreams> {
    this.tabStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2,
        sampleRate: 48000,
      },
    } as DisplayMediaStreamOptions);

    if (this.tabStream.getAudioTracks().length === 0) {
      this.tabStream.getTracks().forEach((t) => t.stop());
      this.tabStream = null;
      throw new Error(
        "Tab audio was not shared. Please try again and make sure to check the 'Share tab audio' checkbox."
      );
    }

    return { screenStream: this.tabStream };
  }

  stopScreenShare(): void {
    this.tabStream?.getTracks().forEach((t) => t.stop());
    this.tabStream = null;
  }

  async startMic(): Promise<MediaStream> {
    this.ensureContext();
    const ctx = this.ctx!;

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 48000,
        channelCount: 1,
      },
      video: false,
    });

    [this.reverb, this.echo] = await Promise.all([
      createReverbV2(ctx),
      Promise.resolve(createEcho(ctx)),
    ]);

    // Band-limit BEFORE compression — prevents hiss from amplified noise
    this.hpf = ctx.createBiquadFilter();
    this.hpf.type = "highpass";
    this.hpf.frequency.value = 120;
    this.hpf.Q.value = 0.7;

    this.lpf = ctx.createBiquadFilter();
    this.lpf.type = "lowpass";
    this.lpf.frequency.value = 12000;
    this.lpf.Q.value = 0.7;

    // Gentle vocal compressor — evens dynamics without crushing
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.ratio.value = 3;
    this.compressor.knee.value = 10;
    this.compressor.attack.value = 0.025;
    this.compressor.release.value = 0.1;

    this.micGain = ctx.createGain();
    this.micGain.gain.value = 1.0;

    this.processedMicGain = ctx.createGain();
    this.processedMicGain.gain.value = 1.0;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.05;

    this.monitorGain = ctx.createGain();
    this.monitorGain.gain.value = 0.0;

    this.micDestination = ctx.createMediaStreamDestination();
    this.micSource = ctx.createMediaStreamSource(this.micStream);

    // --- Wiring ---
    // mic → HPF → LPF → compressor (band-limited before compression = no hiss)
    this.micSource.connect(this.hpf);
    this.hpf.connect(this.lpf);
    this.lpf.connect(this.compressor);

    // Monitor taps dry signal AFTER compression, BEFORE effects.
    // AEC sees exactly what comes out of speakers — no reverb/echo confusion.
    this.compressor.connect(this.monitorGain);
    this.monitorGain.connect(ctx.destination);

    // Processed path → gain → reverb → echo → output → limiter → WebRTC only
    this.compressor.connect(this.micGain);
    this.micGain.connect(this.reverb.input);
    this.reverb.output.connect(this.echo.input);
    this.echo.output.connect(this.processedMicGain);
    this.processedMicGain.connect(this.limiter);
    this.limiter.connect(this.micDestination);

    return this.micDestination.stream;
  }

  stopMic(): void {
    this.micSource?.disconnect();
    this.hpf?.disconnect();
    this.lpf?.disconnect();
    this.compressor?.disconnect();
    this.micGain?.disconnect();
    this.reverb?.dispose();
    this.echo?.dispose();
    this.processedMicGain?.disconnect();
    this.limiter?.disconnect();
    this.monitorGain?.disconnect();
    this.micDestination?.disconnect();
    this.micStream?.getTracks().forEach((t) => t.stop());

    this.micSource = null;
    this.hpf = null;
    this.lpf = null;
    this.compressor = null;
    this.micGain = null;
    this.reverb = null;
    this.echo = null;
    this.processedMicGain = null;
    this.limiter = null;
    this.monitorGain = null;
    this.micDestination = null;
    this.micStream = null;
  }

  setReverbMix(amount: number): void {
    this.reverb?.setMix(amount);
  }

  setEchoMix(amount: number): void {
    this.echo?.setMix(amount);
  }

  setMicGain(vol: number): void {
    if (this.micGain && this.ctx) {
      this.micGain.gain.setTargetAtTime(
        Math.max(0, Math.min(2, vol)),
        this.ctx.currentTime,
        0.01,
      );
    }
  }

  setMonitorVolume(vol: number): void {
    if (this.monitorGain && this.ctx) {
      this.monitorGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, vol)),
        this.ctx.currentTime,
        0.01,
      );
    }
  }

  dispose(): void {
    this.stopScreenShare();
    this.stopMic();
    if (this.ctx && this.ctx.state !== "closed") {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
  }

  private ensureContext(): void {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext({ latencyHint: "interactive" });
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }
}
