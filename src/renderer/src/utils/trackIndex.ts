/**
 * Where a song is in a list, found by its uri. -1 if it is not there (or nothing is playing).
 * Songs are compared by uri and not by id, because ids can differ between the places Spotify reports them.
 */
export function indexOfTrack(tracks: { uri: string }[], uri: string | null | undefined): number {
  if (!uri) return -1;
  return tracks.findIndex((track) => track.uri === uri);
}
