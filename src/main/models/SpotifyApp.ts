import { execFile } from 'child_process';

// Windows: ShowWindow(handle, 6) minimizes the window of the "Spotify" process.
const WINDOWS_SCRIPT = `
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class W { [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c); }'
Get-Process Spotify -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | ForEach-Object { [W]::ShowWindow($_.MainWindowHandle, 6) | Out-Null }
`;

const MAC_SCRIPT =
  'tell application "System Events" to tell process "Spotify" to set value of attribute "AXMinimized" of every window to true';

const LINUX_COMMAND = 'xdotool search --class spotify | xargs -r -n1 xdotool windowminimize';

/** The Spotify desktop app installed on this computer. */
export class SpotifyApp {
  /** Minimizes its window. Quietly does nothing if Spotify is not running or the tool is missing. */
  minimize(): Promise<void> {
    return new Promise((resolve) => {
      const done = () => resolve();

      if (process.platform === 'win32') {
        const encoded = Buffer.from(WINDOWS_SCRIPT, 'utf16le').toString('base64');
        execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], done);
      } else if (process.platform === 'darwin') {
        execFile('osascript', ['-e', MAC_SCRIPT], done); // needs the Accessibility permission
      } else {
        execFile('sh', ['-c', LINUX_COMMAND], done); // needs xdotool
      }
    });
  }
}
