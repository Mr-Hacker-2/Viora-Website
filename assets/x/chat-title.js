const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu;
const LEAD_IN = /^(?:(?:i need to|i want to|tell me about|how can i)\s+)/i;
const TITLE_SMALL = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'but', 'by', 'for', 'in', 'is', 'of', 'on', 'or', 'the', 'to', 'what', 'with']);
const GENERIC = new Set('a an and are as at be because can could do does for from have help how i if in is it me my need of on or our please tell that the this to want was we what when where which who why about with would you your something anything thing stuff'.split(' '));

function titleCase(words) {
  return words.map((word, i) => {
    if (/^[A-Z0-9]{2,}$/.test(word)) return word;
    const lower = word.toLowerCase();
    return i > 0 && TITLE_SMALL.has(lower) ? lower : lower[0].toUpperCase() + lower.slice(1);
  }).join(' ');
}

export function fallbackTitle(message, attachmentNames = [], assistantReply = '') {
  let source = String(message || '').slice(0, 1200).replace(/```[\s\S]*?```/g, ' code sample ').replace(/https?:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim();
  source = source.replace(/^(?:(?:can|could|would) you\s+)?(?:please\s+)?(?:help me\s+)?/i, '').replace(LEAD_IN, '');
  let words = (source.match(WORD) || []).filter(w => !GENERIC.has(w.toLowerCase()));
  if (words.length < 3 && assistantReply) {
    const replyWords = String(assistantReply).slice(0, 1200).replace(/```[\s\S]*?```/g, ' code ').replace(/https?:\/\/\S+/gi, ' ').match(WORD) || [];
    words = [...words, ...replyWords.filter(w => !GENERIC.has(w.toLowerCase()))];
  }
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
  if (/^(?:chat|conversation|new chat|new conversation|general question|untitled|something)(?:\s|$)/i.test(short.join(' '))) return fallback;
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
