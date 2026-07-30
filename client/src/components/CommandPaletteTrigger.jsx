import { useCommandPalette } from './CommandPaletteContext';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

export default function CommandPaletteTrigger({ className = '' }) {
  const { setOpen } = useCommandPalette();
  return (
    <button
      type="button"
      className={`cis-topnav-iconbtn cis-cmdk-trigger ${className}`.trim()}
      title="Jump to a screen (⌘K)"
      aria-label="Open command palette"
      onClick={() => setOpen(true)}
    >
      <i className="fa fa-bolt" aria-hidden="true" />
      <span className="cis-cmdk-trigger-kbd">{isMac ? '⌘K' : 'Ctrl K'}</span>
    </button>
  );
}
