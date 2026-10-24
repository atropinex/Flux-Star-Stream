import { useEffect, useState } from 'react';
import type { Playlist, Track } from '../models/types';
import { fetchPlaylistTracks, searchTracks } from '../models/libraryService';
import { describeError } from '../models/spotifyApi';

const SEARCH_DELAY_MS = 400;   // wait until the user stops typing
const PLAYLIST_DELAY_MS = 220; // wait until the user stops scrolling through the playlists
const CACHE_LIMIT = 40;

// Songs that were already loaded, so coming back to a playlist is instant. Cleared when songs are added.
const cache = new Map<string, Track[]>();
let cacheVersion = 0;

function remember(playlistId: string, tracks: Track[]): void {
  cache.delete(playlistId);
  cache.set(playlistId, tracks);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string); // forget the oldest
}

/**
 * The songs shown in the browse row: search results when searching, otherwise the selected playlist.
 * `listKey` changes exactly when a new list arrives, which is what triggers the entrance animation.
 *
 * Scrolling quickly through playlists would otherwise load the songs of every playlist you pass, and rebuild
 * the whole row each time. So nothing is loaded until you stop for a moment.
 */
export function useTrackList(playlist: Playlist | undefined, query: string, onError: (message: string) => void, version = 0) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [listKey, setListKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const search = query.trim();
  const playlistId = playlist?.id;

  useEffect(() => {
    if (version !== cacheVersion) {
      cache.clear();
      cacheVersion = version;
    }
    if (!search && !playlistId) return setTracks([]);

    const key = search ? `search:${search}` : `playlist:${playlistId}`;
    let isCancelled = false;
    if (search) setIsLoading(true); // typing shows "Loading…" right away

    const timer = setTimeout(() => {
      const cached = !search && playlistId ? cache.get(playlistId) : undefined;
      if (cached) {
        setTracks(cached);
        setListKey(key);
        setIsLoading(false);
        setHasFailed(false);
        return;
      }

      setIsLoading(true);
      setHasFailed(false);
      const request = search ? searchTracks(search) : fetchPlaylistTracks(playlistId!);
      request
        .then((loaded) => {
          if (isCancelled) return;
          if (!search) remember(playlistId!, loaded);
          setTracks(loaded);
          setListKey(key);
        })
        .catch((error) => {
          if (isCancelled) return;
          setTracks([]);
          setListKey(key);
          setHasFailed(true);
          onError(describeError(error));
        })
        .finally(() => !isCancelled && setIsLoading(false));
    }, search ? SEARCH_DELAY_MS : PLAYLIST_DELAY_MS);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [search, playlistId, onError, version]); // version changes when songs were added

  return { tracks, listKey, isLoading, hasFailed, isSearching: search !== '' };
}
