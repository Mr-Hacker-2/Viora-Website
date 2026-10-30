/* Humanizer clean-up. Models still leak a few tell-tale habits even when told not to:
   a "Here is the rewritten text:" preamble, wrapping quotes, markdown emphasis and em dashes.
   This removes them from the displayed rewrite. It never changes wording beyond that. */
const PREAMBLE = /^\s*(?:(?:sure|certainly|of course|okay|ok)[,!.]?\s*)?(?:here(?:'s|’s| is| are)\b[^\n:]{0,60}\b(?:rewrite|rewritten|rewording|revised|rephrased|version|humanized|humanised)\b[^\n:]{0,40}:|rewritten (?:text|version)\s*:|rewrite\s*:)\s*\n*/i;

export function cleanRewrite(text) {
  let s = String(text ?? '');
  if (!s) return '';
  s = s.replace(PREAMBLE, '');
  // Whole answer wrapped in one pair of quotes.
  const wrapped = s.match(/^\s*(["“])([\s\S]+)(["”])\s*$/);
  if (wrapped && !/["“”]/.test(wrapped[2])) s = wrapped[2];
  // Markdown emphasis and headings (this is plain-text output).
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/(^|[^\w*])\*([^*\n]+)\*(?![\w*])/g, '$1$2').replace(/^#{1,6}\s+/gm, '');
  // Em dashes, and spaced en dashes used as dashes (number ranges like 10-20 are untouched).
  s = s.replace(/\s*—\s*/g, ', ').replace(/\s+–\s+/g, ', ');
  s = s.replace(/,\s*,/g, ',').replace(/,\s*([.!?])/g, '$1').replace(/[ \t]{2,}/g, ' ');
  return s.trim();
}
