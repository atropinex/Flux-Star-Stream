import { useEffect, useState } from 'react';
import type { PlaybackState, Playlist, Track } from '../models/types';
import { fetchPlaylistTracks } from '../models/libraryService';

const PLAYLIST_PREFIX = 'spotify:playlist:';

/**
 * The songs of the playlist that is playing right now. This is separate from the playlist you are previewing.
 * You can scroll through it freely. It jumps back to the playing song whenever the song changes.
 * When the songs cannot be loaded (an album, search results, a playlist you don't own), it shows just the current song.
 */
export function usePlayingTracks(playback: PlaybackState | null, playlists: Playlist[], version: number) {
  const contextUri = playback?.contextUri ?? null;
  const playlistId = contextUri?.startsWith(PLAYLIST_PREFIX) ? contextUri.slice(PLAYLIST_PREFIX.length) : null;

  const [loaded, setLoaded] = useState<{ key: string; tracks: Track[] }>({ key: '', tracks: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0); // the card in the middle, which you can scroll

  useEffect(() => {
    if (!playlistId) return setLoaded({ key: contextUri ?? 'none', tracks: [] });

    let isCancelled = false;
    setIsLoading(true);
    fetchPlaylistTracks(playlistId)
      .then((tracks) => !isCancelled && setLoaded({ key: playlistId, tracks }))
      .catch(() => !isCancelled && setLoaded({ key: playlistId, tracks: [] }))
      .finally(() => !isCancelled && setIsLoading(false));

    return () => {
      isCancelled = true;
    };
  }, [playlistId, contextUri, version]);

  const current = playback?.track;
  const foundIndex = current ? loaded.tracks.findIndex((track) => track.id === current.id) : -1;
  const isFullList = foundIndex >= 0;

  const tracks = isFullList ? loaded.tracks : current ? [current] : [];
  const playingIndex = isFullList ? foundIndex : 0;
  const listKey = isFullList ? loaded.key : `single:${current?.id ?? ''}`;

  // Follow the playing song whenever it (or the list) changes.
  useEffect(() => setFocusIndex(playingIndex), [playingIndex, listKey]);

  const clamp = (index: number) => Math.max(0, Math.min(tracks.length - 1, index));

  return {
    contextUri,
    isLoading,
    tracks,
    listKey,
    playingIndex,
    focusIndex: clamp(focusIndex),
    select: (index: number) => setFocusIndex(clamp(index)),
    move: (step: number) => setFocusIndex((current) => clamp(current + step)),
    heading: playlists.find((playlist) => playlist.uri === contextUri)?.name ?? 'Now playing'
  };
}
