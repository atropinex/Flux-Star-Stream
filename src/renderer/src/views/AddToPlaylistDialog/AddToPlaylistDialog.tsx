import type { Playlist, Track } from '../../models/types';
import { Dialog } from '../Dialog/Dialog';
import { PlusIcon } from '../Icons';

interface Props {
  track: Track;
  playlists: Playlist[]; // only the ones that can be edited
  onPick: (playlist: Playlist) => void;
  onNew: () => void;
  onClose: () => void;
}

export function AddToPlaylistDialog({ track, playlists, onPick, onNew, onClose }: Props) {
  return (
    <Dialog title="Add to playlist" onClose={onClose}>
      <p className="note">“{track.name}”</p>

      <div className="dialog-list">
        <button className="dialog-item" onClick={onNew}>
          <span className="dialog-thumb"><PlusIcon size={16} /></span>
          New playlist
        </button>

        {playlists.map((playlist) => {
          const imageUrl = playlist.images?.[0]?.url;
          return (
            <button key={playlist.id} className="dialog-item" onClick={() => onPick(playlist)}>
              <span className="dialog-thumb" style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : undefined }}>
                {!imageUrl && playlist.name.charAt(0).toUpperCase()}
              </span>
              {playlist.name}
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
