import { useEffect, useRef, useState } from 'react';
import { useAuth } from './controllers/useAuth';
import { useCarouselInput } from './controllers/useCarouselInput';
import { useOverlayVisible } from './controllers/useOverlayVisible';
import { usePlaylists } from './controllers/usePlaylists';
import { usePlayback } from './controllers/usePlayback';
import { usePlayingTracks } from './controllers/usePlayingTracks';
import { useProgress } from './controllers/useProgress';
import { useSelection } from './controllers/useSelection';
import { useSettings } from './controllers/useSettings';
import { useToast } from './controllers/useToast';
import { useTrackList } from './controllers/useTrackList';
import type { Track } from './models/types';
import { AddToPlaylistDialog } from './views/AddToPlaylistDialog';
import { Carousel } from './views/Carousel';
import { CreatePlaylistDialog } from './views/CreatePlaylistDialog';
import { Header } from './views/Header';
import { LoginScreen } from './views/LoginScreen';
import { PlayerBar } from './views/PlayerBar';
import { PlayingRow } from './views/PlayingRow';
import { PlaylistRow } from './views/PlaylistRow';
import { SettingsPanel } from './views/SettingsPanel';
import { Toast } from './views/Toast';

// Which dialog is open. A song can travel along, so "New playlist" can start with it.
type DialogState = { kind: 'create'; track: Track | null } | { kind: 'add'; track: Track } | null;

