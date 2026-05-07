"use client";

import { useRoom } from "@/components/room/RoomProvider";
import type { ConnectionStatus as ConnectionStatusType } from "@/hooks/useSignaling";

const statusConfig: Record<
  ConnectionStatusType,
  { label: string; dotClass: string; textClass: string }
> = {
  connecting: {
    label: "Connecting…",
    dotClass: "bg-amber-400 animate-pulse",
    textClass: "text-amber-400/80",
  },
  connected: {
    label: "Connected",
    dotClass: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]",
    textClass: "text-emerald-300",
  },
  disconnected: {
    label: "Disconnected",
    dotClass: "bg-red-500",
    textClass: "text-red-300",
  },
  failed: {
    label: "Connection failed",
    dotClass: "bg-red-600",
    textClass: "text-red-300",
  },
};

export function ConnectionStatus() {
  const { connectionStatus } = useRoom();
  const config = statusConfig[connectionStatus];

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full flex-none ${config.dotClass}`} />
      <span className={`text-xs font-medium ${config.textClass}`}>
        {config.label}
      </span>
    </div>
  );
}
