/* Builds a "how this user writes" sample for the Humanizer from messages they typed in past chats.
   Skips Humanizer chats (those hold pasted drafts, not the user's own voice) and anything that looks pasted. */
const HUMANIZER_CHATS = new Set(['human', 'humanize']);
const looksPasted = t => t.length > 600 || /```|<\/?[a-z][^>]*>|untrusted_content/i.test(t) || t.split('\n').length > 6;

export function chatVoiceSample(chats, { max = 1500, minWords = 40, minMsgs = 5 } = {}) {
  const seen = new Set(), picked = []; let used = 0;
  const list = [...(chats || [])].filter(c => c && Array.isArray(c.messages) && !HUMANIZER_CHATS.has(c.assistant))
    .sort((a, b) => (b.updated || 0) - (a.updated || 0));
  outer: for (const c of list) for (let i = c.messages.length - 1; i >= 0; i--) {
    const m = c.messages[i];
    if (!m || m.role !== 'user' || typeof m.content !== 'string') continue;
    const t = m.content.replace(/https?:\/\/\S+/g, '').replace(/[ \t]+/g, ' ').trim();
    if (t.length < 3 || looksPasted(t) || seen.has(t.toLowerCase())) continue;
    if (used + t.length + 1 > max) { if (used > max * 0.8) break outer; continue; }
    seen.add(t.toLowerCase()); picked.push(t); used += t.length + 1;
  }
  const words = picked.join(' ').split(/\s+/).filter(Boolean).length;
  return picked.length >= minMsgs && words >= minWords ? { text: picked.join('\n'), msgs: picked.length, words } : { text: '', msgs: picked.length, words };
}
