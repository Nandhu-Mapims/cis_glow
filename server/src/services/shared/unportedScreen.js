import { legacyPageFor } from '../../config/bridgeScreenMaps.js';

/**
 * Clear error for setup screens not yet ported to native Node + React.
 * Legacy PHP in /home/mapims/cis/cis/ is reference only.
 */
export function unportedSetupScreen(module, screen) {
  const legacy = legacyPageFor(module, screen);
  return {
    error: `Screen "${screen}" is not yet available as a native API. Legacy reference: ${legacy}`,
    code: 'NOT_PORTED',
    screen,
    legacy,
  };
}
