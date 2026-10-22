interface Props {
  message: string;
  isVisible: boolean;
}

export function Toast({ message, isVisible }: Props) {
  return <div className={`toast${isVisible ? ' visible' : ''}`}>{message}</div>;
}
