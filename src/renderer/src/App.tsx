import { useEffect, useRef, useState } from 'react';
import { useAuth } from './controllers/useAuth';
import { useAccount } from './controllers/useAccount';
import { useCarouselInput } from './controllers/useCarouselInput';
import { useOverlayVisible } from './controllers/useOverlayVisible';
import { usePlaylists } from './controllers/usePlaylists';
import { usePlayback } from './controllers/usePlayback';
import { usePlayingTracks } from './controllers/usePlayingTracks';
import { useQueue } from './controllers/useQueue';
import { useSelection } from './controllers/useSelection';
import { useSettings } from './controllers/useSettings';
import { useTheme } from './controllers/useTheme';
import { useToast } from './controllers/useToast';
import { useTrackList } from './controllers/useTrackList';
import type { Track } from './models/types';
import { AddToPlaylistDialog } from './views/AddToPlaylistDialog/AddToPlaylistDialog';
import { Carousel } from './views/Carousel/Carousel';
import { CreatePlaylistDialog } from './views/CreatePlaylistDialog/CreatePlaylistDialog';
import { Header } from './views/Header/Header';
import { LoginScreen } from './views/LoginScreen/LoginScreen';
import { PlayerBar } from './views/PlayerBar/PlayerBar';
import { PlayingRow } from './views/PlayingRow/PlayingRow';
import { PlaylistRow } from './views/PlaylistRow/PlaylistRow';
import { QueuePanel } from './views/QueuePanel/QueuePanel';
import { SettingsPanel } from './views/SettingsPanel/SettingsPanel';
import { ThemeLayers } from './views/ThemeLayers/ThemeLayers';
import { Toast } from './views/Toast/Toast';
import './App.css';

// Which dialog is open. A song can travel along, so "New playlist" can start with it.
type DialogState = { kind: 'create'; track: Track | null } | { kind: 'add'; track: Track } | null;

/** Connects the controllers (hooks) to the views (components). */
export default function App() {
  const toast = useToast();
  const auth = useAuth();
  const isLoggedIn = auth.status === 'logged-in';
  const isVisible = useOverlayVisible();

  const { settings, changeShortcut, update: updateSettings } = useSettings();
  const theme = useTheme(settings?.theme, isVisible);
  const [query, setQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);

  const library = usePlaylists(isLoggedIn, toast.show);
  const list = useTrackList(library.selected, query, toast.show, library.version);
  const selection = useSelection(list.tracks.length, list.tracks);
  const player = usePlayback(isLoggedIn && isVisible, toast.show);
  useEffect(() => {
    if (!settings || !isVisible) return;
    void window.api.bridgeRequest('configureCrossfade', {
      enabled: settings.crossfadeEnabled,
      seconds: settings.crossfadeSeconds
    });
  }, [settings?.crossfadeEnabled, settings?.crossfadeSeconds, isVisible]);
  const playing = usePlayingTracks(player.playback, library.playlists, library.version);
  const queue = useQueue(isQueueOpen, player.playback?.track.uri);
  const account = useAccount(isSettingsOpen);

  const selectedTrack = list.tracks[selection.index];
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

  const isModalOpen = isSettingsOpen || isQueueOpen || dialog !== null;

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
      else if (isQueueOpen) setIsQueueOpen(false);
      else window.api.hideOverlay();
    }
  });

  return (
    // Clicking the dark area around the content closes the overlay.
    <div
      className={`backdrop${isVisible ? ' shown' : ''}${player.playback?.isPlaying ? '' : ' paused'}`}
      onMouseDown={(event) => event.target === event.currentTarget && window.api.hideOverlay()}
    >
      <ThemeLayers theme={theme.active} />

      <div className="panel">
        <Header query={query} onQueryChange={setQuery} onOpenSettings={() => {
          setIsQueueOpen(false);
          setIsSettingsOpen(true);
        }} />

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
          onTogglePlay={player.togglePlay}
          onNext={player.next}
          onPrevious={player.previous}
          onShuffle={player.toggleShuffle}
          onLoop={player.cycleRepeat}
          onOpenQueue={() => {
            setIsSettingsOpen(false);
            setIsQueueOpen(true);
          }}
          onSeek={player.seekToFraction}
          onVolume={player.setVolume}
        />

        {isQueueOpen && (
          <QueuePanel
            queue={queue.queue}
            isLoading={queue.isLoading}
            error={queue.error}
            contextName={playing.heading === 'Now playing' ? '' : playing.heading}
            onClose={() => setIsQueueOpen(false)}
          />
        )}

        {isSettingsOpen && settings && (
          <SettingsPanel
            settings={settings}
            themes={theme.themes}
            themeErrors={theme.errors}
            account={account.account}
            accountError={account.error}
            onShortcut={changeShortcut}
            onUpdate={updateSettings}
            onReloadThemes={theme.reload}
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

        {auth.status === 'logged-out' && <LoginScreen />}
        <Toast message={toast.message} isVisible={toast.isVisible} />
      </div>
    </div>
  );
}
