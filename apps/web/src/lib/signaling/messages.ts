// Shared message types between the signaling server (packages/party) and the web client.
// Keep this file in sync with packages/party/src/messages.ts.

export interface Song {
  id: string;
  title: string;
  url?: string;
  addedBy: string;
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
  | { type: "queue-add"; song: { title: string; url?: string } }
  | { type: "queue-remove"; id: string }
  | { type: "queue-reorder"; ids: string[] }
  | { type: "queue-set-current"; id: string | null };

export type ServerMessage =
  | {
      type: "room-state";
      you: string;
      participants: Participant[];
      djId: string | null;
      queue: Song[];
      currentSongId: string | null;
    }
  | { type: "peer-joined"; peer: Participant }
  | { type: "peer-left"; peerId: string }
  | { type: "signal"; from: string; data: unknown }
  | { type: "dj-changed"; djId: string | null }
  | { type: "queue-updated"; queue: Song[]; currentSongId: string | null }
  | { type: "error"; message: string };
