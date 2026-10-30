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

/* Facts a rewrite must carry over unchanged: numbers, links, emails, citations and names. */
const FACT_RE = {
  url: /\bhttps?:\/\/[^\s)\]>"']+|\bwww\.[^\s)\]>"']+/gi,
  email: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
  cite: /\[\d+(?:[,–-]\s*\d+)*\]|\([A-Z][A-Za-z'’-]+(?: et al\.?| (?:and|&) [A-Z][A-Za-z'’-]+)?,? \d{4}[a-z]?\)/g,
  number: /(?<![\w.])[$€£]?\d(?:[\d,]*\d)?(?:\.\d+)?%?/g
};
const normNum = n => n.replace(/[$€£,]/g, '').replace(/\.0+(?=%?$)/, '');
const trimEnd = u => u.replace(/[.,;:!?]+$/, '');
/* Blank out links and emails but keep any sentence-ending punctuation they swallowed. */
const blank = t => t.replace(FACT_RE.url, u => ' ' + u.slice(trimEnd(u).length)).replace(FACT_RE.email, ' ');
/** Capitalised words that are not at the start of a sentence (names, places, products, acronyms). */
function namesOf(t) {
  const out = new Set();
  for (const sent of sentencesOf(t)) {
    const words = sent.split(/\s+/);
    words.forEach((w, i) => {
      const clean = w.replace(/^[^\w]+|[^\w]+$/g, '').replace(/['’]s$/, '');
      if (i === 0 || clean.length < 2 || /^I['’]/.test(clean) || !/^[A-Z]/.test(clean)) return;
      out.add(clean);
    });
  }
  return out;
}
function factsOf(t) {
  t = String(t || '');
  const f = new Map();
  for (const u of t.match(FACT_RE.url) || []) f.set('u:' + trimEnd(u).toLowerCase(), trimEnd(u));
  for (const e of t.match(FACT_RE.email) || []) f.set('e:' + e.toLowerCase(), e);
  for (const c of t.match(FACT_RE.cite) || []) f.set('c:' + c.replace(/\s+/g, ' '), c);
  const bare = blank(t);
  for (const n of bare.match(FACT_RE.number) || []) f.set('n:' + normNum(n), n);
  for (const name of namesOf(bare)) f.set('w:' + name, name);
  return f;
}
/** Which facts from the draft are missing from the rewrite, and which numbers the rewrite made up. */
export function factCheck(before, after) {
  const A = factsOf(before), B = factsOf(after), low = String(after || '').toLowerCase();
  const has = (k, v) => B.has(k) || (k[0] === 'w' ? new RegExp('\\b' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(after) : k[0] !== 'n' && low.includes(v.toLowerCase()));
  const lost = [...A].filter(([k, v]) => !has(k, v)).map(([, v]) => v);
  const missing = lost.filter(v => !lost.some(o => o !== v && o.includes(v)));
  const added = [...B].filter(([k]) => k[0] === 'n' && !A.has(k)).map(([, v]) => v);
  return { total: A.size, kept: A.size - lost.length, missing, added };
}

/** Share of the rewrite's words that are new or moved compared with the draft (0 to 1). */
export function rewriteDepth(before, after) {
  const a = wordsOf(String(before || '').toLowerCase()), b = wordsOf(String(after || '').toLowerCase());
  if (!b.length) return 0;
  if (!a.length) return 1;
  let common;
  if (a.length * b.length <= 4e6) {
    let prev = new Uint32Array(b.length + 1);
    for (let i = 1; i <= a.length; i++) {
      const row = new Uint32Array(b.length + 1);
      for (let j = 1; j <= b.length; j++) row[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], row[j - 1]);
      prev = row;
    }
    common = prev[b.length];
  } else {
    const bag = new Map(); a.forEach(w => bag.set(w, (bag.get(w) || 0) + 1));
    common = b.reduce((n, w) => (bag.get(w) > 0 ? (bag.set(w, bag.get(w) - 1), n + 1) : n), 0);
  }
  return 1 - common / b.length;
}
const list = xs => xs.slice(0, 6).map(x => `“${x}”`).join(', ') + (xs.length > 6 ? ` and ${xs.length - 6} more` : '');

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
  const depth = rewriteDepth(b, a), facts = factCheck(b, a);
  items.splice(1, 0, { k: 'Words changed', v: Math.round(depth * 100) + '%', good: null, tip: 'Share of the rewrite that is new or reordered compared with your draft.' });
  if (facts.total) items.push({ k: 'Facts kept', v: facts.kept + ' of ' + facts.total, good: !facts.missing.length, warn: !!facts.missing.length, tip: 'Numbers, names, links and citations from your draft that also appear in the rewrite.' });
  if (facts.added.length) items.push({ k: 'New numbers', v: String(facts.added.length), warn: true, tip: 'Numbers in the rewrite that are not in your draft.' });
  if (A.dashes || B.dashes) items.push({ k: 'Em dashes', v: arrow(A.dashes, B.dashes), good: B.dashes < A.dashes || B.dashes === 0, tip: 'Em dashes are a common machine-writing habit.' });
  const chips = items.map(i => `<span class="hz-sig${i.good === true ? ' is-good' : ''}${i.warn ? ' is-warn' : ''}"${i.tip ? ` title="${esc(i.tip)}"` : ''}><b>${esc(i.k)}</b><span>${esc(i.v)}</span></span>`).join('');
  const warn = [
    facts.missing.length ? `In your draft but not the rewrite: ${esc(list(facts.missing))}.` : '',
    facts.added.length ? `Not in your draft: ${esc(list(facts.added))}.` : ''
  ].filter(Boolean).join(' ');
  return `<div class="hz-sig-row">${chips}</div>${warn ? `<p class="hz-sig-warn" role="note">Check before using. ${warn}</p>` : ''}<p class="hz-sig-note">Measured from your text. This is not an AI-detector score; detectors disagree with each other.</p>`;
}
