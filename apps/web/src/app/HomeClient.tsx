"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generateRoomCode } from "@/lib/room/code";

export function HomeClient() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [nameError, setNameError] = useState("");

  // Pre-fill from sessionStorage if available
  useEffect(() => {
    const saved = sessionStorage.getItem("karaoke-player-name");
    if (saved) {
      setPlayerName(saved);
    }
  }, []);

  const saveName = (name: string): boolean => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Enter your name first!");
      return false;
    }
    setNameError("");
    sessionStorage.setItem("karaoke-player-name", trimmed);
    return true;
  };

  const handleStartParty = () => {
    if (!saveName(playerName)) return;
    const code = generateRoomCode();
    router.push(`/room/${code}`);
  };

  const handleJoin = () => {
    if (!saveName(playerName)) return;
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    router.push(`/room/${code}`);
  };

  const handleJoinKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleJoin();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-blue-950 flex items-center justify-center p-4">
      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
          {/* Title area */}
          <div className="px-8 pt-10 pb-6 text-center">
            <div className="text-5xl mb-4 select-none">🎤</div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white">
              Karaoke Friends
            </h1>
            <p className="text-white/50 mt-2 text-sm">
              Sing together, no matter where you are
            </p>
          </div>

          <div className="px-8 pb-10 flex flex-col gap-6">
            {/* Name input */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="player-name"
                className="text-white/70 text-xs font-semibold uppercase tracking-wide"
              >
                Your name
              </label>
              <input
                id="player-name"
                type="text"
                value={playerName}
                onChange={(e) => {
                  setPlayerName(e.target.value);
                  if (nameError) setNameError("");
                }}
                placeholder="e.g. Beyoncé"
                maxLength={30}
                className="bg-white/8 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 outline-none focus:border-purple-500/60 focus:bg-white/10 focus-visible:ring-2 focus-visible:ring-purple-400 transition-colors text-sm"
              />
              {nameError && (
                <p className="text-red-400 text-xs">{nameError}</p>
              )}
            </div>

            {/* Start Party */}
            <button
              onClick={handleStartParty}
              className="w-full py-4 rounded-2xl text-base font-extrabold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-xl shadow-purple-900/40 transition-all motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]"
            >
              Start a Party
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <span className="flex-1 h-px bg-white/10" />
              <span className="text-white/60 text-sm font-medium">or</span>
              <span className="flex-1 h-px bg-white/10" />
            </div>

            {/* Join section */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="join-code"
                className="text-white/70 text-xs font-semibold uppercase tracking-wide"
              >
                Join a room
              </label>
              <div className="flex gap-2">
                <input
                  id="join-code"
                  type="text"
                  value={joinCode}
                  onChange={(e) =>
                    setJoinCode(e.target.value.toUpperCase().slice(0, 6))
                  }
                  onKeyDown={handleJoinKeyDown}
                  placeholder="ROOM CODE"
                  maxLength={6}
                  className="flex-1 bg-white/8 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 outline-none focus:border-cyan-500/60 focus:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-400 transition-colors text-sm font-mono tracking-widest uppercase"
                />
                <button
                  onClick={handleJoin}
                  disabled={!joinCode.trim()}
                  className="px-5 py-3 rounded-xl text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg transition-all"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/60 text-xs mt-6">
          Share the room code with friends to sing together
        </p>
      </div>
    </div>
  );
}
