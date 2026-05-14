"use client";

import { useRoom } from "./RoomProvider";

export function NowPlaying() {
  const { roomState, isDJ, nextSong, voteSong, myPeerId } = useRoom();
  const { queue, currentSongId } = roomState;

  if (!currentSongId) return null;

  const currentSong = queue.find((s) => s.id === currentSongId);
  if (!currentSong) return null;

  const currentIndex = queue.findIndex((s) => s.id === currentSongId);
  const hasNext = currentIndex < queue.length - 1;
  const addedBy = roomState.participants.find(
    (p) => p.id === currentSong.addedBy,
  );
  const hasVoted = myPeerId ? currentSong.votes.includes(myPeerId) : false;
  const voteCount = currentSong.votes.length;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-pink-600/15 border border-purple-500/20 px-4 py-2.5 flex-none">
      <span className="text-pink-400 text-sm flex-none motion-safe:animate-pulse">
        ▶
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">
          {currentSong.title}
        </p>
        {addedBy && (
          <p className="text-white/40 text-xs truncate">
            added by {addedBy.name}
          </p>
        )}
      </div>

      {/* Vote */}
      <button
        onClick={() => voteSong(currentSong.id)}
        aria-pressed={hasVoted}
        aria-label={hasVoted ? "Remove vote" : "Vote for this song"}
        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold transition-colors ${
          hasVoted
            ? "text-purple-300 bg-purple-500/20"
            : "text-white/40 hover:text-white/60 bg-white/5"
        }`}
      >
        <svg width="8" height="6" viewBox="0 0 12 8" fill="currentColor">
          <path d="M6 0L12 8H0z" />
        </svg>
        {voteCount > 0 && <span className="tabular-nums">{voteCount}</span>}
      </button>

      <span className="text-white/40 text-xs tabular-nums flex-none">
        {currentIndex + 1}/{queue.length}
      </span>

      {isDJ && hasNext && (
        <button
          onClick={nextSong}
          className="text-xs font-bold text-cyan-400 bg-cyan-400/10 hover:bg-cyan-400/20 rounded-full px-3 py-1 transition-colors flex-none focus-visible:ring-2 focus-visible:ring-cyan-400 outline-none"
        >
          Next
        </button>
      )}
    </div>
  );
}
