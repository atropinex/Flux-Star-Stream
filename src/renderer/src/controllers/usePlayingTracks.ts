import { useEffect, useState } from 'react';
import type { PlaybackState, Playlist, Track } from '../models/types';
import { fetchPlaylistTracks } from '../models/libraryService';
import { indexOfTrack } from '../utils/trackIndex';

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
  const isCurrentPlaylistLoaded = Boolean(playlistId && loaded.key === playlistId && loaded.tracks.length > 0);
  const foundIndex = isCurrentPlaylistLoaded ? indexOfTrack(loaded.tracks, current?.uri) : -1;

  // Show the loaded playlist's songs even when the playing song is not among them (for example it is a different
  // version of the song). In that case no card is marked as playing, instead of wrongly marking the first one.
  const tracks = isCurrentPlaylistLoaded ? loaded.tracks : current ? [current] : [];
  const playingIndex = isCurrentPlaylistLoaded ? foundIndex : current ? 0 : -1;
  const listKey = isCurrentPlaylistLoaded ? loaded.key : `single:${current?.uri ?? ''}`;

  // Follow the playing song whenever it (or the list) changes.
  useEffect(() => setFocusIndex(Math.max(0, playingIndex)), [playingIndex, listKey]);

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
