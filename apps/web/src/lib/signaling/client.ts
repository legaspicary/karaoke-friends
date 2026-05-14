import type { ClientMessage, ServerMessage } from "@karaoke-friends/shared";

export type SignalingEventMap = {
  message: ServerMessage;
  open: void;
  close: void;
  error: Event;
  /** Fired when max reconnect attempts are exhausted — room likely doesn't exist */
  failed: void;
};

type EventListener<T> = (payload: T) => void;

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private hasJoined = false;

  private readonly roomCode: string;
  private readonly workerUrl: string;
  private readonly playerName: string;

  // Typed event listener store
  private listeners: {
    [K in keyof SignalingEventMap]?: Set<EventListener<SignalingEventMap[K]>>;
  } = {};

  constructor(roomCode: string, workerUrl: string, playerName: string) {
    this.roomCode = roomCode;
    this.workerUrl = workerUrl;
    this.playerName = playerName;
    this.connect();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  join(): void {
    this.hasJoined = true;
    this.send({ type: "join", name: this.playerName });
  }

  on<K extends keyof SignalingEventMap>(
    event: K,
    listener: EventListener<SignalingEventMap[K]>
  ): void {
    if (!this.listeners[event]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.listeners as any)[event] = new Set();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((this.listeners as any)[event] as Set<EventListener<SignalingEventMap[K]>>).add(listener);
  }

  off<K extends keyof SignalingEventMap>(
    event: K,
    listener: EventListener<SignalingEventMap[K]>
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((this.listeners as any)[event] as Set<EventListener<SignalingEventMap[K]>> | undefined)?.delete(listener);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
    this.listeners = {};
  }

  // ---------------------------------------------------------------------------
  // Connection management
  // ---------------------------------------------------------------------------

  private buildUrl(): string {
    // Normalize: strip trailing slash, then append path
    const base = this.workerUrl.replace(/\/$/, "");
    // The partyserver convention is /parties/room/<roomCode>
    // We swap the scheme to ws/wss to match the WebSocket protocol.
    const url = `${base}/parties/room/${this.roomCode}`;
    // Replace http/https with ws/wss so callers can pass an https:// base URL.
    return url.replace(/^http/, "ws");
  }

  private connect(): void {
    if (this.destroyed) return;

    const url = this.buildUrl();
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      if (this.destroyed) {
        ws.close();
        return;
      }
      this.reconnectAttempts = 0;
      if (this.hasJoined) {
        this.send({ type: "join", name: this.playerName });
      }
      this.emit("open", undefined as void);
    };

    ws.onmessage = (ev: MessageEvent) => {
      if (this.destroyed) return;
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data as string) as ServerMessage;
      } catch {
        console.warn("[SignalingClient] Received non-JSON message", ev.data);
        return;
      }
      this.emit("message", msg);
    };

    ws.onclose = () => {
      if (this.destroyed) return;
      this.emit("close", undefined as void);
      this.scheduleReconnect();
    };

    ws.onerror = (ev: Event) => {
      if (this.destroyed) return;
      this.emit("error", ev);
      // onclose will fire after onerror — reconnect is handled there
    };
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(
        "[SignalingClient] Max reconnect attempts reached. Giving up."
      );
      this.emit("failed", undefined as void);
      return;
    }

    const delay = Math.min(
      BASE_BACKOFF_MS * Math.pow(2, this.reconnectAttempts),
      MAX_BACKOFF_MS
    );
    this.reconnectAttempts++;
    console.info(
      `[SignalingClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  // ---------------------------------------------------------------------------
  // Internal event emitter
  // ---------------------------------------------------------------------------

  private emit<K extends keyof SignalingEventMap>(
    event: K,
    payload: SignalingEventMap[K]
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const set = (this.listeners as any)[event] as
      | Set<EventListener<SignalingEventMap[K]>>
      | undefined;
    if (!set) return;
    for (const listener of set) {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[SignalingClient] Error in "${event}" listener`, err);
      }
    }
  }
}
