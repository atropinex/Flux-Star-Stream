import { useEffect, useState } from 'react';
import type { Playlist, Track } from '../models/types';
import { addTracksToPlaylist, createPlaylist, fetchCurrentUserId, fetchPlaylists } from '../models/libraryService';
import { describeError } from '../models/spotifyApi';

/** The user's playlists, which one is in the middle of the row, and creating / adding songs to playlists. */
export function usePlaylists(enabled: boolean, notify: (message: string) => void) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // goes up when songs are added, so the song list reloads

  useEffect(() => {
    if (!enabled) return;
    Promise.all([fetchPlaylists(), fetchCurrentUserId()])
      .then(([loaded, id]) => {
        setPlaylists(loaded);
        setUserId(id);
        setSelectedIndex(0);
      })
      .catch((error) => notify(describeError(error)));
  }, [enabled, notify]);

  const clamp = (index: number) => Math.max(0, Math.min(playlists.length - 1, index));

  // Spotify only lets you change playlists you own or collaborate on.
  const editable = playlists.filter((playlist) => playlist.collaborative || (userId !== null && playlist.owner?.id === userId));

  /** Creates a playlist (optionally with its first song) and selects it. Returns false if it failed. */
  async function create(name: string, firstTrackUri?: string): Promise<boolean> {
    try {
      const created = await createPlaylist(name);
      if (firstTrackUri) {
        await addTracksToPlaylist(created.id, [firstTrackUri]);
        created.items = { total: 1 };
      }
      setPlaylists((current) => [created, ...current]); // new playlists appear first in Spotify
      setSelectedIndex(0);
      notify(`Created “${name}”`);
      return true;
    } catch (error) {
      notify(describeError(error));
      return false;
    }
  }

  /** Adds a song to a playlist. Returns false if it failed. */
  async function addTrack(playlist: Playlist, track: Track): Promise<boolean> {
    try {
      await addTracksToPlaylist(playlist.id, [track.uri]);
      const total = (playlist.items?.total ?? playlist.tracks?.total ?? 0) + 1;
      setPlaylists((current) => current.map((p) => (p.id === playlist.id ? { ...p, items: { total } } : p)));
      setVersion((current) => current + 1);
      notify(`Added to “${playlist.name}”`);
      return true;
    } catch (error) {
      notify(describeError(error));
      return false;
    }
  }

  return {
    playlists,
    editable,
    version,
    selectedIndex: clamp(selectedIndex),
    selected: playlists[clamp(selectedIndex)],
    select: (index: number) => setSelectedIndex(clamp(index)),
    move: (step: number) => setSelectedIndex((current) => clamp(current + step)),
    create,
    addTrack
  };
}
