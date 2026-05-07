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

  // Monitor (hear yourself — needs headphones)
  private monitorGain: GainNode | null = null;

  async startScreenShare(): Promise<ScreenShareStreams> {
    this.tabStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

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
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });

    [this.reverb, this.echo] = await Promise.all([
      createReverb(ctx),
      Promise.resolve(createEcho(ctx)),
    ]);

    this.micGain = ctx.createGain();
    this.micGain.gain.value = 1.0;

    this.processedMicGain = ctx.createGain();
    this.processedMicGain.gain.value = 1.0;

    this.monitorGain = ctx.createGain();
    this.monitorGain.gain.value = 0.0;

    this.micDestination = ctx.createMediaStreamDestination();
    this.micSource = ctx.createMediaStreamSource(this.micStream);

    // mic → gain → reverb → echo → processed gain → destination + monitor
    this.micSource.connect(this.micGain);
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
  }

  setReverbEnabled(on: boolean): void {
    this.reverb?.setEnabled(on);
  }

  setEchoEnabled(on: boolean): void {
    this.echo?.setEnabled(on);
  }

  setMonitorEnabled(on: boolean): void {
    if (this.monitorGain && this.ctx) {
      this.monitorGain.gain.setTargetAtTime(on ? 1.0 : 0.0, this.ctx.currentTime, 0.01);
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
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }
}
