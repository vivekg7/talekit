import { spawn, spawnSync } from 'node:child_process';

/**
 * Open a review page for the person: in Firefox when it is already running (a new tab
 * beside what they have open, rather than a second browser starting), otherwise in the
 * default browser. Best effort: a machine with no browser just keeps the printed address.
 */
export function openInBrowser(url: string): void {
  const running = (name: string) => spawnSync('pgrep', ['-x', name]).status === 0;
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', running('firefox') ? ['-a', 'Firefox', url] : [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : running('firefox')
          ? ['firefox', ['--new-tab', url]]
          : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true })
    .on('error', () => {})
    .unref();
}
