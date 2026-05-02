/**
 * Path2D cache shared by canvas icon builders.
 *
 * Extracted from pause-icons.ts to keep that file under the project's
 * 200-LOC modularization limit. Other canvas modules can reuse this
 * cache for their own deterministic Path2Ds.
 */

const _path2dCache = new Map<string, Path2D>()

export function getCachedPath2D(key: string, build: () => Path2D): Path2D {
  let p = _path2dCache.get(key)
  if (!p) { p = build(); _path2dCache.set(key, p) }
  return p
}
