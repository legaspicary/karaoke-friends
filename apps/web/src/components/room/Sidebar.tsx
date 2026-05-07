"use client";

import { MixerPanel } from "./MixerPanel";
import { SongQueue } from "./SongQueue";
import { EffectsPanel } from "./EffectsPanel";

export function Sidebar() {
  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto">
      <MixerPanel />
      <SongQueue />
      <EffectsPanel />
    </div>
  );
}
