/* Humanizer "what changed" panel. These are measurements of the text itself, not an AI-detector score:
   detectors disagree with each other, so Viora does not pretend to know what any one of them will say. */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Stock words and phrases that language models overuse (the same list the Humanizer prompt is told to avoid). */
const STOCK = new RegExp('\\b(?:' + [
  'delv(?:e|es|ed|ing)', 'tapestry', 'landscape', 'realm', 'testament', 'pivotal', 'crucial', 'vital', 'robust',
  'seamless(?:ly)?', 'leverag(?:e|es|ed|ing)', 'utili[sz](?:e|es|ed|ing)', 'foster(?:s|ed|ing)?', 'underscor(?:e|es|ed|ing)',
  'multifaceted', 'nuanced', 'comprehensive', 'moreover', 'furthermore', 'additionally', 'in conclusion', 'overall',
  'it is important to note', 'it is worth noting', 'in today[\'’]s fast-paced world', 'plays? a crucial role'
].join('|') + ')\\b', 'gi');

const sentencesOf = t => String(t || '').split(/(?<=[.!?])["'”’)]*\s+|\n+/).map(s => s.trim()).filter(s => /\w/.test(s));
const wordsOf = t => (String(t || '').match(/[\w'’-]+/g) || []);

export function analyze(text) {
  const t = String(text || ''), sents = sentencesOf(t), lens = sents.map(s => wordsOf(s).length);
  const n = lens.length, mean = n ? lens.reduce((a, b) => a + b, 0) / n : 0;
  const spread = n > 1 ? Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / n) : 0;
  return {
    words: wordsOf(t).length, sentences: n, avgLen: mean, spread,
    stock: (t.match(STOCK) || []).length,
    dashes: (t.match(/—|\s–\s/g) || []).length
  };
}

const arrow = (a, b, fmt = x => String(x)) => `${fmt(a)} → ${fmt(b)}`;

/** HTML for the panel, or '' when there is nothing meaningful to compare. */
export function signalsHtml(before, after) {
  const b = String(before || '').trim(), a = String(after || '').trim();
  if (!a || !b || a === b) return '';
  const A = analyze(b), B = analyze(a), enough = A.sentences >= 3 && B.sentences >= 3;
  const items = [
    { k: 'Length', v: arrow(A.words, B.words) + ' words', good: null },
    { k: 'Sentence variety', v: enough ? arrow(A.spread, B.spread, x => x.toFixed(1)) : 'too short to measure', good: enough ? B.spread > A.spread : null, tip: 'How much sentence length varies (standard deviation in words). Real writing varies more than machine text.' },
    { k: 'AI-style phrases', v: arrow(A.stock, B.stock), good: A.stock || B.stock ? B.stock < A.stock || (B.stock === 0) : null, tip: 'Words models overuse, such as delve, crucial, moreover, leverage.' }
  ];
  if (A.dashes || B.dashes) items.push({ k: 'Em dashes', v: arrow(A.dashes, B.dashes), good: B.dashes < A.dashes || B.dashes === 0, tip: 'Em dashes are a common machine-writing habit.' });
  const chips = items.map(i => `<span class="hz-sig${i.good === true ? ' is-good' : ''}"${i.tip ? ` title="${esc(i.tip)}"` : ''}><b>${esc(i.k)}</b><span>${esc(i.v)}</span></span>`).join('');
  return `<div class="hz-sig-row">${chips}</div><p class="hz-sig-note">Measured from your text. This is not an AI-detector score; detectors disagree with each other.</p>`;
}
