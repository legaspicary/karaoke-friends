export interface Song {
  id: string;
  title: string;
  url?: string;
  thumbnail?: string;
  addedBy: string;
  singerName?: string;
  durationSeconds?: number;
  votes: string[];
  addedAt: number;
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

export interface Participant {
  id: string;
  name: string;
}

export type ClientMessage =
  | { type: "join"; name: string }
  | { type: "signal"; to: string; data: unknown }
  | { type: "take-mic" }
  | { type: "drop-mic" }
  | { type: "queue-add"; song: { title: string; url?: string; thumbnail?: string; durationSeconds?: number } }
  | { type: "queue-remove"; id: string }
  | { type: "queue-reorder"; ids: string[] }
  | { type: "queue-set-current"; id: string | null }
  | { type: "queue-vote"; id: string }
  | { type: "youtube-search"; query: string };

export type ServerMessage =
  | {
      type: "room-state";
      you: string;
      participants: Participant[];
      djId: string | null;
      queue: Song[];
      currentSongId: string | null;
      history: Song[];
      searchCredits: number;
    }
  | { type: "peer-joined"; peer: Participant }
  | { type: "peer-left"; peerId: string }
  | { type: "signal"; from: string; data: unknown }
  | { type: "dj-changed"; djId: string | null }
  | { type: "queue-updated"; queue: Song[]; currentSongId: string | null; history: Song[] }
  | { type: "youtube-search-results"; results: YouTubeSearchResult[]; creditsRemaining: number }
  | { type: "credits-updated"; searchCredits: number }
  | { type: "error"; message: string };
