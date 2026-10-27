/* Viora router: task classification, capability-aware fallback chains and provider health.
   Pure functions (no DOM) so they are unit-tested in Node. Capabilities come ONLY from caps.js.
   The chat server decides which underlying model answers; this module chooses the Viora assistant. */
import { CAPS, FALLBACK, needs } from './caps.js';

const R = {
  human: /humani[sz]e|paraphrase|rewrite this|sound (more )?(human|natural)|make this (sound )?(more )?natural/,
  fence: /```|traceback|stack ?trace|\b(type|syntax|name|reference|value)error\b|undefined is not|segmentation fault|\bexception\b/,
  snippet: /^\s*(?:for\s+\w+\s+in\b|(?:def|class|function)\s+\w+|(?:const|let|var)\s+\w+\s*=|(?:print|console\.log)\s*\()/m,
  loopSyntax: /\bfor\s*\([^)]*;[^)]*;[^)]*\)\s*\{?/,
  lang: /\b(python|javascript|typescript|java|c\+\+|c#|rust|golang|sql|regex|html|css|bash|react|node\.?js|json|api)\b/,
  codeIntent: /\b(bug|debug|compile|refactor|algorithm|big-o|unit tests?|my code|this code|the code|source code|write (a |an |some )?(\w+ )?(function|script|program|class|query))\b/,
  math: /\b(solve|equation|integral|derivative|calculate|simplify|factori[sz]e|probability of|prove|evaluate|convert units?)\b|\d\s*[\^*/+\-]\s*\d|\d+\s?% of\b/,
  fresh: /\b(latest|news|today|tonight|currently|right now|this (week|month|year|weekend)|recent(ly)?|most recent|price of|who won|scores?|stocks?|weather|forecast|trending|election|near me|release date|202\d|research|sources|citations?|fact.?check|verify|verification|evidence|studies|papers?|peer.?reviewed|references|according to|is it true|cross.?check|compare sources)\b|\bwho is (the )?(current|new)\b|\bwho is the (ceo|president|prime minister|mayor|coach)\b|\bcompare\b.*\b(newest|best|reviews?|vs|versus)\b|\bnewest\b/,
  explicitWeb: /\b(search|look up|online|on the web|latest news|fact.?check|verify|cross.?check|find sources|with citations|research this)\b/
};

/** Decide which assistant fits a message. Returns { assistant, reason }. */
export function classify(text, { hasPage = false, hasVisual = false } = {}) {
  const x = String(text || '').toLowerCase();
  // Do not route visual questions to the text-only humanizer.
  if (R.human.test(x) && !hasVisual) return { assistant: 'human', reason: 'rewriting request' };
  if (R.human.test(x) && hasVisual) return { assistant: 'flash', reason: 'visual attachment requires vision' };
  if (R.explicitWeb.test(x)) return { assistant: 'search', reason: 'explicit research request' };
  if (R.fence.test(x) || R.snippet.test(x) || R.loopSyntax.test(x) || R.codeIntent.test(x) || (R.lang.test(x) && /\b(write|fix|why|how (do|to|can)|error|query|snippet)\b/.test(x))) return { assistant: 'math', reason: 'code signals' };
  if (R.math.test(x)) return { assistant: 'math', reason: 'math signals' };
  const aboutFile = hasPage && !R.explicitWeb.test(x);
  if (!aboutFile && R.fresh.test(x)) return { assistant: 'search', reason: 'needs current information' };
  return { assistant: 'flash', reason: 'general conversation' };
}

/** Use web search only for explicit research mode or prompts classified as needing fresh evidence. */
export function shouldSearch(text, { assistant = 'auto', enabled = true, hasPage = false, hasVisual = false } = {}) {
  if (!enabled || assistant === 'human') return false;
  return assistant === 'search' || classify(text, { hasPage, hasVisual }).assistant === 'search';
}

/* Provider health: a small circuit breaker. Three failures in a row open it for 60 s. */
export class Health {
  constructor({ threshold = 3, cooldownMs = 60000, now = () => Date.now() } = {}) { Object.assign(this, { threshold, cooldownMs, now }); this.s = {}; }
  ok(a) { this.s[a] = { fails: 0, until: 0 }; }
  fail(a) { const e = this.s[a] || (this.s[a] = { fails: 0, until: 0 }); e.fails++; if (e.fails >= this.threshold) e.until = this.now() + this.cooldownMs; }
  healthy(a) { const e = this.s[a]; return !e || e.until <= this.now(); }
}

const PREFER = { auto: ['flash'], flash: ['flash', 'math'], search: ['search', 'flash'], math: ['math', 'flash'], human: ['human', 'flash'] };

/** Ordered assistants to try. Only assistants whose declared capabilities cover the attachments are included.
    Unhealthy ones are skipped unless nothing else is left. Never returns an empty list. */
export function chain(assistant, files, health) {
  const req = needs(files);
  const capable = a => req.every(k => (CAPS[a] || {})[k]);
  let list = [...new Set([assistant, ...(PREFER[assistant] || []), FALLBACK])].filter(capable);
  if (!list.length) list = [FALLBACK];
  const up = list.filter(a => !health || health.healthy(a));
  return up.length ? up : [list[list.length - 1]];
}

/** Errors worth trying another assistant for (server trouble), as opposed to user errors. */
export const shouldFallback = (status, err) => err ? err.name !== 'AbortError' : [408, 425, 429].includes(status) || status >= 500;
