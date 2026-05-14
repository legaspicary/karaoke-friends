"use client";

import { useState, useEffect, useCallback } from "react";
import { RoomProvider } from "@/components/room/RoomProvider";
import { VideoStage } from "@/components/room/VideoStage";
import { Sidebar } from "@/components/room/Sidebar";
import { NowPlaying } from "@/components/room/NowPlaying";
import { ConnectionStatus } from "./ConnectionStatus";
import { NameModal } from "./NameModal";

interface RoomPageClientProps {
  roomCode: string;
}

export function RoomPageClient({ roomCode }: RoomPageClientProps) {
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string>("");
  const [isReady, setIsReady] = useState(false);
  const [mobileTab, setMobileTab] = useState<"watch" | "queue">("watch");
  const [copied, setCopied] = useState(false);

  // On mount, load saved name to pre-fill the modal — but always require an
  // explicit "Join" click (never auto-join silently).
  useEffect(() => {
    const saved = sessionStorage.getItem("karaoke-player-name");
    if (saved?.trim()) {
      setSavedName(saved.trim());
    }
  }, []);

  const handleNameSubmit = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    sessionStorage.setItem("karaoke-player-name", trimmed);
    setPlayerName(trimmed);
    setIsReady(true);
  };

  const handleCopyRoomCode = useCallback(async () => {
    const url = `${window.location.origin}/room/${roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text — silently ignore if not available
    }
  }, [roomCode]);

  // Show name modal until we have a name (always shown, pre-fills saved name)
  if (!isReady || playerName === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-blue-950 flex items-center justify-center">
        {/* Background blobs matching home page */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl" />
        </div>
        <div className="relative">
          <NameModal roomCode={roomCode} initialName={savedName} onSubmit={handleNameSubmit} />
        </div>
      </div>
    );
  }

  return (
    <RoomProvider roomCode={roomCode} playerName={playerName}>
      {/* Background blobs matching home page aesthetic */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-blue-950 flex flex-col text-white">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <span className="text-2xl select-none" aria-hidden="true">🎤</span>
            <h1 className="font-bold text-white/90 text-lg tracking-tight">
              Karaoke Friends
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/60 text-sm hidden sm:inline">Room</span>
            {/* Clickable room code badge — copies full URL */}
            <div className="relative">
              <button
                onClick={handleCopyRoomCode}
                title="Click to copy room link"
                aria-label={`Room code ${roomCode} — click to copy link`}
                className="font-mono font-bold text-cyan-400 tracking-widest bg-cyan-400/10 hover:bg-cyan-400/20 focus-visible:ring-2 focus-visible:ring-purple-400 px-3 py-1 rounded-full text-sm transition-colors cursor-pointer"
              >
                {roomCode}
              </button>
              {copied && (
                <span
                  role="status"
                  aria-live="polite"
                  className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/10 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-lg pointer-events-none"
                >
                  Copied!
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Main content — two-column on lg+, tab-based on mobile */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Watch tab / left column */}
          <main className={`flex-1 flex flex-col gap-4 p-4 min-w-0 ${mobileTab !== "watch" ? "hidden lg:flex" : "flex"}`}>
            <NowPlaying />
            <div className="flex-1 min-h-0">
              <VideoStage />
            </div>
          </main>

          {/* Queue tab / right column */}
          <aside
            id="room-sidebar"
            aria-label="Room sidebar"
            className={`lg:w-80 lg:flex-none lg:border-l lg:border-white/5 lg:p-4 lg:overflow-y-auto ${mobileTab !== "queue" ? "hidden lg:block" : "flex flex-col flex-1"} w-full p-4 overflow-y-auto`}
          >
            <Sidebar />
          </aside>
        </div>

        {/* Mobile bottom tab bar */}
        <nav className="lg:hidden flex border-t border-white/10 bg-black/20 backdrop-blur-sm" aria-label="Mobile navigation">
          <button
            onClick={() => setMobileTab("watch")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-bold transition-colors ${mobileTab === "watch" ? "text-purple-400 border-t-2 border-purple-400 -mt-px" : "text-white/40"}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Watch
          </button>
          <button
            onClick={() => setMobileTab("queue")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-bold transition-colors ${mobileTab === "queue" ? "text-purple-400 border-t-2 border-purple-400 -mt-px" : "text-white/40"}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            Queue
          </button>
        </nav>

        {/* Footer — connection status (desktop only, mobile has bottom tabs) */}
        <footer className="hidden lg:flex px-6 py-2 border-t border-white/5 justify-end">
          <ConnectionStatus />
        </footer>
      </div>
    </RoomProvider>
  );
}
