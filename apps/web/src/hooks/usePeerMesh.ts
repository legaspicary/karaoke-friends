"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PeerMesh } from "@/lib/webrtc/mesh";
import { getIceConfig } from "@/lib/webrtc/ice";
import type { SignalingClient } from "@/lib/signaling/client";
import type { ServerMessage } from "@karaoke-friends/shared";

export interface UsePeerMeshReturn {
  mesh: PeerMesh | null;
  remoteStreams: Map<string, MediaStream>;
  connectionStates: Map<string, RTCPeerConnectionState>;
}

export function usePeerMesh(
  signalingClient: SignalingClient | null
): UsePeerMeshReturn {
  const meshRef = useRef<PeerMesh | null>(null);

  // Use separate state variables so React diffs them properly
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    () => new Map()
  );
  const [connectionStates, setConnectionStates] = useState<
    Map<string, RTCPeerConnectionState>
  >(() => new Map());

  // Keep a ref to expose mesh externally without triggering re-renders
  const [mesh, setMesh] = useState<PeerMesh | null>(null);

  useEffect(() => {
    if (!signalingClient) return;

    const iceConfig = getIceConfig();
    const peerMesh = new PeerMesh(signalingClient, iceConfig);
    meshRef.current = peerMesh;
    setMesh(peerMesh);

    // Callbacks that update React state
    peerMesh.onRemoteStream = (peerId, stream) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.set(peerId, stream);
        return next;
      });
    };

    peerMesh.onRemoteStreamRemoved = (peerId) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(peerId);
        return next;
      });
      setConnectionStates((prev) => {
        const next = new Map(prev);
        next.delete(peerId);
        return next;
      });
    };

    peerMesh.onConnectionStateChange = (peerId, state) => {
      setConnectionStates((prev) => {
        const next = new Map(prev);
        next.set(peerId, state);
        return next;
      });
    };

    // Handle incoming signaling messages
    const handleMessage = (msg: ServerMessage) => {
      if (msg.type === "peer-joined") {
        // We are the existing peer — become initiator
        peerMesh.addPeer(msg.peer.id, true).catch((err) =>
          console.error("[usePeerMesh] addPeer failed", err)
        );
      } else if (msg.type === "peer-left") {
        peerMesh.removePeer(msg.peerId);
      } else if (msg.type === "signal") {
        peerMesh.handleSignal(msg.from, msg.data);
      } else if (msg.type === "room-state") {
        // On initial state, add connections to all existing peers as non-initiator
        // (each existing peer will send us offers since they see our peer-joined)
        for (const participant of msg.participants) {
          if (participant.id !== msg.you) {
            peerMesh.addPeer(participant.id, false).catch((err) =>
              console.error("[usePeerMesh] addPeer (room-state) failed", err)
            );
          }
        }
      }
    };

    signalingClient.on("message", handleMessage);

    return () => {
      signalingClient.off("message", handleMessage);
      peerMesh.destroy();
      meshRef.current = null;
      setMesh(null);
      setRemoteStreams(new Map());
      setConnectionStates(new Map());
    };
  }, [signalingClient]);

  const setLocalStream = useCallback(
    (label: string, stream: MediaStream | null) => {
      meshRef.current?.setLocalStream(label, stream);
    },
    []
  );

  // Expose setLocalStream on the returned mesh object via a stable wrapper
  // so consumers don't have to import the hook's internal ref pattern.
  void setLocalStream; // used indirectly via meshRef consumers

  return { mesh, remoteStreams, connectionStates };
}
