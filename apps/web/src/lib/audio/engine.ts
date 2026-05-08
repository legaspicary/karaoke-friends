import { createReverb, type ReverbEffect } from "./effects/reverb";
import { createEcho, type EchoEffect } from "./effects/echo";

export interface ScreenShareStreams {
  screenStream: MediaStream;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;

  // Screen share (DJ)
  private tabStream: MediaStream | null = null;

  // Mic (anyone)
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micGain: GainNode | null = null;
  private processedMicGain: GainNode | null = null;
  private micDestination: MediaStreamAudioDestinationNode | null = null;
  private reverb: ReverbEffect | null = null;
  private echo: EchoEffect | null = null;

  // Vocal recovery (post-AEC compensation)
  private vocalHpf: BiquadFilterNode | null = null;
  private vocalCompressor: DynamicsCompressorNode | null = null;
  private presenceEq: BiquadFilterNode | null = null;
  private _vocalBoostEnabled = false;

  // Monitor (hear yourself — needs headphones)
  private monitorGain: GainNode | null = null;

  async startScreenShare(): Promise<ScreenShareStreams> {
    this.tabStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        // Tab audio is already mixed/mastered music — disable all processing
        // so Chrome doesn't treat it as speech and degrade it.
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        // Request stereo and full sample rate for music quality.
        // Not all browsers honor these on getDisplayMedia, but they don't hurt.
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
        // AEC stays on: without headphones, disabling it causes feedback loops.
        // AEC will still suppress some overlapping voices, but disabling
        // noiseSuppression (below) removes the worst of the compounding effect.
        echoCancellation: true,
        // CRITICAL: Disable noise suppression. Chrome's neural noise gate is
        // trained on speech — it classifies quiet singing, harmonizing, humming,
        // and reverb tails as "noise" and gates them. This is the single biggest
        // cause of voices cutting out during simultaneous singing.
        noiseSuppression: false,
        // Disable AGC so singers control their own dynamics (soft vs loud).
        autoGainControl: false,
        // Request full sample rate for vocal quality.
        sampleRate: 48000,
        channelCount: 1,
      },
      video: false,
    });

    [this.reverb, this.echo] = await Promise.all([
      createReverb(ctx),
      Promise.resolve(createEcho(ctx)),
    ]);

    this.vocalHpf = ctx.createBiquadFilter();
    this.vocalHpf.type = "highpass";
    this.vocalHpf.frequency.value = 120;
    this.vocalHpf.Q.value = 0.7;

    this.vocalCompressor = ctx.createDynamicsCompressor();
    this.presenceEq = ctx.createBiquadFilter();
    this.presenceEq.type = "peaking";
    this.presenceEq.frequency.value = 3000;
    this.presenceEq.Q.value = 1.0;
    this.applyVocalBoostParams(this._vocalBoostEnabled);

    this.micGain = ctx.createGain();
    this.micGain.gain.value = 1.0;

    this.processedMicGain = ctx.createGain();
    this.processedMicGain.gain.value = 1.0;

    this.monitorGain = ctx.createGain();
    this.monitorGain.gain.value = 0.0;

    this.micDestination = ctx.createMediaStreamDestination();
    this.micSource = ctx.createMediaStreamSource(this.micStream);

    // mic → hpf → compressor → presenceEq → gain → reverb → echo → processed gain → destination + monitor
    this.micSource.connect(this.vocalHpf);
    this.vocalHpf.connect(this.vocalCompressor);
    this.vocalCompressor.connect(this.presenceEq);
    this.presenceEq.connect(this.micGain);
    this.micGain.connect(this.reverb.input);
    this.reverb.output.connect(this.echo.input);
    this.echo.output.connect(this.processedMicGain);
    this.processedMicGain.connect(this.micDestination);

    // monitor path (off by default)
    this.processedMicGain.connect(this.monitorGain);
    this.monitorGain.connect(ctx.destination);

    return this.micDestination.stream;
  }

  stopMic(): void {
    this.vocalHpf?.disconnect();
    this.vocalCompressor?.disconnect();
    this.presenceEq?.disconnect();
    this.micSource?.disconnect();
    this.micGain?.disconnect();
    this.reverb?.dispose();
    this.echo?.dispose();
    this.processedMicGain?.disconnect();
    this.monitorGain?.disconnect();
    this.micDestination?.disconnect();
    this.micStream?.getTracks().forEach((t) => t.stop());

    this.micSource = null;
    this.micGain = null;
    this.reverb = null;
    this.echo = null;
    this.processedMicGain = null;
    this.monitorGain = null;
    this.micDestination = null;
    this.micStream = null;
    this.vocalHpf = null;
    this.vocalCompressor = null;
    this.presenceEq = null;
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

  setVocalBoost(enabled: boolean): void {
    this._vocalBoostEnabled = enabled;
    this.applyVocalBoostParams(enabled);
  }

  get vocalBoostEnabled(): boolean {
    return this._vocalBoostEnabled;
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

  private applyVocalBoostParams(enabled: boolean): void {
    if (!this.vocalCompressor || !this.presenceEq || !this.vocalHpf || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (enabled) {
      this.vocalHpf.frequency.setTargetAtTime(120, now, 0.01);
      this.vocalCompressor.threshold.setTargetAtTime(-24, now, 0.01);
      this.vocalCompressor.ratio.setTargetAtTime(4, now, 0.01);
      this.vocalCompressor.knee.setTargetAtTime(10, now, 0.01);
      this.vocalCompressor.attack.setTargetAtTime(0.003, now, 0.01);
      this.vocalCompressor.release.setTargetAtTime(0.15, now, 0.01);
      this.presenceEq.gain.setTargetAtTime(4, now, 0.01);
    } else {
      this.vocalHpf.frequency.setTargetAtTime(5, now, 0.01);
      this.vocalCompressor.threshold.setTargetAtTime(0, now, 0.01);
      this.vocalCompressor.ratio.setTargetAtTime(1, now, 0.01);
      this.vocalCompressor.knee.setTargetAtTime(0, now, 0.01);
      this.vocalCompressor.attack.setTargetAtTime(0.003, now, 0.01);
      this.vocalCompressor.release.setTargetAtTime(0.25, now, 0.01);
      this.presenceEq.gain.setTargetAtTime(0, now, 0.01);
    }
  }

  private ensureContext(): void {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }
}
