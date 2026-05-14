# Queue System — Architecture & Design Decisions

> Documented 2026-05-12. Covers the song queue, round-robin fairness, per-user caps, and auto-advance.

## Overview

The queue is server-authoritative — all mutations happen in the Durable Object (`packages/party/src/room.ts`), which broadcasts the updated queue to all connected clients. Clients never modify the queue locally; they send `ClientMessage` commands and receive the canonical state back.

## Data Model

```typescript
interface Song {
  id: string;             // crypto.randomUUID(), assigned server-side
  title: string;
  url?: string;           // YouTube URL (only source for now)
  addedBy: string;        // peer ID of who added the song
  singerName?: string;    // display name of the adder (resolved server-side from connection state)
  durationSeconds?: number;
  votes: string[];        // array of peer IDs who voted for this song
  addedAt: number;        // Date.now() timestamp
}
```

The queue is a `Song[]`. The server also tracks:
- `currentSongId: string | null` — which song is currently playing
- `history: Song[]` — songs that were previously the `currentSongId` (pushed when currentSong changes)

## Round-Robin Fairness Algorithm

Pure vote-count ordering is gameable (one user adds 10 songs and self-votes). Instead, we use **round-robin by user** with votes as a tiebreaker within each user's songs.

### How It Works (`sortByPriority` + `sortRoundRobin`)

1. Split the queue into **played** (songs at or before `currentSongId`) and **upcoming** (after).
2. Played songs keep their order — they're history.
3. Upcoming songs are sorted via round-robin:
   - Group songs by `addedBy` (user)
   - Within each user's group, sort by votes desc, then `addedAt` asc
   - Interleave: take one song from each user in turn, repeat until all groups are empty

**Example**: Users A, B, C each add 2 songs. Result: A1, B1, C1, A2, B2, C2. If B1 has more votes than B2, B1 comes first within B's slot — but B never gets two slots before A or C get one.

### When Sorting Happens

Re-sort on every mutation that changes order:
- `queue-add` — new song enters the round-robin
- `queue-vote` — vote changes might reorder within a user's group

Manual `queue-reorder` (DJ drag-and-drop) overrides the algorithm entirely.

## Per-User Song Cap

- **Max 3 upcoming songs per user** (songs after `currentSongId`)
- Enforced server-side in the `queue-add` handler
- Played songs don't count against the cap
- The cap prevents queue-hogging in the IRL scenario where one person keeps adding songs

Client-side: SongQueue should show "Queue full (3/3)" when the user hits the cap. Currently not implemented — the server returns an error message.

## Auto-Advance

When a YouTube video ends:
1. YouTube IFrame Player API fires `onStateChange` with `ENDED` (0)
2. `useYouTubePlayer` hook calls `onVideoEnded()` callback
3. `RoomProvider.onVideoEnded()` checks `isDJ` — only the DJ triggers advance
4. Calls `nextSong()`, which sends `queue-set-current` with the next song's ID
5. Server updates `currentSongId`, pushes old song to history, broadcasts
6. `useYouTubePlayer` reacts to the new `videoId` and calls `loadVideoById()`

**DJ-only guard**: Only the DJ's browser triggers auto-advance. Listeners see the same video via the YouTube embed (each client has its own player instance playing the same video ID), but only the DJ's `onEnded` sends the server message. This prevents duplicate advances.

## Queue Messages (Client → Server)

| Message | Purpose |
|---------|---------|
| `queue-add` | Add a song (title, url?, durationSeconds?) |
| `queue-remove` | Remove a song by ID |
| `queue-reorder` | DJ manually reorders (array of IDs) |
| `queue-set-current` | Set which song is playing |
| `queue-vote` | Toggle vote on a song |

## Queue Messages (Server → Client)

| Message | Payload |
|---------|---------|
| `queue-updated` | `{ queue, currentSongId, history }` — broadcast on any mutation |
| `room-state` | Full state including queue, currentSongId, history — sent on join |

## Mobile / IRL Use Case

Two scenarios the queue supports:

1. **Browser karaoke** — everyone on laptops, DJ screen-shares YouTube tab
2. **Speaker + phone** — friends at a party, one phone/smart TV plays YouTube through external speaker, everyone else uses phones to manage the queue

For scenario 2:
- The queue UI is **mobile-first** (card layout, large tap targets for voting)
- Mobile layout uses **bottom tabs** (Watch / Queue) instead of sidebar
- The "DJ" is the phone/TV connected to the speaker
- Non-DJ participants primarily interact with the Queue tab

## History Tracking

When `queue-set-current` is called and there's an existing currentSong that differs from the new one, the old song is pushed to `this.history`. This gives us a play history for potential future features (play count, recently played, etc.).

History is broadcast alongside the queue on every update.

## Files

- `packages/shared/src/messages.ts` — Song, ClientMessage, ServerMessage types
- `packages/party/src/queue.ts` — Pure functions: addSong, removeSong, reorderQueue, voteSong, sortByPriority, sortRoundRobin
- `packages/party/src/room.ts` — Server-side queue state management (Durable Object)
- `apps/web/src/hooks/useRoomState.ts` — Client-side reducer for queue state
- `apps/web/src/components/room/SongQueue.tsx` — Queue UI component
- `apps/web/src/components/room/NowPlaying.tsx` — Currently playing banner
- `apps/web/src/components/room/RoomProvider.tsx` — Context with playSong, nextSong, onVideoEnded

## Known Issues / TODOs

- Song cap UI feedback: client should show "Queue full (3/3)" instead of only relying on server error
- singerName is set to the adder's name — no way to add a song "for someone else" yet
- Round-robin ordering doesn't persist the user order across sessions (Map iteration order is insertion order)
- No drag-and-drop reorder UI implemented yet (the `queue-reorder` message exists but no UI sends it)
- History is not displayed anywhere in the UI yet
