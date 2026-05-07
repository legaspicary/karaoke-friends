"use client";

import { useEffect, useReducer, useCallback } from "react";
import type { SignalingClient } from "@/lib/signaling/client";
import type {
  Participant,
  Song,
  ServerMessage,
  ClientMessage,
} from "@/lib/signaling/messages";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface RoomState {
  myPeerId: string | null;
  participants: Participant[];
  djId: string | null;
  queue: Song[];
  currentSongId: string | null;
}

const initialState: RoomState = {
  myPeerId: null,
  participants: [],
  djId: null,
  queue: [],
  currentSongId: null,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type Action =
  | { type: "ROOM_STATE"; payload: Omit<RoomState, never> }
  | { type: "PEER_JOINED"; peer: Participant }
  | { type: "PEER_LEFT"; peerId: string }
  | { type: "DJ_CHANGED"; djId: string | null }
  | { type: "QUEUE_UPDATED"; queue: Song[]; currentSongId: string | null };

function reducer(state: RoomState, action: Action): RoomState {
  switch (action.type) {
    case "ROOM_STATE":
      return { ...state, ...action.payload };

    case "PEER_JOINED":
      if (state.participants.some((p) => p.id === action.peer.id)) {
        return state;
      }
      return {
        ...state,
        participants: [...state.participants, action.peer],
      };

    case "PEER_LEFT":
      return {
        ...state,
        participants: state.participants.filter(
          (p) => p.id !== action.peerId
        ),
        djId: state.djId === action.peerId ? null : state.djId,
      };

    case "DJ_CHANGED":
      return { ...state, djId: action.djId };

    case "QUEUE_UPDATED":
      return {
        ...state,
        queue: action.queue,
        currentSongId: action.currentSongId,
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseRoomStateReturn {
  roomState: RoomState;

  // Actions — these send messages to the signaling server
  takeMic: () => void;
  dropMic: () => void;
  addSong: (song: { title: string; url?: string }) => void;
  removeSong: (id: string) => void;
  reorderQueue: (ids: string[]) => void;
  setCurrentSong: (id: string | null) => void;
}

export function useRoomState(
  signalingClient: SignalingClient | null
): UseRoomStateReturn {
  const [roomState, dispatch] = useReducer(reducer, initialState);

  // Subscribe to incoming messages from the signaling server
  useEffect(() => {
    if (!signalingClient) return;

    const handleMessage = (msg: ServerMessage) => {
      switch (msg.type) {
        case "room-state":
          dispatch({
            type: "ROOM_STATE",
            payload: {
              myPeerId: msg.you,
              participants: msg.participants,
              djId: msg.djId,
              queue: msg.queue,
              currentSongId: msg.currentSongId,
            },
          });
          break;

        case "peer-joined":
          dispatch({ type: "PEER_JOINED", peer: msg.peer });
          break;

        case "peer-left":
          dispatch({ type: "PEER_LEFT", peerId: msg.peerId });
          break;

        case "dj-changed":
          dispatch({ type: "DJ_CHANGED", djId: msg.djId });
          break;

        case "queue-updated":
          dispatch({
            type: "QUEUE_UPDATED",
            queue: msg.queue,
            currentSongId: msg.currentSongId,
          });
          break;

        default:
          // signal, error — handled elsewhere
          break;
      }
    };

    signalingClient.on("message", handleMessage);
    return () => signalingClient.off("message", handleMessage);
  }, [signalingClient]);

  // ---------------------------------------------------------------------------
  // Action creators
  // ---------------------------------------------------------------------------

  const send = useCallback(
    (msg: ClientMessage) => signalingClient?.send(msg),
    [signalingClient]
  );

  const takeMic = useCallback(() => send({ type: "take-mic" }), [send]);
  const dropMic = useCallback(() => send({ type: "drop-mic" }), [send]);

  const addSong = useCallback(
    (song: { title: string; url?: string }) =>
      send({ type: "queue-add", song }),
    [send]
  );

  const removeSong = useCallback(
    (id: string) => send({ type: "queue-remove", id }),
    [send]
  );

  const reorderQueue = useCallback(
    (ids: string[]) => send({ type: "queue-reorder", ids }),
    [send]
  );

  const setCurrentSong = useCallback(
    (id: string | null) => send({ type: "queue-set-current", id }),
    [send]
  );

  return {
    roomState,
    takeMic,
    dropMic,
    addSong,
    removeSong,
    reorderQueue,
    setCurrentSong,
  };
}
