/* Viora capability registry — the ONE place that says what each assistant can take as input.
   Nothing else in the front end should hard-code "assistant X can/can't read images".
   NOTE: the chat server (viora-auth-website) decides which underlying model answers; these flags
   describe the Viora assistants as the product ships them and must be kept in sync with that server.
   "video" means the video is turned into timestamped still frames in the browser (no audio track). */
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
  for (const f of files || []) { if (f.kind === 'image' && (f.ni || 0) > 0) n.add('image'); if (f.kind === 'video' && (f.ni || 0) > 0) n.add('video'); }
  return [...n];
}
/** Keep the user's chosen assistant when it can do the job; otherwise switch to a compatible one and say why. */
export function pick(assistant, files, names) {
  const req = needs(files), can = CAPS[assistant] || CAPS[FALLBACK];
  const missing = req.filter(k => !can[k]);
  if (!missing.length) return { assistant, switched: false };
  const to = FALLBACK;
  return { assistant: to, switched: true, from: assistant, to, why: `${names?.[assistant] || assistant} can't read ${missing.map(k => NEED[k]).join(' or ')}` };
}
