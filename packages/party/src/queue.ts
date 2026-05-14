import type { Song } from "@karaoke-friends/shared";

export function addSong(
  queue: Song[],
  song: { title: string; url?: string; thumbnail?: string; durationSeconds?: number },
  addedBy: string,
  singerName?: string,
): Song[] {
  const id = crypto.randomUUID();
  return [
    ...queue,
    {
      id,
      title: song.title,
      url: song.url,
      thumbnail: song.thumbnail,
      addedBy,
      singerName,
      durationSeconds: song.durationSeconds,
      votes: [],
      addedAt: Date.now(),
    },
  ];
}

export function removeSong(queue: Song[], id: string): Song[] {
  return queue.filter((s) => s.id !== id);
}

export function reorderQueue(queue: Song[], orderedIds: string[]): Song[] {
  const byId = new Map(queue.map((s) => [s.id, s]));
  const reordered: Song[] = [];
  for (const id of orderedIds) {
    const song = byId.get(id);
    if (song) reordered.push(song);
  }
  return reordered;
}

export function voteSong(queue: Song[], songId: string, peerId: string): Song[] {
  return queue.map((s) => {
    if (s.id !== songId) return s;
    const hasVoted = s.votes.includes(peerId);
    return {
      ...s,
      votes: hasVoted
        ? s.votes.filter((v) => v !== peerId)
        : [...s.votes, peerId],
    };
  });
}

export function sortByPriority(queue: Song[], currentSongId: string | null): Song[] {
  const currentIdx = currentSongId
    ? queue.findIndex((s) => s.id === currentSongId)
    : -1;

  const played = currentIdx >= 0 ? queue.slice(0, currentIdx + 1) : [];
  const upcoming = currentIdx >= 0 ? queue.slice(currentIdx + 1) : [...queue];

  return [...played, ...sortRoundRobin(upcoming)];
}

function sortRoundRobin(songs: Song[]): Song[] {
  const byUser = new Map<string, Song[]>();
  for (const song of songs) {
    const group = byUser.get(song.addedBy) ?? [];
    group.push(song);
    byUser.set(song.addedBy, group);
  }

  for (const group of byUser.values()) {
    group.sort((a, b) => {
      const vd = b.votes.length - a.votes.length;
      if (vd !== 0) return vd;
      return a.addedAt - b.addedAt;
    });
  }

  const result: Song[] = [];
  const userQueues = Array.from(byUser.values());
  while (userQueues.some((q) => q.length > 0)) {
    for (const group of userQueues) {
      const next = group.shift();
      if (next) result.push(next);
    }
  }
  return result;
}
