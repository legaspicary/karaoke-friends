import type { SignalingClient } from "../signaling/client";

interface SignalData {
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  remoteStream: MediaStream;
  // Sender references per track (label → RTCRtpSender[]) for removeTrack
  senders: Map<string, RTCRtpSender[]>;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
}

// ---------------------------------------------------------------------------
// SDP Munging — Disable Opus DTX & set music-friendly codec parameters
// ---------------------------------------------------------------------------
// DTX (Discontinuous Transmission) stops sending packets during "silence".
// Its silence detector is calibrated for speech, not music/singing — it cuts
// off quiet vocals, reverb tails, and soft musical passages.
//
// We also set stereo, high bitrate, constant bitrate, and full bandwidth
// so Opus treats the audio as music rather than speech.
// ---------------------------------------------------------------------------
function mungeOpusSdp(sdp: string): string {
  return sdp.replace(
    /a=fmtp:(\d+) (.+)/g,
    (match, payloadType: string, existingParams: string) => {
      // Only modify Opus lines — verify the payload type maps to opus
      const rtpmapRegex = new RegExp(
        `a=rtpmap:${payloadType} opus/48000/2`
      );
      if (!rtpmapRegex.test(sdp)) {
        return match; // Not Opus — leave unchanged
      }

      const params = new Map<string, string>();
      for (const part of existingParams.split(";")) {
        const eq = part.indexOf("=");
        if (eq === -1) continue;
        params.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
      }

      // Music-friendly overrides
      params.set("usedtx", "0");                // Disable DTX — never drop packets
      params.set("stereo", "1");                 // Allow stereo decoding
      params.set("sprop-stereo", "1");           // Signal that we may send stereo
      params.set("maxaveragebitrate", "128000");  // 128 kbps — near-transparent for music
      params.set("maxplaybackrate", "48000");     // Full 48 kHz bandwidth
      params.set("cbr", "1");                    // Constant bitrate — no quality dips

      const newFmtp = Array.from(params.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join(";");

      return `a=fmtp:${payloadType} ${newFmtp}`;
    }
  );
}

export class PeerMesh {
  private peers: Map<string, PeerEntry> = new Map();

  // Local streams to send to all peers — keyed by caller-provided label
  // e.g. "mixed-audio", "screen", "mic"
  private localStreams: Map<string, MediaStream> = new Map();

  private readonly iceConfig: RTCConfiguration;
  private readonly signaling: SignalingClient;

  // ---------------------------------------------------------------------------
  // Event callbacks (set by consumer)
  // ---------------------------------------------------------------------------
  onRemoteStream: (peerId: string, stream: MediaStream) => void = () => {};
  onRemoteStreamRemoved: (peerId: string) => void = () => {};
  onConnectionStateChange: (
    peerId: string,
    state: RTCPeerConnectionState
  ) => void = () => {};

  constructor(signaling: SignalingClient, iceConfig: RTCConfiguration) {
    this.signaling = signaling;
    this.iceConfig = iceConfig;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async addPeer(peerId: string, isInitiator: boolean): Promise<void> {
    if (this.peers.has(peerId)) {
      console.warn(`[PeerMesh] addPeer called for existing peer ${peerId}`);
      return;
    }

    const pc = new RTCPeerConnection(this.iceConfig);
    const remoteStream = new MediaStream();
    const senders: Map<string, RTCRtpSender[]> = new Map();

    const entry: PeerEntry = {
      pc,
      remoteStream,
      senders,
      disconnectTimer: null,
    };
    this.peers.set(peerId, entry);

    // Add all current local tracks to this new connection
    for (const [label, stream] of this.localStreams) {
      const sendersForLabel: RTCRtpSender[] = [];
      for (const track of stream.getTracks()) {
        const sender = pc.addTrack(track, stream);
        sendersForLabel.push(sender);

        if (track.kind === "audio") {
          const mode = label === "screen" ? "music" : "voice";
          this.configureAudioSender(sender, mode).catch(() => {});
        }
      }
      senders.set(label, sendersForLabel);
    }

    pc.onnegotiationneeded = async () => {
      console.log(`[PeerMesh] onnegotiationneeded for ${peerId}, signalingState=${pc.signalingState}`);
      if (pc.signalingState !== "stable") {
        console.log(`[PeerMesh] Skipping negotiation for ${peerId} — not in stable state`);
        return;
      }
      try {
        const offer = await pc.createOffer();
        // Munge SDP to disable DTX and set music-quality Opus parameters
        offer.sdp = mungeOpusSdp(offer.sdp!);
        await pc.setLocalDescription(offer);
        this.signaling.send({
          type: "signal",
          to: peerId,
          data: { sdp: pc.localDescription! } satisfies SignalData,
        });
        console.log(`[PeerMesh] Sent renegotiation offer to ${peerId}`);
      } catch (err) {
        console.error(`[PeerMesh] Renegotiation offer failed for ${peerId}`, err);
      }
    };

    // ICE candidate → forward to peer via signaling
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.signaling.send({
          type: "signal",
          to: peerId,
          data: { candidate: ev.candidate.toJSON() } satisfies SignalData,
        });
      }
    };

    // Incoming tracks → collect into the remote stream
    pc.ontrack = (ev) => {
      console.log(`[PeerMesh] ontrack from ${peerId}: kind=${ev.track.kind}, readyState=${ev.track.readyState}, streams=${ev.streams.length}`);
      if (!remoteStream.getTracks().includes(ev.track)) {
        remoteStream.addTrack(ev.track);
      }
      console.log(`[PeerMesh] remoteStream for ${peerId} now has ${remoteStream.getTracks().length} tracks: ${remoteStream.getTracks().map(t => `${t.kind}(${t.readyState})`).join(", ")}`);
      // Pass a NEW MediaStream so React detects the reference change
      this.onRemoteStream(peerId, new MediaStream(remoteStream.getTracks()));
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      this.onConnectionStateChange(peerId, pc.connectionState);
    };

    // ICE connection state for disconnect / failure handling
    pc.oniceconnectionstatechange = () => {
      this.handleIceStateChange(peerId, pc.iceConnectionState);
    };

    // If initiator and no local tracks, onnegotiationneeded won't fire
    // automatically, so send an initial offer manually
    if (isInitiator && this.localStreams.size === 0) {
      try {
        const offer = await pc.createOffer();
        offer.sdp = mungeOpusSdp(offer.sdp!);
        await pc.setLocalDescription(offer);
        this.signaling.send({
          type: "signal",
          to: peerId,
          data: { sdp: pc.localDescription! } satisfies SignalData,
        });
      } catch (err) {
        console.error(`[PeerMesh] Failed to create offer for ${peerId}`, err);
      }
    }
    // If we have local tracks, addTrack above will trigger onnegotiationneeded
  }

  removePeer(peerId: string): void {
    const entry = this.peers.get(peerId);
    if (!entry) return;

    if (entry.disconnectTimer !== null) {
      clearTimeout(entry.disconnectTimer);
    }
    entry.pc.onnegotiationneeded = null;
    entry.pc.onicecandidate = null;
    entry.pc.ontrack = null;
    entry.pc.onconnectionstatechange = null;
    entry.pc.oniceconnectionstatechange = null;
    entry.pc.close();
    this.peers.delete(peerId);
    this.onRemoteStreamRemoved(peerId);
  }

  setLocalStream(label: string, stream: MediaStream | null): void {
    if (stream === null) {
      // Remove tracks for this label from all peers
      for (const [peerId, entry] of this.peers) {
        const sendersForLabel = entry.senders.get(label);
        if (sendersForLabel) {
          for (const sender of sendersForLabel) {
            try {
              entry.pc.removeTrack(sender);
            } catch (err) {
              console.warn(
                `[PeerMesh] removeTrack failed for ${peerId}/${label}`,
                err
              );
            }
          }
          entry.senders.delete(label);
        }
      }
      this.localStreams.delete(label);
      return;
    }

    // Update or set stream for this label
    this.localStreams.set(label, stream);

    for (const [, entry] of this.peers) {
      // Remove old senders for this label first
      const oldSenders = entry.senders.get(label) ?? [];
      for (const sender of oldSenders) {
        try {
          entry.pc.removeTrack(sender);
        } catch {
          // Ignore — connection may already be closed
        }
      }

      // Add new tracks and configure audio senders for music-quality encoding
      const newSenders: RTCRtpSender[] = [];
      for (const track of stream.getTracks()) {
        const sender = entry.pc.addTrack(track, stream);
        newSenders.push(sender);

        if (track.kind === "audio") {
          const mode = label === "screen" ? "music" : "voice";
          this.configureAudioSender(sender, mode).catch(() => {});
        }
      }
      entry.senders.set(label, newSenders);
    }
  }

  handleSignal(from: string, data: unknown): void {
    let entry = this.peers.get(from);
    if (!entry) {
      console.warn(
        `[PeerMesh] Received signal from unknown peer ${from}. Known peers: [${[...this.peers.keys()].join(", ")}]. Auto-creating as non-initiator.`
      );
      // Race condition: room-state may not have been processed yet.
      // Create the peer on-the-fly so the offer is not lost.
      this.addPeer(from, false);
      entry = this.peers.get(from);
      if (!entry) return;
    }

    const signal = data as SignalData;

    if (signal.sdp) {
      console.log(`[PeerMesh] Received SDP ${signal.sdp.type} from ${from}`);
      this.handleSdp(from, entry, signal.sdp);
    } else if (signal.candidate) {
      entry.pc
        .addIceCandidate(new RTCIceCandidate(signal.candidate))
        .catch((err) =>
          console.warn(`[PeerMesh] addIceCandidate failed for ${from}`, err)
        );
    }
  }

  destroy(): void {
    for (const peerId of [...this.peers.keys()]) {
      this.removePeer(peerId);
    }
    this.localStreams.clear();
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Configure an audio RTCRtpSender for high-quality audio.
   *
   * `setParameters` adjusts the Opus encoder's bitrate allocation at the
   * sender level (complementing the SDP-level fmtp overrides).
   *
   * - "music" (tab audio): 128 kbps — near-transparent for stereo music
   * - "voice" (singing mic): 64 kbps — well above the 32 kbps speech default
   */
  private async configureAudioSender(
    sender: RTCRtpSender,
    mode: "music" | "voice"
  ): Promise<void> {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }

    for (const encoding of params.encodings) {
      encoding.maxBitrate = mode === "music" ? 128_000 : 64_000;
    }

    try {
      await sender.setParameters(params);
    } catch (err) {
      console.warn("[PeerMesh] configureAudioSender setParameters failed:", err);
    }
  }

  private async handleSdp(
    peerId: string,
    entry: PeerEntry,
    sdp: RTCSessionDescriptionInit
  ): Promise<void> {
    const { pc } = entry;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      if (sdp.type === "offer") {
        const answer = await pc.createAnswer();
        // Munge SDP to disable DTX and set music-quality Opus parameters
        answer.sdp = mungeOpusSdp(answer.sdp!);
        await pc.setLocalDescription(answer);
        this.signaling.send({
          type: "signal",
          to: peerId,
          data: { sdp: pc.localDescription! } satisfies SignalData,
        });
      }
    } catch (err) {
      console.error(`[PeerMesh] SDP handling failed for ${peerId}`, err);
    }
  }

  private handleIceStateChange(
    peerId: string,
    state: RTCIceConnectionState
  ): void {
    const entry = this.peers.get(peerId);
    if (!entry) return;

    if (state === "disconnected") {
      // Wait 5s for the browser to self-recover before treating it as failed
      entry.disconnectTimer = setTimeout(() => {
        const current = this.peers.get(peerId);
        if (
          current &&
          current.pc.iceConnectionState === "disconnected"
        ) {
          console.warn(
            `[PeerMesh] Peer ${peerId} still disconnected after 5s — treating as failed`
          );
          this.renegotiate(peerId);
        }
      }, 5000);
    } else if (state === "failed") {
      if (entry.disconnectTimer !== null) {
        clearTimeout(entry.disconnectTimer);
        entry.disconnectTimer = null;
      }
      this.renegotiate(peerId);
    } else if (state === "connected" || state === "completed") {
      // Clear any pending disconnect timer
      if (entry.disconnectTimer !== null) {
        clearTimeout(entry.disconnectTimer);
        entry.disconnectTimer = null;
      }
    }
  }

  private renegotiate(peerId: string): void {
    console.info(`[PeerMesh] Renegotiating with ${peerId}`);
    this.removePeer(peerId);
    // Re-add as initiator to restart negotiation
    this.addPeer(peerId, true).catch((err) =>
      console.error(`[PeerMesh] Renegotiation failed for ${peerId}`, err)
    );
  }
}
