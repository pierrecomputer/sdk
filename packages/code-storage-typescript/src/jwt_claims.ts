import type { RefPolicies } from './types';

/** Encode per-ref policy rules for the JWT `refs` claim (array of [pattern, ops] tuples). */
export function encodeRefsClaim(refs: RefPolicies): [string, string[]][] {
  return refs.map(({ pattern, ops }) => [pattern, ops ?? []]);
}
