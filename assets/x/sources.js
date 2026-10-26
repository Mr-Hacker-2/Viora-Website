/* Viora shared web-source rendering: favicons, source cards, citation chips.
   Every feature that shows web sources (search results, Deep Search reports, citations, attached
   pages) goes through this file, so they all get the same behaviour.

   Favicon policy (privacy-conscious, see README "Favicons"):
     1. an icon URL supplied by the search provider (only if it is https and belongs to the same
        registrable domain as the source, or to a host listed in config.trustedIconHosts);
     2. otherwise the configurable icon service (config.service, default DuckDuckGo's), asked for the
        EXACT hostname so a subdomain such as user.github.io never borrows github.com's icon;
     3. otherwise (or if every image fails) a neutral globe icon. Nothing is ever guessed or invented.
   Set window.VIORA_FAVICON = { service: '' } before this module loads to disable the third-party
   service entirely (provider icons and the globe fallback are then all that is used).
   Icons are plain <img> tags (a browser never runs script from an image), with
   referrerpolicy=no-referrer, loading=lazy and no credentials. */

const DEFAULTS = {
  service: 'https://icons.duckduckgo.com/ip3/{domain}.ico', // {domain} is replaced by the exact hostname
  trustedIconHosts: [],                                     // extra hosts whose provider icons are accepted
  badTtlMs: 24 * 3600e3                                     // remember failed icons this long
};
export const config = Object.assign({}, DEFAULTS, (typeof window !== 'undefined' && window.VIORA_FAVICON) || {});

const SLD = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'or', 'ne']);
const KNOWN = { 'youtube.com': 'YouTube', 'youtu.be': 'YouTube', 'github.com': 'GitHub', 'wikipedia.org': 'Wikipedia', 'stackoverflow.com': 'Stack Overflow', 'nytimes.com': 'The New York Times', 'bbc.com': 'BBC', 'bbc.co.uk': 'BBC', 'reddit.com': 'Reddit', 'x.com': 'X', 'twitter.com': 'X', 'mozilla.org': 'MDN / Mozilla', 'arxiv.org': 'arXiv', 'nih.gov': 'NIH', 'who.int': 'WHO' };

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Parse a source URL. Returns null for anything that is not a plain http(s) URL. */
export function parseUrl(u) {
  try {
    const x = new URL(String(u).trim());
    if (x.protocol !== 'http:' && x.protocol !== 'https:') return null;
    if (!x.hostname || x.username || x.password) return null;
    return x;
  } catch { return null; }
}
export const hostOf = u => { const x = parseUrl(u); return x ? x.hostname.replace(/^www\./, '').toLowerCase() : ''; };
/** Registrable domain (heuristic, no public-suffix list): en.wikipedia.org -> wikipedia.org, a.bbc.co.uk -> bbc.co.uk */
const HOSTING = new Set(['github.io', 'gitlab.io', 'pages.dev', 'netlify.app', 'vercel.app', 'herokuapp.com', 'blogspot.com', 'wordpress.com', 'web.app', 'firebaseapp.com', 'onrender.com', 'fly.dev', 'workers.dev']);
export function baseDomain(host) {
  const p = host.split('.'); if (p.length <= 2) return host;
  if (HOSTING.has(p.slice(-2).join('.'))) return p.slice(-3).join('.'); // user.github.io is its own site
  const tld = p[p.length - 1], sld = p[p.length - 2];
  return (tld.length === 2 && SLD.has(sld) ? p.slice(-3) : p.slice(-2)).join('.');
}
export function siteName(host, given) {
  if (given && typeof given === 'string' && given.length < 60) return given;
  const b = baseDomain(host); if (KNOWN[b]) return KNOWN[b];
  const w = b.split('.')[0] || host; return w.charAt(0).toUpperCase() + w.slice(1);
}

/* ---- failure memory: remember icons that failed so we do not retry them on every re-render ---- */
const bad = (() => { try { const o = JSON.parse(localStorage.getItem('viora_favbad') || '{}'), now = Date.now(); for (const k in o) if (now - o[k] > config.badTtlMs) delete o[k]; return o; } catch { return {}; } })();
const good = new Map(); // host -> url that loaded; reused so re-renders show the icon instantly
const markBad = u => { bad[u] = Date.now(); try { localStorage.setItem('viora_favbad', JSON.stringify(bad)); } catch {} };

/** Ordered, de-duplicated list of icon URLs to try for a source. */
export function iconCandidates(src) {
  const x = parseUrl(src && src.url); if (!x) return [];
  const host = x.hostname.replace(/^www\./, '').toLowerCase(), out = [];
  if (good.has(host)) out.push(good.get(host));
  const given = src.favicon || src.icon, gx = given && parseUrl(given);
  if (gx && gx.protocol === 'https:') {
    const gh = gx.hostname.replace(/^www\./, '').toLowerCase();
    if (baseDomain(gh) === baseDomain(host) || config.trustedIconHosts.includes(gh)) out.push(gx.href);
  }
  if (config.service && /\{domain\}/.test(config.service)) out.push(config.service.replace('{domain}', encodeURIComponent(host)));
  return [...new Set(out)].filter(u => !bad[u]);
}

