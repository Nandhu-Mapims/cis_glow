import {
  loadFeeLabelSetup,
  saveFeeLabelSetup,
} from './setup/feeLabelSetup.js';
import {
  loadFeeTypeSetup,
  saveFeeTypeSetup,
} from './setup/feeTypeSetup.js';
import {
  loadFeeBankSetup,
  saveFeeBankSetup,
} from './setup/feeBankSetup.js';
import {
  loadFeeFineSetup,
  saveFeeFineSetup,
} from './setup/feeFineSetup.js';
import {
  loadFeeNameSetup,
  saveFeeNameSetup,
} from './setup/feeNameSetup.js';

const VALID_SCREENS = new Set(['label', 'type', 'bank', 'fine', 'name']);

const LOADERS = {
  label: loadFeeLabelSetup,
  type: loadFeeTypeSetup,
  bank: loadFeeBankSetup,
  fine: loadFeeFineSetup,
  name: loadFeeNameSetup,
};

const SAVERS = {
  label: saveFeeLabelSetup,
  type: saveFeeTypeSetup,
  bank: saveFeeBankSetup,
  fine: saveFeeFineSetup,
  name: saveFeeNameSetup,
};

export function assertFeeSetupScreen(screen) {
  if (!VALID_SCREENS.has(screen)) {
    return { error: 'Unknown fee setup screen' };
  }
  return null;
}

export async function loadFeeSetupScreen(screen, fields, memberId, audit = {}) {
  const invalid = assertFeeSetupScreen(screen);
  if (invalid) return invalid;

  const loader = LOADERS[screen];
  return loader(memberId, fields || {}, audit);
}

export async function saveFeeSetupScreen(screen, fields, memberId, audit = {}) {
  const invalid = assertFeeSetupScreen(screen);
  if (invalid) return invalid;

  const saver = SAVERS[screen];
  return saver(fields || {}, memberId, audit);
}
