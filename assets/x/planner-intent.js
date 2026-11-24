/* Viora Flash <-> Planner: deciding when a chat message is a Planner command, and checking that a change really was saved.
   Pure functions (no DOM, no network) so they can be tested. The Planner itself is changed only by the server (/api/planner/assistant);
   nothing here edits data. */
const NOUN = /\b(?:tasks?|sub-?tasks?|to-?dos?|planner|projects?|assignments?|homework|deadlines?|due dates?|reminders?|schedule|calendar|milestones?|lists?)\b/i;
const VERB = /\b(?:add|create|make|new|set|change|rename|edit|update|move|reschedule|push|postpone|delay|mark|complete|finish|reopen|delete|remove|organi[sz]e|plan|break|split|prioriti[sz]e|show|list|find|search|summari[sz]e|what(?:'s|\s+is|\s+are)|which|tell me|how many|do i have|do i need)\b/i;
const CONCEPT = /\b(?:how (?:do|to|can|should|does)|explain|essay|write (?:me )?(?:a|an|the)\b|definition of|what is (?:a|an) |tips? (?:for|on)|best way to|difference between|examples? of|in general|article about)\b/i;
const PERSONAL = /\b(?:my|our|i)\b|\b(?:this|that|these|those|all|every|everything)\b/i;
const START = /^\s*(?:(?:please|hey|hi|ok(?:ay)?|viora|flash)[,\s]+)*(?:(?:can|could|would|will) you (?:please )?)?(?:add|create|make|set|change|rename|edit|update|move|reschedule|push|postpone|delay|mark|complete|finish|reopen|delete|remove|organi[sz]e|plan|break|split|prioriti[sz]e|show|list|summari[sz]e)\b/i;
const WEEK = /\b(?:everything i need to (?:do|finish|complete)|my week|plan my day|what do i have)\b/i;
const FOLLOW = /\b(?:it|this|that|them|those|these|the same one)\b/i;
const FOLLOW_ACTION = /\b(?:high|low|medium|normal|urgent|priority|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|next week|tonight|done|complete|completed|finished|delete|remove|rename|move|change|set|add|break|split|reopen|postpone|push)\b/i;

export function isPlannerRequest(text, { lastWasPlanner = false } = {}) {
  const t = String(text || '').trim(); if (!t) return false;
  if (/^\s*@planner\b/i.test(t)) return true;
  if (t.length > 600) return false;                                         // pasted documents are not commands
  if (lastWasPlanner && t.length <= 160 && FOLLOW.test(t) && FOLLOW_ACTION.test(t) && !CONCEPT.test(t)) return true; // "make it high priority" right after a Planner answer
  if (WEEK.test(t)) return true;
  if (CONCEPT.test(t) && !/\b(?:my|our)\b/i.test(t)) return false;         // "how do I create a project plan?" is a question about the subject
  return NOUN.test(t) && VERB.test(t) && (START.test(t) || PERSONAL.test(t));
}

/* Task ids the last Planner answer was about, so "it" / "this task" in the next message points at something real. */
export function followUpTaskIds(text, lastPlanner) {
  const ids = (lastPlanner && Array.isArray(lastPlanner.tasks) ? lastPlanner.tasks : []).map(x => String(x.id || '')).filter(Boolean);
  return FOLLOW.test(String(text || '')) && ids.length && ids.length <= 3 ? ids : [];
}

/* Did the server's answer really get saved? Compares the tasks it reported against a fresh read of the Planner. */
export function verifyAgainstState(reported, stateTasks) {
  const live = new Map((Array.isArray(stateTasks) ? stateTasks : []).map(t => [String(t.id), t]));
  const missing = [], mismatched = [];
  for (const t of Array.isArray(reported) ? reported : []) {
    const now = live.get(String(t.id));
    if (!now) { missing.push(t.title || t.id); continue; }
    for (const f of ['title', 'status', 'priority', 'dueDate']) if (t[f] != null && t[f] !== '' && now[f] != null && String(t[f]) !== String(now[f])) { mismatched.push((t.title || t.id) + ' (' + f + ')'); break; }
  }
  return { ok: !missing.length && !mismatched.length, missing, mismatched };
}
export const failedResults = results => (Array.isArray(results) ? results : []).filter(r => r && (r.ok === false || r.error || r.success === false));
