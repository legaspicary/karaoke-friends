import { Server, type Connection } from "partyserver";
import type {
  ClientMessage,
  ServerMessage,
  Participant,
  Song,
  YouTubeSearchResult,
} from "@karaoke-friends/shared";
import { addSong, removeSong, reorderQueue, voteSong, sortByPriority } from "./queue";

interface ConnectionState {
  name: string;
}

const INITIAL_SEARCH_CREDITS = 50;

interface Env {
  ROOM: DurableObjectNamespace;
  YOUTUBE_API_KEY?: string;
}

export class Room extends Server<Env> {
  private djId: string | null = null;
  private queue: Song[] = [];
  private currentSongId: string | null = null;
  private history: Song[] = [];
  private searchCredits: number = INITIAL_SEARCH_CREDITS;

  private getName(conn: Connection<ConnectionState>): string {
    return conn.state?.name ?? "Anonymous";
  }

  private getParticipants(): Participant[] {
    return [...this.getConnections<ConnectionState>()].map((conn) => ({
      id: conn.id,
      name: this.getName(conn),
    }));
  }

  private broadcastMsg(msg: ServerMessage, exclude?: string) {
    const data = JSON.stringify(msg);
    for (const conn of this.getConnections()) {
      if (conn.id !== exclude) {
        conn.send(data);
      }
    }
  }

  private send(conn: Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private broadcastQueue(): void {
    this.broadcastMsg({
      type: "queue-updated",
      queue: this.queue,
      currentSongId: this.currentSongId,
      history: this.history,
    });
  }

  onConnect(conn: Connection<ConnectionState>) {
    // Wait for join message with name before adding to participants
  }

  onMessage(conn: Connection<ConnectionState>, message: string) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(message as string);
    } catch {
      this.send(conn, { type: "error", message: "Invalid message format" });
      return;
    }

    switch (msg.type) {
      case "join": {
        conn.setState({ name: msg.name });
        this.broadcastMsg(
          { type: "peer-joined", peer: { id: conn.id, name: msg.name } },
          conn.id,
        );
        this.send(conn, {
          type: "room-state",
          you: conn.id,
          participants: this.getParticipants(),
          djId: this.djId,
          queue: this.queue,
          currentSongId: this.currentSongId,
          history: this.history,
          searchCredits: this.searchCredits,
        });
        break;
      }

      case "signal": {
        const target = [...this.getConnections()].find(
          (c) => c.id === msg.to,
        );
        if (target) {
          this.send(target, {
            type: "signal",
            from: conn.id,
            data: msg.data,
          });
        }
        break;
      }

      case "take-mic": {
        if (this.djId && this.djId !== conn.id) {
          this.send(conn, {
            type: "error",
            message: "Someone else is already DJ",
          });
          return;
        }
        this.djId = conn.id;
        this.broadcastMsg({ type: "dj-changed", djId: this.djId });
        break;
      }

      case "drop-mic": {
        if (this.djId === conn.id) {
          this.djId = null;
          this.broadcastMsg({ type: "dj-changed", djId: null });
        }
        break;
      }

      case "queue-add": {
        const currentIdx = this.currentSongId
          ? this.queue.findIndex((s) => s.id === this.currentSongId)
          : -1;
        const upcoming =
          currentIdx >= 0 ? this.queue.slice(currentIdx + 1) : this.queue;
        if (upcoming.filter((s) => s.addedBy === conn.id).length >= 3) {
          this.send(conn, {
            type: "error",
            message: "Queue full — max 3 upcoming songs per person",
          });
          return;
        }
        this.queue = sortByPriority(
          addSong(this.queue, msg.song, conn.id, this.getName(conn)),
          this.currentSongId,
        );
        this.broadcastQueue();
        break;
      }

      case "queue-remove": {
        if (this.currentSongId === msg.id) {
          this.currentSongId = null;
        }
        this.queue = removeSong(this.queue, msg.id);
        this.broadcastQueue();
        break;
      }

      case "queue-reorder": {
        this.queue = reorderQueue(this.queue, msg.ids);
        this.broadcastQueue();
        break;
      }

      case "queue-set-current": {
        if (this.currentSongId && this.currentSongId !== msg.id) {
          const played = this.queue.find((s) => s.id === this.currentSongId);
          if (played) this.history.push(played);
        }
        this.currentSongId = msg.id;
        this.broadcastQueue();
        break;
      }

      case "queue-vote": {
        this.queue = sortByPriority(
          voteSong(this.queue, msg.id, conn.id),
          this.currentSongId,
        );
        this.broadcastQueue();
        break;
      }

      case "youtube-search": {
        this.handleYouTubeSearch(conn, msg.query);
        break;
      }
    }
  }

  private async handleYouTubeSearch(conn: Connection<ConnectionState>, query: string) {
    if (this.searchCredits <= 0) {
      this.send(conn, { type: "error", message: "No search credits remaining" });
      return;
    }

    const apiKey = this.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      this.send(conn, { type: "error", message: "YouTube search is not configured" });
      return;
    }

    const searchQuery = `${query} karaoke`;
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&maxResults=6&key=${apiKey}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        this.send(conn, { type: "error", message: "YouTube search failed" });
        return;
      }

      const data = await res.json() as {
        items?: Array<{
          id: { videoId: string };
          snippet: { title: string; thumbnails: { medium?: { url: string }; default?: { url: string } }; channelTitle: string };
        }>;
      };

      const results: YouTubeSearchResult[] = (data.items ?? []).map((item) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? "",
        channelTitle: item.snippet.channelTitle,
      }));

      this.searchCredits--;
      this.send(conn, { type: "youtube-search-results", results, creditsRemaining: this.searchCredits });
      this.broadcastMsg({ type: "credits-updated", searchCredits: this.searchCredits });
    } catch {
      this.send(conn, { type: "error", message: "YouTube search failed" });
    }
  }

  onClose(conn: Connection<ConnectionState>) {
    if (this.djId === conn.id) {
      this.djId = null;
      this.broadcastMsg({ type: "dj-changed", djId: null });
    }
    this.broadcastMsg({ type: "peer-left", peerId: conn.id });
  }
}
