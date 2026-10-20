import { useState } from 'react';
import type { Track } from '../models/types';
import { Dialog } from './Dialog';

interface Props {
  track: Track | null; // a song to put in the new playlist, if any
  onCreate: (name: string) => Promise<boolean>;
  onClose: () => void;
}

export function CreatePlaylistDialog({ track, onCreate, onClose }: Props) {
  const [name, setName] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || isBusy) return;

    setIsBusy(true);
    const isCreated = await onCreate(trimmed);
    setIsBusy(false);
    if (isCreated) onClose();
  }

  return (
    <Dialog title="New playlist" onClose={onClose}>
      <input
        autoFocus
        placeholder="Playlist name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && submit()}
      />
      {track && <p className="note">“{track.name}” will be added to it. Playlists are private by default.</p>}
      {!track && <p className="note">Playlists are private by default.</p>}

      <div className="dialog-actions">
        <button className="ghost" onClick={onClose}>Cancel</button>
        <button className="primary" disabled={!name.trim() || isBusy} onClick={submit}>Create</button>
      </div>
    </Dialog>
  );
}
