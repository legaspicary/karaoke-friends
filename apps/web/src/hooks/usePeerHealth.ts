"use client";

import { useEffect, useRef, useState } from "react";
import type { PeerMesh, PeerHealthSnapshot } from "@/lib/webrtc/mesh";

export type PeerQuality = "good" | "degraded" | "poor" | "disconnected" | "connecting";

export interface PeerHealthInfo {
  quality: PeerQuality;
  rttMs: number | null;
  packetLossPercent: number;
  dataFlowing: boolean;
}

const POLL_INTERVAL_MS = 3000;

export function usePeerHealth(
  mesh: PeerMesh | null
): Map<string, PeerHealthInfo> {
  const [health, setHealth] = useState<Map<string, PeerHealthInfo>>(
    () => new Map()
  );
  const prevBytesRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!mesh) return;

    let active = true;

    async function poll() {
      if (!active || !mesh) return;

      try {
        const snapshots = await mesh.getPeerHealthMap();
        const prevBytes = prevBytesRef.current;
        const nextBytes = new Map<string, number>();
        const result = new Map<string, PeerHealthInfo>();

        for (const [peerId, snap] of snapshots) {
          nextBytes.set(peerId, snap.bytesReceived);
          const prev = prevBytes.get(peerId) ?? 0;
          const dataFlowing = snap.bytesReceived > prev;
          const info = classify(snap, dataFlowing);
          result.set(peerId, info);
        }

        prevBytesRef.current = nextBytes;
        if (active) setHealth(result);
      } catch {
        // mesh may have been destroyed
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [mesh]);

  return health;
}

function classify(
  snap: PeerHealthSnapshot,
  dataFlowing: boolean
): PeerHealthInfo {
  const { connectionState, rttMs, packetsReceived, packetsLost } = snap;
  const totalPackets = packetsReceived + packetsLost;
  const packetLossPercent =
    totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0;

  let quality: PeerQuality;

  if (
    connectionState === "failed" ||
    connectionState === "closed"
  ) {
    quality = "disconnected";
  } else if (
    connectionState === "new" ||
    connectionState === "connecting"
  ) {
    quality = "connecting";
  } else if (connectionState === "disconnected") {
    quality = "poor";
  } else {
    // "connected" — check actual data flow
    if (!dataFlowing && totalPackets > 0) {
      quality = "poor";
    } else if (
      (rttMs !== null && rttMs > 500) ||
      packetLossPercent > 5
    ) {
      quality = "degraded";
    } else {
      quality = "good";
    }
  }

  return { quality, rttMs, packetLossPercent, dataFlowing };
}
