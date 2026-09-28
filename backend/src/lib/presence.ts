const ACTIVE_WINDOW_MS = 45 * 1000;

const lastSeen = new Map<string, { at: number; path: string }>();

export function recordHeartbeat(visitorId: string, path: string) {
  lastSeen.set(visitorId, { at: Date.now(), path });
}

export function getActiveVisitors(): { count: number; paths: Record<string, number> } {
  const cutoff = Date.now() - ACTIVE_WINDOW_MS;
  const paths: Record<string, number> = {};
  let count = 0;
  for (const [visitorId, entry] of lastSeen) {
    if (entry.at < cutoff) {
      lastSeen.delete(visitorId);
      continue;
    }
    count++;
    paths[entry.path] = (paths[entry.path] ?? 0) + 1;
  }
  return { count, paths };
}
