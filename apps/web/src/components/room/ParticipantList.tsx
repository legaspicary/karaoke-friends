"use client";

import { useRoom } from "./RoomProvider";

export function ParticipantList() {
  const { roomState } = useRoom();
  const { participants, djId } = roomState;
  const count = participants.length;

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white/90 font-semibold text-sm tracking-wide uppercase">
          In the room
        </h2>
        <span className="text-xs font-bold text-purple-400 bg-purple-400/10 rounded-full px-2.5 py-0.5">
          {count}
        </span>
      </div>

      {/* Participant list — aria-live so screen readers announce joins/leaves */}
      <div aria-live="polite" aria-label="Participants in the room">
        {count === 0 ? (
          <p className="text-white/60 text-sm text-center py-2">
            Just you for now…
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {participants.map((p) => {
              const isActiveDJ = p.id === djId;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors"
                >
                  {/* Connection dot */}
                  <span
                    className="flex-none w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                    aria-hidden="true"
                  />

                  {/* Name */}
                  <span className="flex-1 text-white/85 text-sm font-medium truncate">
                    {p.name}
                  </span>

                  {/* DJ mic icon */}
                  {isActiveDJ && (
                    <span
                      className="flex-none text-pink-400 text-base leading-none"
                      title="Current DJ"
                      aria-label="Current DJ"
                    >
                      🎤
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
