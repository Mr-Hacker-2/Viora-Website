const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu;
const LEAD_IN = /^(?:(?:i need to|i want to|tell me about|how can i)\s+)/i;
const TITLE_SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

function titleCase(words) {
  return words.map((word, i) => {
    if (/^[A-Z0-9]{2,}$/.test(word)) return word;
    const lower = word.toLowerCase();
    return i > 0 && TITLE_SMALL.has(lower) ? lower : lower[0].toUpperCase() + lower.slice(1);
  }).join(' ');
}

export function fallbackTitle(message, attachmentNames = []) {
  let source = String(message || '').slice(0, 1200).replace(/```[\s\S]*?```/g, ' code sample ').replace(/https?:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim();
  source = source.replace(/^(?:(?:can|could|would) you\s+)?(?:please\s+)?(?:help me\s+)?/i, '').replace(LEAD_IN, '');
  let words = source.match(WORD) || [];
  if (!words.length && attachmentNames.length) {
    const name = String(attachmentNames[0] || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    words = ['Discuss', ...(name.match(WORD) || [])];
  }
  if (!words.length) return 'New Conversation';
  if (words.length < 3) words = ['Chat', 'About', ...words];
  return titleCase(words.slice(0, 7));
}

export function normalizeGeneratedTitle(raw, fallback = 'New Conversation') {
  const line = String(raw || '').split(/\r?\n/)[0]
    .replace(/^\s*(?:title\s*:\s*)?/i, '')
    .replace(/^[\s"'“”‘’`#*]+|[\s"'“”‘’`#*]+$/g, '')
    .replace(/[.!?:]+$/, '').trim();
  const words = line.match(WORD) || [];
  if (words.length < 3) return fallback;
  const short = words.slice(0, 7);
  while (short.length > 3 && TITLE_SMALL.has(short.at(-1).toLowerCase())) short.pop();
  return titleCase(short).slice(0, 60).trim() || fallback;
}

export function shouldGenerateTitle(conversation) {
  return !!conversation && conversation.autoTitle === true && conversation.titleManual !== true
    && conversation.titleGenerated !== true && conversation.titleGenerationStarted !== true
    && !conversation.titlePending && (conversation.messages || []).filter(m => m?.role === 'user').length === 1;
}

export function renameConversation(conversation, value) {
  const title = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!conversation || !title) return false;
  conversation.title = title;
  conversation.titleManual = true;
  conversation.autoTitle = false;
  conversation.titlePending = false;
  conversation.titleGenerated = true;
  return true;
}

export function finishTitleGeneration(conversation, raw, fallback) {
  if (!conversation) return false;
  const canUpdate = conversation.autoTitle === true && conversation.titleManual !== true;
  if (canUpdate) conversation.title = raw ? normalizeGeneratedTitle(raw, fallback) : fallback;
  conversation.titlePending = false;
  conversation.titleGenerated = true;
  return canUpdate;
}
