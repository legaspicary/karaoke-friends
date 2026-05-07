"use client";

import { useState } from "react";
import { useRoom } from "./RoomProvider";
import type { Song } from "@/lib/signaling/messages";

export function SongQueue() {
  const {
    roomState,
    isDJ,
    addSong,
    removeSong,
    setCurrentSong,
  } = useRoom();

  const { queue, currentSongId } = roomState;

  const [titleInput, setTitleInput] = useState("");
  const [urlInput, setUrlInput] = useState("");

  const handleAddSong = () => {
    const title = titleInput.trim();
    if (!title) return;
    const url = urlInput.trim() || undefined;
    addSong({ title, url });
    setTitleInput("");
    setUrlInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddSong();
    }
  };

  const handleNextSong = () => {
    if (queue.length === 0) return;
    const currentIndex = queue.findIndex((s) => s.id === currentSongId);
    if (currentIndex === -1) {
      setCurrentSong(queue[0].id);
    } else if (currentIndex < queue.length - 1) {
      setCurrentSong(queue[currentIndex + 1].id);
    } else {
      setCurrentSong(null);
    }
  };

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-white/90 font-semibold text-sm tracking-wide uppercase">
          Song Queue
        </h2>
        {isDJ && queue.length > 0 && (
          <button
            onClick={handleNextSong}
            className="text-xs font-bold text-cyan-400 bg-cyan-400/10 hover:bg-cyan-400/20 rounded-full px-3 py-1 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 outline-none"
          >
            Next Song
          </button>
        )}
      </div>

      {/* Queue list — aria-live so screen readers announce additions */}
      <div aria-live="polite" aria-label="Song queue">
        {queue.length === 0 ? (
          <p className="text-white/60 text-sm text-center py-3">
            Queue is empty — add a song below!
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {queue.map((song: Song, index: number) => {
              const isCurrent = song.id === currentSongId;
              return (
                <li
                  key={song.id}
                  className={`flex items-start gap-2 rounded-lg px-3 py-2 transition-colors ${
                    isCurrent
                      ? "bg-gradient-to-r from-purple-600/30 to-pink-600/20 border border-purple-500/30"
                      : "hover:bg-white/5"
                  }`}
                >
                  {/* Index / Now playing indicator */}
                  <span
                    className={`flex-none text-xs font-bold w-5 text-center mt-0.5 ${
                      isCurrent ? "text-pink-400" : "text-white/60"
                    }`}
                    aria-hidden={isCurrent ? undefined : "true"}
                  >
                    {isCurrent ? "▶" : index + 1}
                  </span>

                  {/* Song info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        isCurrent ? "text-white" : "text-white/80"
                      }`}
                    >
                      {isCurrent && <span className="sr-only">Now playing: </span>}
                      {song.title}
                    </p>
                    {song.url && (
                      <a
                        href={song.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyan-400/70 hover:text-cyan-300 underline truncate block focus-visible:ring-2 focus-visible:ring-cyan-400 outline-none rounded"
                      >
                        {song.url}
                      </a>
                    )}
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => removeSong(song.id)}
                    className="flex-none text-white/60 hover:text-red-400 transition-colors text-lg leading-none mt-0.5 focus-visible:ring-2 focus-visible:ring-red-400 outline-none rounded"
                    aria-label={`Remove ${song.title}`}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Add Song */}
      <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
        <input
          type="text"
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Song title…"
          aria-label="Song title"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 focus-visible:ring-2 focus-visible:ring-purple-400 focus:border-purple-500/60 focus:bg-white/8 transition-colors outline-none"
        />
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="YouTube URL (optional)"
          aria-label="YouTube URL (optional)"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 focus-visible:ring-2 focus-visible:ring-purple-400 focus:border-purple-500/60 focus:bg-white/8 transition-colors outline-none"
        />
        <button
          onClick={handleAddSong}
          disabled={!titleInput.trim()}
          className="w-full py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-purple-600/80 to-pink-600/80 hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-purple-400 outline-none"
        >
          Add Song
        </button>
      </div>
    </div>
  );
}
