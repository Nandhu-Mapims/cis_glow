import { runTtConfigMoreNative, TT_CONFIG_V1, TT_CONFIG_V3 } from './ttConfigMore.js';

/** Legacy: tt_config_more.php */
export async function runTtConfigMore(memberId, opts = {}, audit = {}) {
  return runTtConfigMoreNative(memberId, opts, audit, TT_CONFIG_V1);
}

/** Legacy: tt_config_more_v3.php */
export async function runTtConfigMoreV3(memberId, opts = {}, audit = {}) {
  return runTtConfigMoreNative(memberId, opts, audit, TT_CONFIG_V3);
}
