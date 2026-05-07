import { Server, type Connection } from "partyserver";
import type {
  ClientMessage,
  ServerMessage,
  Participant,
  Song,
} from "./messages";
import { addSong, removeSong, reorderQueue } from "./queue";

interface ConnectionState {
  name: string;
}

export class Room extends Server<{ ROOM: DurableObjectNamespace }> {
  private djId: string | null = null;
  private queue: Song[] = [];
  private currentSongId: string | null = null;

  private getName(conn: Connection<ConnectionState>): string {
    return conn.state?.name ?? "Anonymous";
  }

  private getParticipants(): Participant[] {
    return [...this.getConnections<ConnectionState>()].map((conn) => ({
      id: conn.id,
      name: this.getName(conn),
    }));
  }

  private broadcast(msg: ServerMessage, exclude?: string) {
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

  private broadcastQueue() {
    this.broadcast({
      type: "queue-updated",
      queue: this.queue,
      currentSongId: this.currentSongId,
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
        this.broadcast(
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
        this.broadcast({ type: "dj-changed", djId: this.djId });
        break;
      }

      case "drop-mic": {
        if (this.djId === conn.id) {
          this.djId = null;
          this.broadcast({ type: "dj-changed", djId: null });
        }
        break;
      }

      case "queue-add": {
        this.queue = addSong(this.queue, msg.song, conn.id);
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
        this.currentSongId = msg.id;
        this.broadcastQueue();
        break;
      }
    }
  }

  onClose(conn: Connection<ConnectionState>) {
    if (this.djId === conn.id) {
      this.djId = null;
      this.broadcast({ type: "dj-changed", djId: null });
    }
    this.broadcast({ type: "peer-left", peerId: conn.id });
  }
}
