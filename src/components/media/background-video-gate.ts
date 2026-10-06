// Module 724138. A global gate that pauses every background video while a lightbox (or anything
// else that calls `suspendBackgroundVideos`) is open, plus sync groups so several <Video>s showing
// the same file play in step.

const syncGroups = new Map<string, Set<HTMLVideoElement>>();
let suspendCount = 0;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function findGroupLeader(group: string, self: HTMLVideoElement): HTMLVideoElement | null {
  const members = syncGroups.get(group);
  if (!members) return null;
  for (const video of members) {
    if (video !== self && !video.paused && video.readyState >= 2 && Number.isFinite(video.currentTime)) return video;
  }
  return null;
}

/** Seeks `video` to the time of a playing member of `group`, if there is one. */
export function alignToGroup(group: string, video: HTMLVideoElement): void {
  const leader = findGroupLeader(group, video);
  if (leader) video.currentTime = leader.currentTime;
}

export function isBackgroundVideoSuspended(): boolean {
  return suspendCount > 0;
}

export function joinSyncGroup(group: string, video: HTMLVideoElement): () => void {
  let members = syncGroups.get(group);
  if (!members) {
    members = new Set();
    syncGroups.set(group, members);
  }
  members.add(video);
  return () => {
    members.delete(video);
    if (members.size === 0 && syncGroups.get(group) === members) syncGroups.delete(group);
  };
}

export function subscribeBackgroundVideoGate(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Suspends background videos; call the returned function to release this hold. */
export function suspendBackgroundVideos(): () => void {
  suspendCount++;
  notify();
  return () => {
    suspendCount--;
    notify();
  };
}
