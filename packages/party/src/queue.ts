import type { Song } from "./messages";

export function addSong(
  queue: Song[],
  song: { title: string; url?: string },
  addedBy: string,
): Song[] {
  const id = crypto.randomUUID();
  return [...queue, { id, title: song.title, url: song.url, addedBy }];
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