const GLOBE = '<svg class="vfav-fb" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3z"/></svg>';
/** The favicon element for a source: an <img> that walks its candidate list, or the globe. */
export function iconHtml(src, size = 18) {
  const c = iconCandidates(src);
  if (!c.length) return `<span class="vfav" style="--s:${size}px">${GLOBE}</span>`;
  return `<span class="vfav" style="--s:${size}px">${GLOBE}<img class="vfav-img" src="${esc(c[0])}" data-c="${esc(JSON.stringify(c.slice(1)))}" data-h="${esc(hostOf(src.url))}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>`;
}
/* <img> error events do not bubble, so listen in the capture phase once for the whole page. */
if (typeof document !== 'undefined') {
  document.addEventListener('error', e => {
    const im = e.target; if (!im || !im.classList || !im.classList.contains('vfav-img')) return;
    markBad(im.getAttribute('src'));
    let rest = []; try { rest = JSON.parse(im.dataset.c || '[]'); } catch {}
    const next = rest.find(u => !bad[u]);
    if (next) { im.dataset.c = JSON.stringify(rest.filter(u => u !== next)); im.src = next; }
    else im.remove(); // leaves the globe underneath
  }, true);
  document.addEventListener('load', e => {
    const im = e.target; if (!im || !im.classList || !im.classList.contains('vfav-img')) return;
    // Some icon services answer with a 1x1 / empty image instead of a 404: treat that as "no icon".
    if (im.naturalWidth < 8 || im.naturalHeight < 8) { im.dispatchEvent(new Event('error')); return; }
    good.set(im.dataset.h, im.getAttribute('src')); im.classList.add('ok');
  }, true);
}

/** One source as a card: [icon] Site · domain · [n] / title / snippet. Clickable. */
export function cardHtml(src, n) {
  const x = parseUrl(src && src.url), title = (src && src.title) || '', snip = (src && (src.snippet || src.description)) || '';
  if (!x) return `<div class="src-card src-dead" title="This source has no valid web address"><span class="src-top">${iconHtml({})}<span class="src-site">Unavailable source</span></span><span class="src-title">${esc(title || 'Invalid link')}</span></div>`;
  const host = x.hostname.replace(/^www\./, '').toLowerCase();
  return `<a class="src-card" href="${esc(x.href)}" target="_blank" rel="noopener noreferrer nofollow" title="${esc(title || x.href)}">` +
    `<span class="src-top">${iconHtml(src)}<span class="src-site">${esc(siteName(host, src.site))}</span><span class="src-dom">${esc(baseDomain(host))}</span>${n ? `<span class="src-n">${n}</span>` : ''}</span>` +
    `<span class="src-title">${esc(title || host)}</span>${snip ? `<span class="src-snip">${esc(String(snip).slice(0, 180))}</span>` : ''}</a>`;
}
/** Compact chip (icon + domain), used for attachments and in-line lists. */
export function chipHtml(src, n) {
  const x = parseUrl(src && src.url); if (!x) return '';
  const host = x.hostname.replace(/^www\./, '').toLowerCase();
  return `<a class="chip src-chip" href="${esc(x.href)}" target="_blank" rel="noopener noreferrer nofollow" title="${esc((src.title || '') || x.href)}">${iconHtml(src, 14)}${n ? `<span class="chip-num">${n}</span>` : ''}<span class="chip-host">${esc(host)}</span></a>`;
}
/** The whole "Searched the web" block, shared by every feature that cites sources. */
export function sourcesBlock(srcs, label = 'Searched the web') {
  const list = (srcs || []).filter(Boolean); if (!list.length) return '';
  const stack = list.slice(0, 5).map(s => iconHtml(s, 16)).join('');
  return `<details class="sources src-block" open><summary class="sources-head"><span class="src-stack">${stack}</span><span>${esc(label)} · ${list.length} source${list.length === 1 ? '' : 's'}</span></summary><div class="src-grid">${list.map((s, i) => cardHtml(s, i + 1)).join('')}</div></details>`;
}
/** Put a small favicon in front of in-text citation links ([1], [2] ...) that point at a known source. */
export function decorateCitations(el, srcs) {
  if (!el || !srcs || !srcs.length) return;
  const by = new Map(srcs.map(s => { const x = parseUrl(s.url); return x ? [x.href, s] : null; }).filter(Boolean));
  el.querySelectorAll('a[href]').forEach(a => {
    if (a.dataset.vc) return; const s = by.get(a.href); if (!s) return; a.dataset.vc = '1'; a.classList.add('cite');
    a.insertAdjacentHTML('afterbegin', iconHtml(s, 13)); a.title = (s.title || hostOf(s.url)) + ' — ' + hostOf(s.url);
    a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
  });
}


/** Keep only source records with safe, usable HTTP(S) links; never repair or invent URLs. */
export function cleanSources(srcs) {
  if (!Array.isArray(srcs)) return [];
  const seen = new Set(), out = [];
  for (const item of srcs) {
    if (!item || typeof item !== 'object' || !parseUrl(item.url)) continue;
    const url = parseUrl(item.url).href;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ ...item, url });
    if (out.length >= 30) break;
  }
  return out;
}

/** Audit numbered references against the actual source list, without judging claim truth. */
export function auditCitations(content, srcs, research = false) {
  const valid = cleanSources(srcs);
  const nums = [...String(content || '').matchAll(/\[(\d{1,2})\]/g)].map(m => Number(m[1]));
  const referenced = [...new Set(nums)];
  const unresolved = referenced.filter(n => n < 1 || n > valid.length);
  return {
    sourceCount: valid.length,
    referencedCount: referenced.length,
    unresolved,
    missingResearchSources: Boolean(research && !valid.length && referenced.length),
    hasIssue: unresolved.length > 0 || Boolean(research && !valid.length && referenced.length)
  };
}
