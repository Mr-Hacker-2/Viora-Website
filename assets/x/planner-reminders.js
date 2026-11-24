/* Planner reminders: decide what to show now, what was missed, and what is next. Pure, so it can be tested without a browser.
   A reminder is identified by task id + its reminder time, so changing the time re-arms it and a repeat poll never shows it twice.
   Reminders only run while Planner is open in a browser tab (there is no background push); a reminder that came due while the tab
   was closed is reported once as "missed" instead of popping up hours or days late. */
export const GRACE_MS = 6 * 3600 * 1000;      // still worth a notification if it came due within the last 6 hours
export const HORIZON_MS = 24 * 3600 * 1000;   // "upcoming" looks one day ahead
export const reminderKey = task => 'viora_planner_reminder_' + task.id + '_' + task.reminderAt;

export function scanReminders(tasks, now, isSeen = () => false, { graceMs = GRACE_MS, horizonMs = HORIZON_MS } = {}) {
  const due = [], missed = [], upcoming = [];
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (!task || task.archived || task.status === 'completed') continue;
    const at = Date.parse(task.reminderAt || ''); if (!Number.isFinite(at)) continue;
    if (at > now) { if (at - now <= horizonMs) upcoming.push({ task, at }); continue; }
    if (isSeen(reminderKey(task))) continue;
    (now - at <= graceMs ? due : missed).push({ task, at });
  }
  const byTime = (a, b) => a.at - b.at;
  return { due: due.sort(byTime), missed: missed.sort(byTime), upcoming: upcoming.sort(byTime) };
}

/* Seen-store that never fails silently: when localStorage is unavailable (private mode, quota) it falls back to memory,
   so a reminder is still shown once per page load instead of never or on every poll. */
export function seenStore(storage = globalThis.localStorage) {
  const memory = new Map();
  return {
    has(key) { if (memory.has(key)) return true; try { return !!storage.getItem(key); } catch { return false; } },
    add(key) { memory.set(key, 1); try { storage.setItem(key, String(Date.now())); } catch {} },
    prune(maxAgeMs = 30 * 24 * 3600 * 1000, now = Date.now()) {
      try { for (let i = storage.length - 1; i >= 0; i--) { const k = storage.key(i); if (k && k.startsWith('viora_planner_reminder_')) { const t = Number(storage.getItem(k)); if (Number.isFinite(t) && now - t > maxAgeMs) storage.removeItem(k); } } } catch {}
    }
  };
}

export function describeNext(upcoming, now, timeZone) {
  if (!upcoming.length) return '';
  const { task, at } = upcoming[0], mins = Math.round((at - now) / 60000);
  const when = mins < 60 ? 'in ' + Math.max(1, mins) + ' min' : new Date(at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit', ...(timeZone ? { timeZone } : {}) });
  return 'Next reminder: ' + task.title + ' · ' + when + (upcoming.length > 1 ? ' (+' + (upcoming.length - 1) + ' more today)' : '');
}
