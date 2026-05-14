"use client";

import { useState } from "react";
import { useRoom } from "./RoomProvider";
import type { Song, YouTubeSearchResult } from "@karaoke-friends/shared";

export function SongQueue() {
  const {
    roomState,
    myPeerId,
    isDJ,
    addSong,
    removeSong,
    voteSong,
    playSong,
    nextSong,
    youtubeSearch,
    youtubeResults,
    isSearching,
    clearSearchResults,
  } = useRoom();

  const { queue, currentSongId, searchCredits } = roomState;

  const [searchQuery, setSearchQuery] = useState("");
  const [showUrlFallback, setShowUrlFallback] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [titleInput, setTitleInput] = useState("");

  const handleSearchSubmit = () => {
    const trimmed = searchQuery.trim();
    if (trimmed) youtubeSearch(trimmed);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearchSubmit();
  };

  const handleAddFromSearch = (result: YouTubeSearchResult) => {
    addSong({
      title: result.title,
      url: `https://www.youtube.com/watch?v=${result.videoId}`,
      thumbnail: result.thumbnail,
    });
  };

  const handleAddFromUrl = () => {
    const url = urlInput.trim();
    const title = titleInput.trim() || titleFromUrl(url) || "Untitled";
    const videoId = extractVideoId(url);
    addSong({
      title,
      url: url || undefined,
      thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : undefined,
    });
    setUrlInput("");
    setTitleInput("");
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAddFromUrl();
  };

  const canAddUrl = urlInput.trim() !== "" || titleInput.trim() !== "";

  const currentIdx = currentSongId
    ? queue.findIndex((s) => s.id === currentSongId)
    : -1;

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-white/90 font-semibold text-sm tracking-wide uppercase">
          Song Queue
          {queue.length > 0 && (
            <span className="text-white/40 font-normal ml-1.5">
              ({queue.length})
            </span>
          )}
        </h2>
        {queue.length > 0 && (
          <button
            onClick={nextSong}
            className="text-xs font-bold text-cyan-400 bg-cyan-400/10 hover:bg-cyan-400/20 rounded-full px-3 py-1 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 outline-none"
          >
            {currentSongId ? "Next Song" : "Start Playing"}
          </button>
        )}
      </div>

      {/* Queue list */}
      <div aria-live="polite" aria-label="Song queue">
        {queue.length === 0 ? (
          <p className="text-white/40 text-sm text-center py-4">
            Queue is empty — search for a song below!
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {queue.map((song: Song, index: number) => {
              const isCurrent = song.id === currentSongId;
              const isPlayed = currentIdx >= 0 && index < currentIdx;
              const hasVoted = myPeerId
                ? song.votes.includes(myPeerId)
                : false;
              const voteCount = song.votes.length;
              const addedBy = roomState.participants.find(
                (p) => p.id === song.addedBy,
              );

              return (
                <li
                  key={song.id}
                  className={`group flex items-stretch gap-0 rounded-lg transition-colors overflow-hidden ${
                    isCurrent
                      ? "bg-gradient-to-r from-purple-600/30 to-pink-600/20 border border-purple-500/30"
                      : isPlayed
                        ? "opacity-40"
                        : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  {/* Vote button */}
                  <button
                    onClick={() => voteSong(song.id)}
                    aria-label={
                      hasVoted
                        ? `Remove vote from ${song.title}`
                        : `Vote for ${song.title}`
                    }
                    aria-pressed={hasVoted}
                    className={`flex flex-col items-center justify-center w-10 flex-none transition-colors ${
                      hasVoted
                        ? "text-purple-400 bg-purple-500/15"
                        : "text-white/25 hover:text-white/50 hover:bg-white/5"
                    }`}
                  >
                    <svg
                      width="12"
                      height="8"
                      viewBox="0 0 12 8"
                      fill="currentColor"
                      className="flex-none"
                    >
                      <path d="M6 0L12 8H0z" />
                    </svg>
                    {voteCount > 0 && (
                      <span className="text-[10px] font-bold tabular-nums mt-0.5">
                        {voteCount}
                      </span>
                    )}
                  </button>

                  {/* Thumbnail */}
                  {song.thumbnail && (
                    <div className="w-14 h-10 flex-none self-center my-1 ml-1 rounded overflow-hidden bg-white/5">
                      <img
                        src={song.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Song content */}
                  <div className="flex-1 min-w-0 py-2 pr-2 pl-2 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isCurrent && (
                          <span className="text-pink-400 text-xs flex-none">
                            ▶
                          </span>
                        )}
                        <p
                          className={`text-sm font-medium truncate ${
                            isCurrent ? "text-white" : "text-white/80"
                          }`}
                        >
                          {isCurrent && (
                            <span className="sr-only">Now playing: </span>
                          )}
                          {decodeHtmlEntities(song.title)}
                        </p>
                      </div>
                      {addedBy && (
                        <p className="text-[11px] text-white/20 mt-0.5 truncate">
                          {addedBy.name}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-none">
                      {song.url && !isCurrent && (
                        <button
                          onClick={() => playSong(song.id)}
                          className="p-1.5 text-white/0 group-hover:text-white/40 hover:!text-cyan-400 transition-colors rounded focus-visible:ring-2 focus-visible:ring-cyan-400 outline-none"
                          aria-label={`Play ${song.title}`}
                          title="Play now"
                        >
                          <svg
                            width="10"
                            height="12"
                            viewBox="0 0 10 12"
                            fill="currentColor"
                          >
                            <path d="M0 0L10 6L0 12z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => removeSong(song.id)}
                        className="p-1.5 text-white/0 group-hover:text-white/30 hover:!text-red-400 transition-colors rounded text-sm leading-none focus-visible:ring-2 focus-visible:ring-red-400 outline-none"
                        aria-label={`Remove ${song.title}`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search for karaoke songs…"
              aria-label="Search YouTube for karaoke songs"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 pl-9 text-sm text-white placeholder-white/40 focus-visible:ring-2 focus-visible:ring-purple-400 focus:border-purple-500/60 focus:bg-white/8 transition-colors outline-none"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full motion-safe:animate-spin" />
            )}
          </div>
          <button
            onClick={handleSearchSubmit}
            disabled={!searchQuery.trim() || searchCredits <= 0}
            className="px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-purple-600/80 hover:bg-purple-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-purple-400 outline-none active:scale-[0.97]"
          >
            Search
          </button>
        </div>

        {/* Credits */}
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] text-white/25">
            {searchCredits} search{searchCredits !== 1 ? "es" : ""} remaining
          </p>
          <button
            onClick={() => setShowUrlFallback(!showUrlFallback)}
            className="text-[11px] text-white/25 hover:text-white/50 transition-colors"
          >
            {showUrlFallback ? "Hide" : "Paste URL instead"}
          </button>
        </div>

        {/* Search results */}
        {youtubeResults.length > 0 && (
          <ul className="flex flex-col gap-1">
            {youtubeResults.map((result) => (
              <li key={result.videoId}>
                <button
                  onClick={() => handleAddFromSearch(result)}
                  className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5 transition-colors text-left group/result"
                >
                  <div className="w-16 h-11 flex-none rounded overflow-hidden bg-white/5">
                    <img
                      src={result.thumbnail}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 truncate leading-tight">
                      {decodeHtmlEntities(result.title)}
                    </p>
                    <p className="text-[11px] text-white/30 truncate mt-0.5">
                      {result.channelTitle}
                    </p>
                  </div>
                  <span className="text-white/0 group-hover/result:text-purple-400 text-lg flex-none transition-colors">
                    +
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* URL fallback */}
        {showUrlFallback && (
          <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={handleUrlKeyDown}
              placeholder="Paste YouTube URL…"
              aria-label="YouTube URL"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/40 focus-visible:ring-2 focus-visible:ring-purple-400 focus:border-purple-500/60 focus:bg-white/8 transition-colors outline-none"
            />
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={handleUrlKeyDown}
              placeholder={urlInput.trim() ? "Title (optional)" : "Song title…"}
              aria-label="Song title"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/40 focus-visible:ring-2 focus-visible:ring-purple-400 focus:border-purple-500/60 focus:bg-white/8 transition-colors outline-none"
            />
            <button
              onClick={handleAddFromUrl}
              disabled={!canAddUrl}
              className="w-full py-2.5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-purple-600/80 to-pink-600/80 hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-purple-400 outline-none active:scale-[0.98]"
            >
              Add to Queue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function titleFromUrl(url: string): string | null {
  if (!url) return null;
  const videoId = extractVideoId(url);
  if (videoId) return `YouTube — ${videoId}`;
  return null;
}

function extractVideoId(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.get("v") ||
      (parsed.hostname === "youtu.be" ? parsed.pathname.slice(1) : null)
    );
  } catch {
    return null;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
