"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  SignalingClient,
  type SignalingEventMap,
} from "@/lib/signaling/client";
import type { ClientMessage, ServerMessage } from "@/lib/signaling/messages";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "failed";

export interface UseSignalingReturn {
  client: SignalingClient | null;
  connectionStatus: ConnectionStatus;
  send: (msg: ClientMessage) => void;
  join: () => void;
  on: <K extends keyof SignalingEventMap>(
    event: K,
    listener: (payload: SignalingEventMap[K]) => void
  ) => void;
  off: <K extends keyof SignalingEventMap>(
    event: K,
    listener: (payload: SignalingEventMap[K]) => void
  ) => void;
}

export function useSignaling(
  roomCode: string,
  workerUrl: string,
  playerName: string
): UseSignalingReturn {
  const clientRef = useRef<SignalingClient | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");

  useEffect(() => {
    if (!roomCode || !workerUrl || !playerName) return;

    const client = new SignalingClient(roomCode, workerUrl, playerName);
    clientRef.current = client;

    const handleOpen = () => setConnectionStatus("connected");
    const handleClose = () => setConnectionStatus("disconnected");
    const handleError = () => setConnectionStatus("disconnected");
    const handleFailed = () => setConnectionStatus("failed");

    client.on("open", handleOpen);
    client.on("close", handleClose);
    client.on("error", handleError);
    client.on("failed", handleFailed);

    return () => {
      client.off("open", handleOpen);
      client.off("close", handleClose);
      client.off("error", handleError);
      client.off("failed", handleFailed);
      client.destroy();
      clientRef.current = null;
    };
  }, [roomCode, workerUrl, playerName]);

  const send = useCallback((msg: ClientMessage) => {
    clientRef.current?.send(msg);
  }, []);

  const join = useCallback(() => {
    clientRef.current?.join();
  }, []);

  const on = useCallback(
    <K extends keyof SignalingEventMap>(
      event: K,
      listener: (payload: SignalingEventMap[K]) => void
    ) => {
      clientRef.current?.on(event, listener);
    },
    []
  );

  const off = useCallback(
    <K extends keyof SignalingEventMap>(
      event: K,
      listener: (payload: SignalingEventMap[K]) => void
    ) => {
      clientRef.current?.off(event, listener);
    },
    []
  );

  return {
    client: clientRef.current,
    connectionStatus,
    send,
    join,
    on,
    off,
  };
}

// Convenience: subscribe to all incoming server messages
export function useSignalingMessages(
  client: SignalingClient | null,
  handler: (msg: ServerMessage) => void
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!client) return;
    const listener = (msg: ServerMessage) => handlerRef.current(msg);
    client.on("message", listener);
    return () => client.off("message", listener);
  }, [client]);
}
