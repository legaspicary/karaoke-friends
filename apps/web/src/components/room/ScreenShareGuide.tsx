"use client";

import { useEffect, useRef } from "react";

interface ScreenShareGuideProps {
  onConfirm: () => void;
  onClose: () => void;
  error?: string | null;
  isLoading?: boolean;
}

export function ScreenShareGuide({
  onConfirm,
  onClose,
  error,
  isLoading,
}: ScreenShareGuideProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Focus the primary action button when opened
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    // Focus the confirm button (or cancel if loading)
    const id = requestAnimationFrame(() => confirmBtnRef.current?.focus());
    return () => {
      cancelAnimationFrame(id);
      dialogRef.current?.close();
    };
  }, []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      aria-labelledby="screen-share-guide-title"
      aria-describedby="screen-share-guide-desc"
      className="bg-transparent p-0 max-w-lg w-full rounded-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="bg-[#1a1035] border border-white/10 rounded-2xl shadow-2xl text-white overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-5">
          <h2 id="screen-share-guide-title" className="text-2xl font-bold tracking-tight">
            Ready to take the mic?
          </h2>
          <p id="screen-share-guide-desc" className="text-white/80 text-sm mt-1">
            Follow these steps to share your karaoke session
          </p>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <Step
            number={1}
            text="Open YouTube in another tab and find your karaoke song"
          />
          <Step
            number={2}
            text='When Chrome asks what to share, pick that tab'
          />
          <Step
            number={3}
            text={
              <>
                Make sure{" "}
                <span className="text-cyan-400 font-semibold">
                  &quot;Share tab audio&quot;
                </span>{" "}
                is checked!
              </>
            }
          />

          {/* Error state */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3"
            >
              <span className="text-xl leading-none mt-0.5" aria-hidden="true">⚠️</span>
              <div>
                <p className="text-red-300 font-semibold text-sm">
                  Tab audio capture failed
                </p>
                <p className="text-red-200/80 text-sm mt-0.5 leading-relaxed">
                  {error}
                </p>
                <p className="text-red-200/60 text-xs mt-1">
                  Make sure to check &quot;Share tab audio&quot; in the browser dialog and
                  try again.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-purple-400 outline-none"
          >
            Cancel
          </button>
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-purple-400 outline-none"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full motion-safe:animate-spin" aria-hidden="true" />
                Starting…
              </>
            ) : error ? (
              "Try again"
            ) : (
              "Got it, let's go!"
            )}
          </button>
        </div>
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// Internal Step component
// ---------------------------------------------------------------------------

function Step({
  number,
  text,
}: {
  number: number;
  text: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="flex-none w-8 h-8 rounded-full bg-purple-600/80 text-white text-sm font-bold flex items-center justify-center shadow" aria-hidden="true">
        {number}
      </span>
      <p className="text-white/85 text-sm leading-relaxed pt-1">{text}</p>
    </div>
  );
}
