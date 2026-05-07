"use client";

import { useEffect, useRef } from "react";
import { useRoom } from "./RoomProvider";
import { ShareButton, MicButton } from "./TakeMicButton";

function RemoteAudio({ stream, volume }: { stream: MediaStream; volume: number }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    el.play().catch(() => {});
  }, [stream]);
  useEffect(() => {
    if (ref.current) ref.current.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);
  return <audio ref={ref} autoPlay />;
}

export function VideoStage() {
  const {
    roomState,
    myPeerId,
    isDJ,
    remoteStreams,
    localScreenStream,
    connectionStatus,
    screenVolume,
    peerVolumes,
  } = useRoom();

  const djId = roomState.djId;
  const noDJ = djId === null;
  const remoteDJId = !isDJ && djId !== null && djId !== myPeerId ? djId : null;
  const remoteDJStream = remoteDJId ? remoteStreams.get(remoteDJId) : null;

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el || !remoteDJStream) return;
    el.srcObject = remoteDJStream;
    el.play().catch((err) => {
      console.warn("[VideoStage] Remote video play() failed, will retry on user gesture", err);
    });
  }, [remoteDJStream]);
  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.volume = Math.max(0, Math.min(1, screenVolume));
  }, [screenVolume]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = localVideoRef.current;
    if (!el || !localScreenStream) return;
    el.srcObject = localScreenStream;
    el.play().catch(() => {});
  }, [localScreenStream]);

  const djParticipant = djId ? roomState.participants.find((p) => p.id === djId) : null;
  const connectionFailed = connectionStatus === "failed";

  // Streams that aren't already played by the DJ <video> element need
  // their own <audio> so everyone hears each other's mics.
  // - Non-DJ user: DJ stream plays in <video>, all others need <audio>
  // - DJ user: local preview is muted, so ALL remote streams need <audio>
  const audioOnlyStreams = Array.from(remoteStreams.entries()).filter(
    ([peerId]) => peerId !== remoteDJId
  );

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Hidden audio elements for non-DJ peer streams (mics) */}
      {audioOnlyStreams.map(([peerId, stream]) => (
        <RemoteAudio key={peerId} stream={stream} volume={peerVolumes.get(peerId) ?? 1} />
      ))}

      {/* Video area */}
      <div
        className={`relative w-full flex-1 min-h-0 rounded-2xl overflow-hidden flex flex-col items-center justify-center ${
          noDJ && !connectionFailed
            ? "bg-[#0f0a1e] ring-2 ring-purple-500/40 motion-safe:animate-pulse-ring"
            : "bg-[#0f0a1e]"
        }`}
      >
        {connectionFailed && (
          <div className="flex flex-col items-center gap-5 text-center px-8">
            <div className="text-5xl select-none" aria-hidden="true">🚫</div>
            <div>
              <h2 className="text-white text-2xl font-bold">Room not found</h2>
              <p className="text-white/60 text-base mt-2 leading-relaxed max-w-xs">
                We couldn&apos;t connect to this room. It may not exist or the link may be expired.
              </p>
            </div>
            <a href="/" className="mt-2 inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg transition-all focus-visible:ring-2 focus-visible:ring-purple-400 outline-none">
              Back to Home
            </a>
          </div>
        )}

        {!connectionFailed && noDJ && (
          <div className="flex flex-col items-center gap-6 text-center px-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-purple-500/20 motion-safe:animate-ping" />
              <div className="relative text-7xl select-none" aria-hidden="true">📺</div>
            </div>
            <div>
              <p className="text-white text-2xl font-bold leading-tight">No one&apos;s sharing yet</p>
              <p className="text-white/60 text-base mt-2">Share your screen to play karaoke!</p>
            </div>
            <ShareButton inStage />
          </div>
        )}

        {!connectionFailed && remoteDJId && remoteDJStream && (
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-contain rounded-2xl" />
        )}

        {!connectionFailed && remoteDJId && !remoteDJStream && (
          <div className="flex flex-col items-center gap-3 text-center px-8">
            <div className="w-10 h-10 border-4 border-purple-400 border-t-transparent rounded-full motion-safe:animate-spin" />
            <p className="text-white/60 text-lg">{djParticipant?.name ?? "Someone"} is setting up the stream…</p>
          </div>
        )}

        {!connectionFailed && isDJ && localScreenStream && (
          <>
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-contain rounded-2xl" />
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600/90 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm">
              <span className="w-2 h-2 bg-white rounded-full motion-safe:animate-pulse" />
              You&apos;re sharing
            </div>
          </>
        )}

        {!connectionFailed && isDJ && !localScreenStream && (
          <div className="flex flex-col items-center gap-3 text-center px-8">
            <div className="w-10 h-10 border-4 border-pink-400 border-t-transparent rounded-full motion-safe:animate-spin" />
            <p className="text-white/60 text-lg">Starting your stream…</p>
          </div>
        )}
      </div>

      {/* Controls below video */}
      {!connectionFailed && (
        <div className="flex items-center justify-center gap-3">
          {!noDJ && <ShareButton />}
          <MicButton />
        </div>
      )}
    </div>
  );
}
