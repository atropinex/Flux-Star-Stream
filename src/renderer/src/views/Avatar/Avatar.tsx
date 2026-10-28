import './Avatar.css';

interface Props {
  url: string;
  name: string; // the first letter is shown when there is no picture
  size?: number;
}

/** A round profile picture, or the first letter of the name. */
export function Avatar({ url, name, size = 32 }: Props) {
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.42, backgroundImage: url ? `url("${url}")` : undefined }}
      aria-hidden="true"
    >
      {!url && name.charAt(0).toUpperCase()}
    </div>
  );
}
