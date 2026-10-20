import type { Playlist, Track } from './types';
import { spotifyRequest } from './spotifyApi';

const MAX_PLAYLISTS = 200;
const MAX_TRACKS = 100;
const SEARCH_LIMIT = 10; // Spotify allows at most 10 search results per request

interface Page<T> {
  items: T[];
  next: string | null;
}

// Playlist entries hold the track in `item` (since February 2026) or `track` (before).
interface PlaylistEntry {
  item?: Track | null;
  track?: Track | null;
}

/** Loads the user's playlists, following Spotify's pages until we have enough. */
export async function fetchPlaylists(): Promise<Playlist[]> {
  const playlists: Playlist[] = [];
  let url: string | null = '/me/playlists?limit=50';

  while (url && playlists.length < MAX_PLAYLISTS) {
    const page: Page<Playlist | null> | null = await spotifyRequest<Page<Playlist | null>>(url);
    if (!page) break;

    playlists.push(...page.items.filter((item): item is Playlist => item !== null));
    url = page.next;
  }
  return playlists;
}

/** Loads the songs of one playlist. Spotify only allows this for playlists you own or collaborate on. */
export async function fetchPlaylistTracks(playlistId: string): Promise<Track[]> {
  const tracks: Track[] = [];
  let url: string | null = `/playlists/${playlistId}/items?limit=50`;

  while (url && tracks.length < MAX_TRACKS) {
    const page: Page<PlaylistEntry> | null = await spotifyRequest<Page<PlaylistEntry>>(url);
    if (!page) break;

    for (const entry of page.items) {
      const track = entry.item ?? entry.track;
      if (track && track.type === 'track' && !track.is_local) tracks.push(track);
    }
    url = page.next;
  }
  return tracks;
}

export async function searchTracks(query: string): Promise<Track[]> {
  const data = await spotifyRequest<{ tracks: Page<Track> }>(
    `/search?q=${encodeURIComponent(query)}&type=track&limit=${SEARCH_LIMIT}`
  );
  return data?.tracks.items ?? [];
}

/** The id of the logged-in user, used to know which playlists can be edited. */
export async function fetchCurrentUserId(): Promise<string | null> {
  try {
    const me = await spotifyRequest<{ id: string }>('/me');
    return me?.id ?? null;
  } catch {
    return null;
  }
}

/** Creates an empty private playlist. */
export async function createPlaylist(name: string): Promise<Playlist> {
  const playlist = await spotifyRequest<Playlist>('/me/playlists', 'POST', { name, public: false });
  if (!playlist) throw new Error('Spotify did not create the playlist.');
  return playlist;
}

export async function addTracksToPlaylist(playlistId: string, uris: string[]): Promise<void> {
  await spotifyRequest(`/playlists/${playlistId}/items`, 'POST', { uris });
}
