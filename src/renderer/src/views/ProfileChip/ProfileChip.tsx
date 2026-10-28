import type { AccountInfo } from '../../models/types';
import { Avatar } from '../Avatar/Avatar';
import './ProfileChip.css';

interface Props {
  account: AccountInfo | null;
  onClick: () => void;
}

/** Your picture, name and plan in the header. Clicking it opens the account details in the settings. */
export function ProfileChip({ account, onClick }: Props) {
  const name = account?.name || account?.username;
  if (!account || !name) return null; // nothing to show until Spotify has answered

  return (
    <button className="profile-chip" onClick={onClick} title="Account">
      <Avatar url={account.avatarUrl} name={name} size={30} />
      <span className="profile-name">{name}</span>
      {account.planLabel && <span className={`plan-badge small ${account.plan}`}>{account.planLabel}</span>}
    </button>
  );
}
