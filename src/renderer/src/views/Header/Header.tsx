import type { AccountInfo } from '../../models/types';
import { IconButton } from '../IconButton/IconButton';
import { CloseIcon, SearchIcon, SettingsIcon } from '../Icons';
import { ProfileChip } from '../ProfileChip/ProfileChip';
import './Header.css';

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  onOpenSettings: () => void;
  account: AccountInfo | null;
}

export function Header({ query, onQueryChange, onOpenSettings, account }: Props) {
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
        <ProfileChip account={account} onClick={onOpenSettings} />
        <IconButton label="Settings" onClick={onOpenSettings}><SettingsIcon size={18} /></IconButton>
        <IconButton label="Close" onClick={() => window.api.hideOverlay()}><CloseIcon size={18} /></IconButton>
      </div>
    </header>
  );
}
