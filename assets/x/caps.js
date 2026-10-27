/* Viora capability registry — the ONE place that says what each assistant can take as input.
   Nothing else in the front end should hard-code "assistant X can/can't read images".
   NOTE: the chat server (viora-auth-website) decides which underlying model answers; these flags
   describe the Viora assistants as the product ships them and must be kept in sync with that server.
   Short MP4 clips can use native video+audio understanding; larger clips fall back to timestamped still frames. */
export const CAPS = {
  auto:     { text: 1, image: 1, video: 1, docs: 1, audio: 0 },
  flash:    { text: 1, image: 1, video: 1, docs: 1, audio: 0 },
  search:   { text: 1, image: 1, video: 1, docs: 1, audio: 0 },
  math:     { text: 1, image: 1, video: 1, docs: 1, audio: 0 },
  human:    { text: 1, image: 0, video: 0, docs: 1, audio: 0 }
};
export const FALLBACK = 'flash';
const NEED = { image: 'images', video: 'video frames' };

/** What the visual attachments of a chat require of the assistant. */
export function needs(files) {
  const n = new Set();
  for (const f of files || []) { if ((f.kind === 'image' || f.kind === 'file') && (f.ni || 0) > 0) n.add('image'); if (f.kind === 'video' && ((f.ni || 0) > 0 || f.nativeVideo)) n.add('video'); }
  return [...n];
}
/** Keep the user's chosen assistant when it can do the job; otherwise switch to a compatible one and say why. */
export function pick(assistant, files, names) {
  const req = needs(files);
  const known = Object.prototype.hasOwnProperty.call(CAPS, assistant);
  const can = known ? CAPS[assistant] : null;
  const missing = known ? req.filter(k => !can[k]) : req;
  if (known && !missing.length) return { assistant, switched: false };
  const to = FALLBACK;
  const why = !known
    ? `${names?.[assistant] || assistant || 'That assistant'} is unavailable; switching to ${names?.[to] || to}.`
    : `${names?.[assistant] || assistant} can't read ${missing.map(k => NEED[k]).join(' or ')}`;
  return { assistant: to, switched: assistant !== to, from: assistant, to, why };
}
