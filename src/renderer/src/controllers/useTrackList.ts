import { useEffect, useState } from 'react';
import type { Playlist, Track } from '../models/types';
import { fetchPlaylistTracks, searchTracks } from '../models/libraryService';
import { describeError } from '../models/spotifyApi';

const SEARCH_DELAY_MS = 400; // wait until the user stops typing

/** The songs shown in the carousel: search results when searching, otherwise the selected playlist. */
export function useTrackList(playlist: Playlist | undefined, query: string, onError: (message: string) => void, version = 0) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const search = query.trim();
  const playlistId = playlist?.id;

  useEffect(() => {
    if (!search && !playlistId) return setTracks([]);

    let isCancelled = false;
    setIsLoading(true);
    setHasFailed(false);

    const timer = setTimeout(() => {
      const request = search ? searchTracks(search) : fetchPlaylistTracks(playlistId!);
      request
        .then((loaded) => !isCancelled && setTracks(loaded))
        .catch((error) => {
          if (isCancelled) return;
          setTracks([]);
          setHasFailed(true);
          if (search) onError(describeError(error));
        })
        .finally(() => !isCancelled && setIsLoading(false));
    }, search ? SEARCH_DELAY_MS : 0);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [search, playlistId, onError, version]); // version changes when songs were added

  return { tracks, isLoading, hasFailed, isSearching: search !== '' };
}
