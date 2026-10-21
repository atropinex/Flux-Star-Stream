import { IconButton } from './IconButton';
import { CloseIcon, SearchIcon, SettingsIcon } from './Icons';

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  onOpenSettings: () => void;
}

export function Header({ query, onQueryChange, onOpenSettings }: Props) {
  return (
    <header className="header">
      <b className="brand">Star Stream</b>

      <label className="search">
        <SearchIcon size={16} />
        <input
          type="text"
          placeholder="Search songs"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && query) {
              onQueryChange('');
              event.stopPropagation(); // clears the search first, a second Esc closes the overlay
            }
          }}
        />
      </label>

      <div className="header-actions">
        <IconButton label="Settings" onClick={onOpenSettings}><SettingsIcon size={18} /></IconButton>
        <IconButton label="Close" onClick={() => window.api.hideOverlay()}><CloseIcon size={18} /></IconButton>
      </div>
    </header>
  );
}
