import type { Playlist, Track } from './types';
import { bridge, spotifyRequest } from './spotifyApi';

const MAX_PLAYLISTS = 200;
const MAX_TRACKS = 100;
const SEARCH_LIMIT = 10; // Spotify allows at most 10 search results per request

interface Page<T> {
  items?: T[];
  next?: string | null;
  // Some Spotify client builds wrap the Web API payload in a data property.
  data?: { items?: T[]; next?: string | null };
}

interface PlaylistEntry {
  item?: Track | null;
  track?: Track | null;
}

function pageItems<T>(page: Page<T> | null): T[] {
  return page?.items ?? page?.data?.items ?? [];
}

function nextPage(page: Page<unknown> | null): string | null {
  return page?.next ?? page?.data?.next ?? null;
}

/** Loads the user's playlists, following Spotify's pages until we have enough. */
export async function fetchPlaylists(): Promise<Playlist[]> {
  const playlists: Playlist[] = [];
  const clientPlaylists = await bridge('libraryPlaylists') as Playlist[] | null;
  if (clientPlaylists?.length) return clientPlaylists.slice(0, MAX_PLAYLISTS);

  let url: string | null = '/me/playlists?limit=50';

  while (url && playlists.length < MAX_PLAYLISTS) {
    const page = await spotifyRequest<Page<Playlist | null>>(url);
    if (!page) break;

    playlists.push(...pageItems(page).filter((item): item is Playlist => item !== null));
    url = nextPage(page);
  }
  return playlists;
}

/** Loads the songs of one playlist. Spotify only allows this for playlists you own or collaborate on. */
export async function fetchPlaylistTracks(playlistId: string): Promise<Track[]> {
  const tracks: Track[] = [];
  const clientTracks = await bridge('playlistTracks', { id: playlistId }) as Track[] | null;
  if (clientTracks) return clientTracks.slice(0, MAX_TRACKS);

  let url: string | null = `/playlists/${playlistId}/items?limit=50`;

  while (url && tracks.length < MAX_TRACKS) {
    const page = await spotifyRequest<Page<PlaylistEntry>>(url);
    if (!page) break;

    for (const entry of pageItems(page)) {
      const track = entry.item ?? entry.track;
      if (track && track.type === 'track' && !track.is_local) tracks.push(track);
    }
    url = nextPage(page);
  }
  return tracks;
}

export async function searchTracks(query: string): Promise<Track[]> {
  const clientTracks = await bridge('searchTracks', { query, limit: SEARCH_LIMIT }) as Track[] | null;
  if (clientTracks) return clientTracks;
  const data = await spotifyRequest<{ tracks?: Page<Track>; data?: { tracks?: Page<Track> } }>(
    `/search?q=${encodeURIComponent(query)}&type=track&limit=${SEARCH_LIMIT}`
  );
  return data?.tracks?.items ?? data?.tracks?.data?.items ?? data?.data?.tracks?.items ?? [];
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
