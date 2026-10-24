import type { QueueInfo, Track } from '../../models/types';
import { IconButton } from '../IconButton/IconButton';
import { CloseIcon } from '../Icons';
import './QueuePanel.css';

interface Props {
  queue: QueueInfo | null;
  isLoading: boolean;
  error: string | null;
  contextName: string; // the playlist it is playing from, if known
  onClose: () => void;
}

/** The cover, title and artist of one song. */
function QueueRow({ track }: { track: Track }) {
  const cover = track.album.images[0]?.url;
  return (
    <>
      <div className="queue-cover" style={{ backgroundImage: cover ? `url(${cover})` : undefined }} />
      <div className="queue-text">
        <div className="queue-title">{track.name}</div>
        <div className="queue-artist">{track.artists.map((artist) => artist.name).join(', ')}</div>
      </div>
    </>
  );
}

function QueueSection({ title, tracks, isCurrent = false }: { title: string; tracks: Track[]; isCurrent?: boolean }) {
  if (tracks.length === 0) return null;
  return (
    <section>
      <h3>{title}</h3>
      <ul className="queue-list">
        {tracks.map((track, index) => (
          <li key={`${track.uri}-${index}`} className={`queue-item${isCurrent ? ' current' : ''}`}>
            <QueueRow track={track} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The play queue, in the same frosted-glass drawer as the settings. */
export function QueuePanel({ queue, isLoading, error, contextName, onClose }: Props) {
  const isEmpty = queue !== null && !queue.current && queue.queued.length === 0 && queue.upNext.length === 0;

  return (
    <div className="settings-layer">
      <div className="settings-backdrop" onClick={onClose} />
      <aside className="settings queue-panel">
        <header>
          <h2>Queue</h2>
          <IconButton label="Close" onClick={onClose}><CloseIcon size={18} /></IconButton>
        </header>

        {error && <p className="note error">{error}</p>}
        {!queue && !error && isLoading && <p className="note">Loading…</p>}
        {isEmpty && <p className="note">The queue is empty. Play something and what comes next shows up here.</p>}

        {queue && (
          <>
            <QueueSection title="Now playing" tracks={queue.current ? [queue.current] : []} isCurrent />
            <QueueSection title="Next in queue" tracks={queue.queued} />
            <QueueSection title={contextName ? `Next from ${contextName}` : 'Next up'} tracks={queue.upNext} />
          </>
        )}
      </aside>
    </div>
  );
}
