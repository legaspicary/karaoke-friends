"use client";

import { ParticipantList } from "./ParticipantList";
import { SongQueue } from "./SongQueue";
import { EffectsPanel } from "./EffectsPanel";

export function Sidebar() {
  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto">
      <ParticipantList />
      <SongQueue />
      <EffectsPanel />
    </div>
  );
}
