"use client";

import { useState, useEffect, useCallback } from "react";
import type { SignalingClient } from "@/lib/signaling/client";
import type { YouTubeSearchResult, ServerMessage } from "@karaoke-friends/shared";

export function useYouTubeSearch(client: SignalingClient | null) {
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!client) return;
    const handler = (msg: ServerMessage) => {
      if (msg.type === "youtube-search-results") {
        setResults(msg.results);
        setIsSearching(false);
      }
    };
    client.on("message", handler);
    return () => client.off("message", handler);
  }, [client]);

  const search = useCallback(
    (query: string) => {
      if (!query.trim() || !client) return;
      setIsSearching(true);
      client.send({ type: "youtube-search", query: query.trim() });
    },
    [client],
  );

  const clearResults = useCallback(() => {
    setResults([]);
    setIsSearching(false);
  }, []);

  return { results, isSearching, search, clearResults };
}
