import { createDspNode, type DspWorkletNode } from "./worklet/create-dsp-node";
import { createReverbV3, type ReverbV3 } from "./effects/reverb-v3";
import { createEchoV3, type EchoV3 } from "./effects/echo-v3";
import { VOCAL_PRESETS, type VocalPresetName } from "./presets/vocal-presets";
import type { ReverbPresetName } from "./presets/reverb-presets";
import type { ScreenShareStreams } from "./engine";

export class AudioEngineV3 {
  private ctx: AudioContext | null = null;

  private tabStream: MediaStream | null = null;

  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private channelStrip: DspWorkletNode | null = null;
  private limiterNode: DspWorkletNode | null = null;
  private micGain: GainNode | null = null;
  private processedMicGain: GainNode | null = null;
  private reverb: ReverbV3 | null = null;
  private echo: EchoV3 | null = null;
  private micDestination: MediaStreamAudioDestinationNode | null = null;
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

    // Create WASM worklet nodes
    this.channelStrip = await createDspNode(ctx, "channel-strip");
    this.limiterNode = await createDspNode(ctx, "limiter");

    // Wait for WASM to initialize
    await Promise.all([this.channelStrip.ready, this.limiterNode.ready]);

    // Create Web Audio effects
    this.reverb = await createReverbV3(ctx, "medium-hall");
    this.echo = createEchoV3(ctx);

    // Gain nodes
    this.micGain = ctx.createGain();
    this.micGain.gain.value = 1.0;

    this.processedMicGain = ctx.createGain();
    this.processedMicGain.gain.value = 1.0;

    this.monitorGain = ctx.createGain();
    this.monitorGain.gain.value = 0.0;

    this.micDestination = ctx.createMediaStreamDestination();
    this.micSource = ctx.createMediaStreamSource(this.micStream);

    // Signal chain:
    // mic → WASM channel strip → micGain → reverb → echo → processedMicGain → WASM limiter → output
    this.micSource.connect(this.channelStrip.node);
    this.channelStrip.node.connect(this.micGain);
    this.micGain.connect(this.reverb.input);
    this.reverb.output.connect(this.echo.input);
    this.echo.output.connect(this.processedMicGain);
    this.processedMicGain.connect(this.limiterNode.node);
    this.limiterNode.node.connect(this.micDestination);
    this.limiterNode.node.connect(this.monitorGain);
    this.monitorGain.connect(ctx.destination);

    // Apply default preset
    this.loadVocalPreset("neutral");

