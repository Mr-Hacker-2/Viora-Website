/* Humanizer: long documents and the completeness rule. Pure helpers (no DOM).

   splitDocument  cuts an essay into sections at paragraph boundaries, in order, so that joining the sections with a blank line gives back
                  exactly the paragraphs of the original. A paragraph longer than the limit is cut at sentence ends.
   minWordsFor    the shortest rewrite that still counts as complete. Rewrites may be shorter or longer than the draft; the floor only
                  exists to catch a response that stopped halfway, so it is lower when the person asked for a shorter text. */
export const CHUNK_WORDS = 900, SINGLE_LIMIT = 1100;
const count = t => (String(t || '').match(/\S+/g) || []).length;

export function splitDocument(text, maxWords = CHUNK_WORDS) {
  const paras = String(text || '').replace(/\r\n?/g, '\n').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const pieces = [];
  for (const p of paras) {
    if (count(p) <= maxWords) { pieces.push(p); continue; }
    let cur = '';
    for (const s of p.split(/(?<=[.!?]["'”’)]*)\s+/)) {
      if (cur && count(cur) + count(s) > maxWords) { pieces.push(cur); cur = ''; }
      cur += (cur ? ' ' : '') + s;
    }
    if (cur) pieces.push(cur);
  }
  const out = []; let cur = [];
  for (const p of pieces) {
    if (cur.length && count(cur.join('\n\n')) + count(p) > maxWords) { out.push(cur.join('\n\n')); cur = []; }
    cur.push(p);
  }
  if (cur.length) out.push(cur.join('\n\n'));
  return out;
}
export const needsChunks = text => count(text) > SINGLE_LIMIT;

export function minWordsFor(sourceWords, { style = '', length = 'keep', mode = '' } = {}) {
  if (!sourceWords) return 0;
  const shorter = style === 'concise' || length === 'shorter';
  const ratio = shorter ? 0.3 : (mode === 'grammar' || mode === 'light' || mode === 'voice') ? 0.75 : 0.5;
  return Math.min(sourceWords, Math.max(1, Math.ceil(sourceWords * ratio)));
}

/* One sentence added to the request for each section of a long text. */
export const partNote = (i, n) => 'This is section ' + (i + 1) + ' of ' + n + ' of one longer document. Rewrite only this section, completely. Keep the same voice, terminology and tense as the rest of the document, and do not add an introduction, a conclusion or a summary. Keep headings and list items as they are. ';
