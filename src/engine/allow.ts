import type { Allow } from './types.js';

/**
 * Whether a shot or its scene waives a check (`allow`), for every actor or for this one:
 * keyed by the check's code (`support.air`) or by code and actor (`support.air:ghost`).
 */
export function waived(allow: Allow[], code: string, actor?: string): boolean {
  return allow.some((a) => a && (a[code] !== undefined || (actor && a[`${code}:${actor}`])));
}