    return this.micDestination.stream;
  }

  stopMic(): void {
    this.micSource?.disconnect();
    this.channelStrip?.dispose();
    this.micGain?.disconnect();
    this.reverb?.dispose();
    this.echo?.dispose();
    this.processedMicGain?.disconnect();
    this.limiterNode?.dispose();
    this.monitorGain?.disconnect();
    this.micDestination?.disconnect();
    this.micStream?.getTracks().forEach((t) => t.stop());

    this.micSource = null;
    this.channelStrip = null;
    this.micGain = null;
    this.reverb = null;
    this.echo = null;
    this.processedMicGain = null;
    this.limiterNode = null;
    this.monitorGain = null;
    this.micDestination = null;
    this.micStream = null;
  }

  // --- Base interface (V1/V2 compatible) ---

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
        0.01
      );
    }
  }

  setMonitorVolume(vol: number): void {
    if (this.monitorGain && this.ctx) {
      this.monitorGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, vol)),
        this.ctx.currentTime,
        0.01
      );
    }
  }

  // --- V3-specific API ---

  setEQPreset(preset: VocalPresetName): void {
    const p = VOCAL_PRESETS[preset];
    if (!p || !this.channelStrip) return;
    this.channelStrip.setParam("eq-hpf", { freq: p.eq.hpf });
    this.channelStrip.setParam("eq-low-mid", { freq: p.eq.lowMid.freq, gain: p.eq.lowMid.gain, q: p.eq.lowMid.q });
    this.channelStrip.setParam("eq-high-mid", { freq: p.eq.highMid.freq, gain: p.eq.highMid.gain, q: p.eq.highMid.q });
    this.channelStrip.setParam("eq-lpf", { freq: p.eq.lpf });
  }

  setEQBand(band: 1 | 2 | 3 | 4, params: { frequency?: number; gain?: number; q?: number }): void {
    if (!this.channelStrip) return;
    const types = { 1: "eq-hpf", 2: "eq-low-mid", 3: "eq-high-mid", 4: "eq-lpf" } as const;
    if (band === 1 && params.frequency != null) {
      this.channelStrip.setParam(types[1], { freq: params.frequency });
    } else if (band === 4 && params.frequency != null) {
      this.channelStrip.setParam(types[4], { freq: params.frequency });
    } else {
      this.channelStrip.setParam(types[band], {
        freq: params.frequency ?? 0,
        gain: params.gain ?? 0,
        q: params.q ?? 1,
      });
    }
  }

  setCompressor(params: { threshold?: number; ratio?: number; knee?: number; attackMs?: number; releaseMs?: number }): void {
    if (!this.channelStrip) return;
    if (params.threshold != null) this.channelStrip.setParam("comp-threshold", { value: params.threshold });
    if (params.ratio != null) this.channelStrip.setParam("comp-ratio", { value: params.ratio });
    if (params.knee != null) this.channelStrip.setParam("comp-knee", { value: params.knee });
    if (params.attackMs != null) this.channelStrip.setParam("comp-attack", { value: params.attackMs });
    if (params.releaseMs != null) this.channelStrip.setParam("comp-release", { value: params.releaseMs });
  }

  setDeesser(params: { threshold?: number; frequency?: number; range?: number }): void {
    if (!this.channelStrip) return;
    if (params.threshold != null) this.channelStrip.setParam("deesser-threshold", { value: params.threshold });
    if (params.frequency != null) this.channelStrip.setParam("deesser-frequency", { value: params.frequency });
    if (params.range != null) this.channelStrip.setParam("deesser-range", { value: params.range });
  }

  setSaturation(params: { drive?: number; mix?: number }): void {
    if (!this.channelStrip) return;
    if (params.drive != null) this.channelStrip.setParam("saturation-drive", { value: params.drive });
    if (params.mix != null) this.channelStrip.setParam("saturation-mix", { value: params.mix });
  }

  setReverbPreset(name: ReverbPresetName): void {
    this.reverb?.setPreset(name);
  }

  setReverbPreDelay(ms: number): void {
    this.reverb?.setPreDelay(ms);
  }

  setReverbDecay(amount: number): void {
    this.reverb?.setDecay(amount);
  }

  setEchoTime(ms: number): void {
    this.echo?.setTime(ms);
  }

  setEchoFeedback(amount: number): void {
    this.echo?.setFeedback(amount);
  }

  setEchoBpm(bpm: number | null): void {
    this.echo?.setBpm(bpm);
  }

  setEchoDivision(div: "1/4" | "1/8" | "dotted-1/8" | "triplet-1/8"): void {
    this.echo?.setDivision(div);
  }

  loadVocalPreset(preset: VocalPresetName): void {
    const p = VOCAL_PRESETS[preset];
    if (!p || !this.channelStrip) return;

    this.setEQPreset(preset);

    this.channelStrip.setParam("comp-threshold", { value: p.compressor.threshold });
    this.channelStrip.setParam("comp-ratio", { value: p.compressor.ratio });
    this.channelStrip.setParam("comp-knee", { value: p.compressor.knee });
    this.channelStrip.setParam("comp-attack", { value: p.compressor.attackMs });
    this.channelStrip.setParam("comp-release", { value: p.compressor.releaseMs });

    this.channelStrip.setParam("deesser-threshold", { value: p.deesser.threshold });
    this.channelStrip.setParam("deesser-frequency", { value: p.deesser.frequency });
    this.channelStrip.setParam("deesser-range", { value: p.deesser.range });

    this.channelStrip.setParam("saturation-drive", { value: p.saturation.drive });
    this.channelStrip.setParam("saturation-mix", { value: p.saturation.mix });
  }

  async getGainReduction(): Promise<number> {
    if (!this.channelStrip) return 0;
    const meters = await this.channelStrip.requestMeters();
    return meters.gainReduction;
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
