/* Viora Voice: speak while the answer is still being written.

   Two small pure helpers (no DOM, easy to test):

   SentenceStreamer  takes the reply text as it grows and hands back speakable pieces as soon as a whole sentence exists, so the
                     first words are spoken after the first sentence rather than after the whole answer. Markdown is cleaned with
                     speechText() exactly as for non-streamed speech.
   deliveryFor       picks a gentle speaking-rate nudge from the sentence itself (question, excitement, comfort, seriousness).
                     This is the only "emotion" control that is honest for the current voice: the Orpheus route behind /api/speak
                     takes text, a voice name and nothing else, so pitch and style cannot be set from here. Pace can, and it is
                     kept within +-8% so the voice never sounds sped-up or dragged. */
import { speechText, chunkSpeech } from './voice-tts.js';

const BOUNDARY = /[.!?…]["'”)\]]*(?:\s)|\n/g;   // sentence end followed by space, or a line break

/* Longest prefix of `text` that ends on a finished sentence or line ('' when none yet). */
export function stablePrefix(text) {
  let end = 0, m; BOUNDARY.lastIndex = 0;
  while ((m = BOUNDARY.exec(text))) end = m.index + m[0].length;
  return text.slice(0, end);
}

export class SentenceStreamer {
  /* firstMin: shortest first piece worth a request. restMin: later pieces are gathered up to this size so requests are not tiny. */
  constructor({ maxPiece = 180, firstMin = 14, restMin = 70 } = {}) {
    Object.assign(this, { maxPiece, firstMin, restMin });
    this.cleaned = ''; this.spoken = 0; this.emittedAny = false; this.broken = false;
  }
  _fresh(full, final) {
    const src = final ? full : stablePrefix(full);
    const cleaned = speechText(src);
    if (this.cleaned && !cleaned.startsWith(this.cleaned.slice(0, this.spoken))) { this.broken = true; return ''; } // earlier text changed: never repeat or skip words
    this.cleaned = cleaned;
    return cleaned.slice(this.spoken);
  }
  /* push(fullTextSoFar) -> [pieces ready to speak now] */
  push(full, { final = false } = {}) {
    if (this.broken) return [];
    const fresh = this._fresh(String(full || ''), final).replace(/^\s+/, '');
    if (!fresh.trim()) return [];
    const need = final ? 1 : (this.emittedAny ? this.restMin : this.firstMin);
    if (fresh.trim().length < need) return [];
    this.spoken = this.cleaned.length; this.emittedAny = true;
    return chunkSpeech(fresh, this.maxPiece);
  }
  /* What was spoken so far is a prefix of the final cleaned text; speak only the rest. */
  finish(full) { return this.push(full, { final: true }); }
}

const has = (t, re) => re.test(t);
/* -> { mood, rate } ; rate is a multiplier applied to the person's chosen speed. */
export function deliveryFor(text, { expressiveness = 1 } = {}) {
  const t = String(text || '');
  let mood = 'neutral', rate = 1;
  if (has(t, /\b(sorry|unfortunately|difficult|hard time|stress(?:ed|ful)?|worried|anxious|overwhelm\w*|sad|lonely|grief|loss|that sounds (?:tough|rough|hard))\b/i)) { mood = 'empathetic'; rate = 0.93; }
  else if (has(t, /\b(warning|important|careful|critical|security|risk|must|legal|deadline)\b/i)) { mood = 'serious'; rate = 0.96; }
  else if (/!/.test(t) || has(t, /\b(amazing|awesome|great news|congrat\w*|fantastic|exciting|love (?:it|that)|wow)\b/i)) { mood = 'excited'; rate = 1.06; }
  else if (/\?\s*$/.test(t)) { mood = 'curious'; rate = 1.02; }
  else if (has(t, /\b(don'?t worry|no problem|take your time|it'?s okay|relax|simple|easy)\b/i)) { mood = 'calm'; rate = 0.97; }
  const k = Math.max(0, Math.min(1.5, Number(expressiveness))); // 0 turns it off
  rate = 1 + (rate - 1) * k;
  return { mood, rate: Math.min(1.08, Math.max(0.92, rate)) };
}
