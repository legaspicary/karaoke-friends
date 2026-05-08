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
  private lowMidCut: BiquadFilterNode | null = null;
  private vocalCompressor: DynamicsCompressorNode | null = null;
  private presenceEq: BiquadFilterNode | null = null;
  private airShelf: BiquadFilterNode | null = null;
  private deEsserLowpass: BiquadFilterNode | null = null;
  private deEsserHighpass: BiquadFilterNode | null = null;
  private deEsserCompressor: DynamicsCompressorNode | null = null;
  private deEsserMerge: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
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

    // --- Vocal boost chain (all toggled via applyVocalBoostParams) ---
    this.vocalHpf = ctx.createBiquadFilter();
    this.vocalHpf.type = "highpass";
    this.vocalHpf.frequency.value = 120;
    this.vocalHpf.Q.value = 0.7;

    this.lowMidCut = ctx.createBiquadFilter();
    this.lowMidCut.type = "peaking";
    this.lowMidCut.frequency.value = 280;
    this.lowMidCut.Q.value = 0.7;

    this.vocalCompressor = ctx.createDynamicsCompressor();

    this.presenceEq = ctx.createBiquadFilter();
    this.presenceEq.type = "peaking";
    this.presenceEq.frequency.value = 4500;
    this.presenceEq.Q.value = 1.2;

    this.airShelf = ctx.createBiquadFilter();
    this.airShelf.type = "highshelf";
    this.airShelf.frequency.value = 10000;

    // De-esser: multiband split at 5kHz — compress only the sibilant band
    this.deEsserLowpass = ctx.createBiquadFilter();
    this.deEsserLowpass.type = "lowpass";
    this.deEsserLowpass.frequency.value = 5000;
    this.deEsserLowpass.Q.value = 0.7;

    this.deEsserHighpass = ctx.createBiquadFilter();
    this.deEsserHighpass.type = "highpass";
    this.deEsserHighpass.frequency.value = 5000;
    this.deEsserHighpass.Q.value = 0.7;

    this.deEsserCompressor = ctx.createDynamicsCompressor();
    this.deEsserMerge = ctx.createGain();

    this.applyVocalBoostParams(this._vocalBoostEnabled);

    // --- Standard nodes ---
    this.micGain = ctx.createGain();
    this.micGain.gain.value = 1.0;

    this.processedMicGain = ctx.createGain();
    this.processedMicGain.gain.value = 1.0;

    // Brick-wall limiter — always active, prevents clipping into WebRTC
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
    // mic → hpf → lowMidCut → compressor → presenceEq → airShelf
    this.micSource.connect(this.vocalHpf);
    this.vocalHpf.connect(this.lowMidCut);
    this.lowMidCut.connect(this.vocalCompressor);
    this.vocalCompressor.connect(this.presenceEq);
    this.presenceEq.connect(this.airShelf);

    // → de-esser (multiband: low pass-through + compressed high band → merge)
    this.airShelf.connect(this.deEsserLowpass);
    this.airShelf.connect(this.deEsserHighpass);
    this.deEsserLowpass.connect(this.deEsserMerge);
    this.deEsserHighpass.connect(this.deEsserCompressor);
    this.deEsserCompressor.connect(this.deEsserMerge);

    // → gain → reverb → echo → output gain → limiter → destination + monitor
    this.deEsserMerge.connect(this.micGain);
    this.micGain.connect(this.reverb.input);
    this.reverb.output.connect(this.echo.input);
    this.echo.output.connect(this.processedMicGain);
    this.processedMicGain.connect(this.limiter);
    this.limiter.connect(this.micDestination);
    this.limiter.connect(this.monitorGain);
    this.monitorGain.connect(ctx.destination);

    return this.micDestination.stream;
  }

  stopMic(): void {
    this.vocalHpf?.disconnect();
    this.lowMidCut?.disconnect();
    this.vocalCompressor?.disconnect();
    this.presenceEq?.disconnect();
    this.airShelf?.disconnect();
    this.deEsserLowpass?.disconnect();
    this.deEsserHighpass?.disconnect();
    this.deEsserCompressor?.disconnect();
    this.deEsserMerge?.disconnect();
    this.micSource?.disconnect();
    this.micGain?.disconnect();
    this.reverb?.dispose();
    this.echo?.dispose();
    this.processedMicGain?.disconnect();
    this.limiter?.disconnect();
    this.monitorGain?.disconnect();
    this.micDestination?.disconnect();
    this.micStream?.getTracks().forEach((t) => t.stop());

    this.micSource = null;
    this.micGain = null;
    this.reverb = null;
    this.echo = null;
    this.processedMicGain = null;
    this.limiter = null;
    this.monitorGain = null;
    this.micDestination = null;
    this.micStream = null;
    this.vocalHpf = null;
    this.lowMidCut = null;
    this.vocalCompressor = null;
    this.presenceEq = null;
    this.airShelf = null;
    this.deEsserLowpass = null;
    this.deEsserHighpass = null;
    this.deEsserCompressor = null;
    this.deEsserMerge = null;
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
    if (!this.vocalCompressor || !this.presenceEq || !this.vocalHpf
      || !this.lowMidCut || !this.airShelf || !this.deEsserCompressor
      || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (enabled) {
      this.vocalHpf.frequency.setTargetAtTime(120, now, 0.01);
      this.lowMidCut.gain.setTargetAtTime(-3, now, 0.01);
      this.vocalCompressor.threshold.setTargetAtTime(-12, now, 0.01);
      this.vocalCompressor.ratio.setTargetAtTime(3, now, 0.01);
      this.vocalCompressor.knee.setTargetAtTime(10, now, 0.01);
      this.vocalCompressor.attack.setTargetAtTime(0.015, now, 0.01);
      this.vocalCompressor.release.setTargetAtTime(0.1, now, 0.01);
      this.presenceEq.gain.setTargetAtTime(2, now, 0.01);
      this.airShelf.gain.setTargetAtTime(1, now, 0.01);
      this.deEsserCompressor.threshold.setTargetAtTime(-20, now, 0.01);
      this.deEsserCompressor.ratio.setTargetAtTime(6, now, 0.01);
      this.deEsserCompressor.knee.setTargetAtTime(0, now, 0.01);
      this.deEsserCompressor.attack.setTargetAtTime(0.0005, now, 0.01);
      this.deEsserCompressor.release.setTargetAtTime(0.05, now, 0.01);
    } else {
      this.vocalHpf.frequency.setTargetAtTime(5, now, 0.01);
      this.lowMidCut.gain.setTargetAtTime(0, now, 0.01);
      this.vocalCompressor.threshold.setTargetAtTime(0, now, 0.01);
      this.vocalCompressor.ratio.setTargetAtTime(1, now, 0.01);
      this.vocalCompressor.knee.setTargetAtTime(0, now, 0.01);
      this.vocalCompressor.attack.setTargetAtTime(0.015, now, 0.01);
      this.vocalCompressor.release.setTargetAtTime(0.25, now, 0.01);
      this.presenceEq.gain.setTargetAtTime(0, now, 0.01);
      this.airShelf.gain.setTargetAtTime(0, now, 0.01);
      this.deEsserCompressor.threshold.setTargetAtTime(0, now, 0.01);
      this.deEsserCompressor.ratio.setTargetAtTime(1, now, 0.01);
      this.deEsserCompressor.knee.setTargetAtTime(0, now, 0.01);
      this.deEsserCompressor.attack.setTargetAtTime(0.0005, now, 0.01);
      this.deEsserCompressor.release.setTargetAtTime(0.25, now, 0.01);
    }
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
