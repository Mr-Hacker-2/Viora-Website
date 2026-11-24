/* Humanizer: extra editing instructions that sit on top of style / mode / strength / complexity (built in app.html's hzSend).
   Pure functions, so they can be tested without a browser. Nothing here invents content: every guide says "keep the facts". */

/* What kind of text is this? Used only to pick the right conventions; the purpose of the text never changes. */
const KINDS = [
  ['email', /^\s*(subject:|dear \w+|(?:hi|hello|hey) \w+,)|\b(best regards|kind regards|sincerely|thanks in advance|looking forward to hearing|please find attached)\b/i, 'an email: keep the greeting and sign-off, and keep the request, deadlines and next steps clear'],
  ['academic', /\b(abstract|methodology|hypothesis|literature review|et al\.|furthermore|empirical|thesis statement|in this (?:paper|essay|study)|this study)\b|\(\w+,? (?:et al\.,? )?\d{4}\)/i, 'academic writing: keep the formal register, terminology, hedging and citations exactly'],
  ['social', /(^|\s)[#@]\w+|\b(lol|omg|tbh|imo|thread|retweet)\b/i, 'a social media post: keep it short and direct, and keep every hashtag and mention unchanged'],
  ['assignment', /\b(question \d+|answer:|assignment|homework|in conclusion|to conclude|the topic of)\b/i, 'a school essay or assignment: keep a credible student voice and the original argument and structure'],
  ['professional', /\b(stakeholders?|deliverables?|q[1-4]\b|kpis?|roadmap|per our|proposal|quarterly|invoice|synergy|action items?)\b/i, 'a professional document: keep it polished and direct, with the same commitments and figures'],
  ['chat', /^(?:[^.!?\n]{0,120}[.!?]?\s*){1,3}$/, 'a short conversational message: keep it brief and natural']
];
export function detectContext(text) {
  const t = String(text || '').trim(); if (!t) return { kind: 'general', guide: '' };
  const words = t.split(/\s+/).length;
  for (const [kind, re, guide] of KINDS) {
    if (kind === 'chat' ? (words <= 45 && re.test(t)) : re.test(t)) return { kind, guide };
  }
  return { kind: words > 400 ? 'article' : 'general', guide: words > 400 ? 'a long article or explanation: keep every section and its order' : '' };
}

export const TONES = {
  keep: '',
  friendly: 'Tone: friendly and approachable.',
  confident: 'Tone: confident and direct; remove hedging only where the source is not actually uncertain.',
  formal: 'Tone: formal and respectful, without stiff or inflated wording.',
  warm: 'Tone: warm and considerate.',
  neutral: 'Tone: neutral and matter-of-fact.'
};
export const LENGTHS = {
  keep: '',
  shorter: 'Length: make it roughly 20 to 30 percent shorter by cutting filler and repetition only; keep every fact, name, number and qualification.',
  longer: 'Length: expand it modestly (about 20 to 30 percent) by clarifying and connecting ideas that are already there; add no new facts, examples, numbers or claims.'
};

/* extraGuides -> one string appended to the Humanizer request ('' when nothing extra is on). */
export function extraGuides({ text = '', tone = 'keep', length = 'keep', preserve = true, grammar = true, simplify = false } = {}) {
  const ctx = detectContext(text), out = [];
  if (ctx.guide) out.push('The text looks like ' + ctx.guide + '. Do not change its purpose.');
  if (TONES[tone]) out.push(TONES[tone]);
  if (LENGTHS[length]) out.push(LENGTHS[length]);
  out.push(preserve ? 'Preserve the original meaning strictly: if a change might alter what is claimed, keep the original wording.' : 'You may reorganise ideas more freely, but never change facts.');
  out.push(grammar ? 'Also fix any grammar, spelling and punctuation errors.' : 'Leave grammar and punctuation as written unless a sentence is unclear.');
  if (simplify) out.push('Simplify: replace complicated words and long sentences with plain ones, keeping technical terms that carry meaning.');
  out.push('Always return the complete rewritten text, never a summary, a partial section or an explanation.');
  return out.join(' ') + ' ';
}
