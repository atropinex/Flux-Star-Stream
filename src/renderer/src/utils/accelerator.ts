const NAMED_KEYS: Record<string, string> = {
  Space: 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Backquote: '`', Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Tab: 'Tab'
};

/** Turns a key press into Electron's shortcut format, e.g. "CommandOrControl+Alt+M". Null if not a full combo. */
export function toAccelerator(event: KeyboardEvent): string | null {
  const { code } = event;
  let key: string | undefined = NAMED_KEYS[code];
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
  if (/^Digit\d$/.test(code)) key = code.slice(5);
  if (/^F\d{1,2}$/.test(code)) key = code;
  if (!key) return null;

  const modifiers = [
    event.ctrlKey || event.metaKey ? 'CommandOrControl' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : ''
  ].filter(Boolean);

  return modifiers.length ? [...modifiers, key].join('+') : null; // a shortcut needs at least one modifier
}

/** "CommandOrControl+Alt+M" -> "Ctrl + Alt + M" */
export function describeAccelerator(accelerator: string): string {
  return accelerator.replace('CommandOrControl', 'Ctrl').split('+').join(' + ');
}
