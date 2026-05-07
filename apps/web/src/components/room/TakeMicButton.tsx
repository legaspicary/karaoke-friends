"use client";

import { useState } from "react";
import { useRoom } from "./RoomProvider";
import { ScreenShareGuide } from "./ScreenShareGuide";

interface ShareButtonProps {
  inStage?: boolean;
}

export function ShareButton({ inStage = false }: ShareButtonProps) {
  const { roomState, isDJ, myPeerId, startSharing, stopSharing, audioError, clearAudioError } = useRoom();

  const [showGuide, setShowGuide] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const djId = roomState.djId;
  const noDJ = djId === null;
  const someoneElseIsDJ = djId !== null && djId !== myPeerId;
  const djParticipant = djId ? roomState.participants.find((p) => p.id === djId) : null;

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await startSharing();
      setShowGuide(false);
    } catch {
      // error in audioError
    } finally {
      setIsLoading(false);
    }
  };

  const btnClass = inStage
    ? "flex items-center justify-center gap-3 py-4 px-10 rounded-2xl text-lg font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-xl shadow-purple-900/40 transition-all motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-purple-400 outline-none"
    : "w-full max-w-sm mx-auto flex items-center justify-center gap-3 py-4 px-8 rounded-2xl text-lg font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-xl shadow-purple-900/40 transition-all motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-purple-400 outline-none";

  return (
    <>
      {noDJ && (
        <button onClick={() => { clearAudioError(); setShowGuide(true); }} className={btnClass}>
          <span className="text-2xl" aria-hidden="true">📺</span>
          Share Screen
        </button>
      )}

      {isDJ && !inStage && (
        <div className="flex justify-center pb-2">
          <button
            onClick={stopSharing}
            className="w-full max-w-sm mx-auto flex items-center justify-center gap-3 py-4 px-8 rounded-2xl text-lg font-bold text-white bg-red-600 hover:bg-red-500 shadow-xl transition-all motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-red-400 outline-none"
          >
            <span className="text-2xl" aria-hidden="true">📺</span>
            Stop Sharing
          </button>
        </div>
      )}

      {someoneElseIsDJ && !inStage && (
        <div className="w-full max-w-sm mx-auto flex items-center justify-center gap-3 py-4 px-8 rounded-2xl text-lg font-medium text-white/60 bg-white/[5%] border border-white/[10%] cursor-not-allowed select-none">
          <span className="text-2xl" aria-hidden="true">📺</span>
          {djParticipant?.name ?? "Someone"} is sharing
        </div>
      )}

      {showGuide && (
        <ScreenShareGuide
          onConfirm={handleConfirm}
          onClose={() => { setShowGuide(false); clearAudioError(); }}
          error={audioError}
          isLoading={isLoading}
        />
      )}
    </>
  );
}

export function MicButton() {
  const { toggleMic, isMicActive } = useRoom();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      await toggleMic();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-base font-bold transition-all motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-purple-400 outline-none ${
        isMicActive
          ? "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/30"
          : "bg-white/[10%] hover:bg-white/[15%] text-white/80 border border-white/[10%]"
      }`}
    >
      <span className="text-xl" aria-hidden="true">{isMicActive ? "🎤" : "🔇"}</span>
      {isLoading ? "..." : isMicActive ? "Mic On" : "Mic Off"}
    </button>
  );
}