/** Connects the controllers (hooks) to the views (components). */
export default function App() {
  const toast = useToast();
  const auth = useAuth(toast.show);
  const isLoggedIn = auth.status === 'logged-in';
  const isVisible = useOverlayVisible();

  const { settings, changeShortcut, setMinimizeSpotify } = useSettings();
  const [query, setQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);

  const library = usePlaylists(isLoggedIn, toast.show);
  const list = useTrackList(library.selected, query, toast.show, library.version);
  const selection = useSelection(list.tracks.length, list.tracks);
  const player = usePlayback(isLoggedIn && isVisible, toast.show);
  const positionMs = useProgress(player.playback);
  const playing = usePlayingTracks(player.playback, library.playlists, library.version);

  // Each time the overlay opens, jump to the playlist that is playing.
  const hasSyncedThisOpening = useRef(false);
  useEffect(() => {
    if (!isVisible) {
      hasSyncedThisOpening.current = false;
      return;
    }
    const contextUri = player.playback?.contextUri;
    if (hasSyncedThisOpening.current || !contextUri) return;

    hasSyncedThisOpening.current = true;
    const index = library.playlists.findIndex((playlist) => playlist.uri === contextUri);
    if (index >= 0) {
      setQuery('');
      library.select(index);
    }
  }, [isVisible, player.playback, library.playlists]);

  // When a playlist's songs load, put the song that is playing in the middle.
  useEffect(() => {
    const index = list.tracks.findIndex((track) => track.id === player.playback?.track.id);
    if (index >= 0) selection.select(index);
  }, [list.tracks]);

  const heading = list.isSearching ? `Results for “${query.trim()}”` : library.selected?.name ?? '';

  function playTrack(index: number) {
    const track = list.tracks[index];
    if (!track) return;

    if (list.isSearching) {
      player.play({ uris: list.tracks.map((t) => t.uri), offset: { position: index } });
    } else if (library.selected) {
      player.play({ context_uri: library.selected.uri, offset: { uri: track.uri } });
    }
  }

  // Clicking the centered song in the playing row: pause/resume if it is the current one, otherwise play it.
  function playFromPlaying(index: number) {
    const track = playing.tracks[index];
    if (index === playing.playingIndex) player.togglePlay();
    else if (track && playing.contextUri) player.play({ context_uri: playing.contextUri, offset: { uri: track.uri } });
  }

  const playPlaylist = () => library.selected && player.play({ context_uri: library.selected.uri });

  const selectPlaylist = (index: number) => {
    setQuery(''); // leave search mode
    library.select(index);
  };

  const movePlaylist = (step: number) => {
    setQuery('');
    library.move(step);
  };

  const isModalOpen = isSettingsOpen || dialog !== null;
  const selectedTrack = list.tracks[selection.index];

  useCarouselInput({
    onMove: (step) => !isModalOpen && selection.move(step),
    onMovePlaylist: (step) => !isModalOpen && movePlaylist(step),
    onMovePlaying: (step) => !isModalOpen && playing.move(step),
    onPlay: () => !isModalOpen && playTrack(selection.index),
    onTogglePlay: () => !isModalOpen && player.togglePlay(),
    onEscape: () => {
      // Esc closes the top-most thing first, and the overlay last.
      if (dialog) setDialog(null);
      else if (isSettingsOpen) setIsSettingsOpen(false);
      else window.api.hideOverlay();
    }
  });

  return (
    // Clicking the dark area around the panel closes the overlay.
    <div
      className={`backdrop${isVisible ? ' shown' : ''}${player.playback?.isPlaying ? '' : ' paused'}`}
      onMouseDown={(event) => event.target === event.currentTarget && window.api.hideOverlay()}>
      <div className="panel">
        <Header query={query} onQueryChange={setQuery} onOpenSettings={() => setIsSettingsOpen(true)} />

        <PlaylistRow
          playlists={library.playlists}
          selectedIndex={library.selectedIndex}
          playingUri={player.playback?.contextUri ?? null}
          onSelect={selectPlaylist}
          onPlay={playPlaylist}
          onCreate={() => setDialog({ kind: 'create', track: null })}
        />

        <Carousel
          tracks={list.tracks}
          selectedIndex={selection.index}
          listKey={list.listKey}
          playingTrackId={player.playback?.track.id ?? null}
          heading={heading}
          isLoading={list.isLoading}
          hasFailed={list.hasFailed}
          isSearching={list.isSearching}
          onSelect={selection.select}
          onPlay={playTrack}
          onPlayPlaylist={playPlaylist}
          onAddToPlaylist={() => selectedTrack && setDialog({ kind: 'add', track: selectedTrack })}
        />

        <PlayingRow
          tracks={playing.tracks}
          selectedIndex={playing.focusIndex}
          playingIndex={playing.playingIndex}
          listKey={playing.listKey}
          heading={playing.heading}
          hasPlayback={player.playback !== null}
          isLoading={playing.isLoading}
          onSelect={playing.select}
          onActivate={playFromPlaying}
        />

        <PlayerBar
          playback={player.playback}
          positionMs={positionMs}
          onTogglePlay={player.togglePlay}
          onNext={player.next}
          onPrevious={player.previous}
          onShuffle={player.toggleShuffle}
          onSeek={player.seekToFraction}
          onVolume={player.setVolume}
        />

        {isSettingsOpen && settings && (
          <SettingsPanel
            settings={settings}
            onShortcut={changeShortcut}
            onMinimizeSpotify={setMinimizeSpotify}
            onError={toast.show}
            onClose={() => setIsSettingsOpen(false)}
          />
        )}

        {dialog?.kind === 'create' && (
          <CreatePlaylistDialog
            track={dialog.track}
            onCreate={(name) => library.create(name, dialog.track?.uri)}
            onClose={() => setDialog(null)}
          />
        )}

        {dialog?.kind === 'add' && (
          <AddToPlaylistDialog
            track={dialog.track}
            playlists={library.editable}
            onPick={(playlist) => library.addTrack(playlist, dialog.track).then((isAdded) => isAdded && setDialog(null))}
            onNew={() => setDialog({ kind: 'create', track: dialog.track })}
            onClose={() => setDialog(null)}
          />
        )}

        {auth.status === 'logged-out' && (
          <LoginScreen
            isConfigured={auth.isConfigured}
            onLogin={auth.login}
            onSaveClientId={auth.saveClientId}
            onChangeClientId={auth.changeClientId}
          />
        )}
        <Toast message={toast.message} isVisible={toast.isVisible} />
      </div>
    </div>
  );
}
