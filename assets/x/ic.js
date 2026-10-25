/**
 * Viora AI — icon set and emoji replacement.
 * ic(name) returns an inline SVG. startDeemoji() swaps any emoji that shows up on the page for the
 * matching icon (or drops it), so the Viora tab, its Notebook and Settings never show emoji.
 */
const P = {
  link: 'M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1 1M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1-1',
  note: 'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5M9 13h6M9 17h6',
  clipboard: 'M9 4h6v3H9zM8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-2M8 12h8M8 16h5',
  cap: 'M2 9l10-5 10 5-10 5zM6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5',
  help: 'M12 22a10 10 0 100-20 10 10 0 000 20zM9.5 9a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.5M12 17h.01',
  scissors: 'M6 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12',
  clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
  check: 'M5 12l5 5L20 7',
  scale: 'M12 3v18M5 21h14M5 7l-3 8a4 4 0 006 0zM19 7l-3 8a4 4 0 006 0zM5 7h14',
  mail: 'M3 5h18v14H3zM3 7l9 7 9-7',
  globe: 'M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  speaker: 'M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z',
  download: 'M12 3v12M7 11l5 5 5-5M4 21h16',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  undo: 'M3 7v6h6M3 13a9 9 0 105-8.5',
  plus: 'M12 5v14M5 12h14',
  layers: 'M12 2l10 5-10 5L2 7zM2 12l10 5 10-5M2 17l10 5 10-5',
  stop: 'M6 6h12v12H6z',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  bot: 'M12 8V4M8 4h8M5 8h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2zM9 14h.01M15 14h.01',
  folder: 'M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  chat: 'M21 12a8 8 0 01-11.6 7.1L3 21l1.9-6.4A8 8 0 1121 12z',
  book: 'M4 5a2 2 0 012-2h5v18H6a2 2 0 01-2-2zM20 5a2 2 0 00-2-2h-5v18h5a2 2 0 002-2z',
  plug: 'M9 2v6M15 2v6M6 8h12v4a6 6 0 01-12 0zM12 18v4',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  close: 'M6 6l12 12M18 6L6 18',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  panel: 'M3 4h18v16H3zM9 4v16',
  back: 'M19 12H5M11 6l-6 6 6 6',
  notebook: 'M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6zM6 3v18M10 8h6M10 12h6',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  terminal: 'M4 17l6-6-6-6M12 19h8',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  target: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z',
  shield: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z',
  camera: 'M4 7h3l2-3h6l2 3h3v13H4zM12 17a4 4 0 100-8 4 4 0 000 8z',
  warn: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  star: 'M12 2l3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z',
  heart: 'M12 21s-8-5.3-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.7-8 11-8 11z',
  dot: 'M12 12h.01'
};
export const ICON_NAMES = Object.keys(P);

export function ic(name, cls = '') {
  const d = P[name] || P.dot;
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

// emoji / pictograph -> icon name ('' means drop it)
const MAP = {
  '🔗': 'link', '📝': 'note', '📋': 'clipboard', '🎓': 'cap', '❓': 'help', '❔': 'help', '✂': 'scissors', '🕒': 'clock', '⏰': 'clock', '⏱': 'clock',
  '✅': 'check', '✔': 'check', '☑': 'check', '⚖': 'scale', '✉': 'mail', '📧': 'mail', '📰': 'note', '📄': 'note', '📃': 'note', '📑': 'note',
  '🌐': 'globe', '🔍': 'search', '🔎': 'search', '👁': 'eye', '🔊': 'speaker', '🔈': 'speaker', '✨': 'sparkle', '✦': 'sparkle', '🧠': 'sparkle',
  '🧪': 'sparkle', '🎨': 'sparkle', '💡': 'sparkle', '✎': 'edit', '✏': 'edit', '⬇': 'download', '📥': 'download', '📤': 'upload', '↶': 'undo',
  '＋': 'plus', '▤': 'layers', '■': 'stop', '⏹': 'stop', '⚡': 'bolt', '🚀': 'bolt', '🤖': 'bot', '📁': 'folder', '📂': 'folder', '🏠': 'home',
  '💬': 'chat', '📚': 'book', '📖': 'book', '🔌': 'plug', '🧩': 'plug', '👤': 'user', '⚙': 'gear', '🛠': 'gear', '🔧': 'gear', '💻': 'terminal',
  '📊': 'chart', '📈': 'chart', '🎯': 'target', '🛡': 'shield', '📷': 'camera', '📸': 'camera', '⚠': 'warn', '⭐': 'star', '★': 'star', '❤': 'heart',
  '❌': 'close', '✖': 'close', '🗑': 'trash', '📎': 'link', '📌': 'dot'
};
const KEEP = /^[\u00A9\u00AE\u2122\u2139\u2194-\u21AA]/;
const EMOJI = /(?:\p{Extended_Pictographic}|[✦✎⬇↶＋▤■])(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*|[0-9#*]\uFE0F?\u20E3/gu;

/** Pure: split text into [{ text } | { icon }] pieces (icon '' = removed). */
export function splitEmoji(text) {
  const out = [];
  let last = 0;
  const s = String(text ?? '');
  for (const m of s.matchAll(EMOJI)) {
    if (KEEP.test(m[0]) && !MAP[m[0].replace(/\uFE0F/g, '')]) continue;
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    const base = m[0].replace(/\uFE0F/g, '');
    out.push({ icon: MAP[base] ?? MAP[[...base][0]] ?? '' });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE', 'svg', 'SVG', 'NOSCRIPT']);
function skipNode(n) {
  for (let e = n.parentElement; e; e = e.parentElement) {
    if (SKIP.has(e.tagName) || e.isContentEditable || e.hasAttribute?.('data-keep-emoji')) return true;
  }
  return false;
}

function fixText(node) {
  const v = node.nodeValue;
  if (!v || !/[^\u0000-\u00A8]/.test(v)) return;
  const parts = splitEmoji(v);
  if (parts.length === 1 && parts[0].text !== undefined) return;
  if (skipNode(node)) return;
  const frag = document.createDocumentFragment();
  for (const p of parts) {
    if (p.text !== undefined) frag.append(document.createTextNode(p.text));
    else if (p.icon) {
      const t = document.createElement('template');
      t.innerHTML = ic(p.icon);
      frag.append(t.content.firstChild);
    }
  }
  node.replaceWith(frag);
}

function sweep(root) {
  if (root.nodeType === 3) return fixText(root);
  if (root.nodeType !== 1) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const list = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) list.push(n);
  list.forEach(fixText);
}

export function startDeemoji(root = document.documentElement) {
  sweep(root);
  const pending = new Set();
  let queued = false;
  const flush = () => { queued = false; const items = [...pending]; pending.clear(); items.forEach((n) => { if (n.isConnected) sweep(n); }); };
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') pending.add(m.target);
      else m.addedNodes.forEach((n) => pending.add(n));
    }
    if (!queued) { queued = true; requestAnimationFrame(flush); }
  }).observe(root, { childList: true, subtree: true, characterData: true });
}
