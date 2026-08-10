export const GLOBAL_ACCESS_TYPE = 'Global';

/** True for the superuser access_type that bypasses per-menu authentication_tb checks. */
export function isGlobalAccessType(accessType) {
  return accessType === GLOBAL_ACCESS_TYPE;
}
