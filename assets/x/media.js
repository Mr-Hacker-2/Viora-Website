/* File validation helpers for attachments: size limits and content sniffing (never trust the extension). */
export const LIMITS = { image: 25e6, video: 300e6, doc: 40e6, parse: 15e6, maxFiles: 8, video_frames: 8, video_every_s: 5 };
export const fmtSize = n => n < 1e3 ? n + ' B' : n < 1e6 ? (n / 1e3).toFixed(n < 1e4 ? 1 : 0) + ' KB' : (n / 1e6).toFixed(n < 1e7 ? 1 : 0) + ' MB';
export const fmtTime = s => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); };
export function videoSampleTimes(duration) {
  const seconds = Number(duration);
  if (!Number.isFinite(seconds) || seconds <= 0) return [];
  const count = Math.min(LIMITS.video_frames, Math.max(2, Math.ceil(seconds / LIMITS.video_every_s)));
  const edge = Math.min(.25, seconds / (count * 2));
  return Array.from({ length: count }, (_, index) => edge + (seconds - edge * 2) * index / (count - 1));
}

const hex = (b, n) => [...b.slice(0, n)].map(x => x.toString(16).padStart(2, '0')).join('');
/** Look at the first bytes and say what the file really is. */
export async function sniff(file) {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer()), h = hex(b, 12), ascii = String.fromCharCode(...b.slice(0, 12));
  if (h.startsWith('89504e47')) return 'png';
  if (h.startsWith('ffd8ff')) return 'jpeg';
  if (ascii.startsWith('GIF8')) return 'gif';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'webp';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'AVI ') return 'avi';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WAVE') return 'audio';
  if (ascii.startsWith('%PDF')) return 'pdf';
  if (h.startsWith('1a45dfa3')) return 'webm'; // also mkv
  if (ascii.slice(4, 8) === 'ftyp') return /^(M4A|M4B|mp4a)/.test(ascii.slice(8, 12)) ? 'audio' : 'mp4';
  if (ascii.startsWith('ID3') || h.startsWith('fffb') || h.startsWith('fff3') || ascii.startsWith('OggS') || ascii.startsWith('fLaC')) return 'audio';
  if (h.startsWith('504b0304')) return 'zip'; // docx / xlsx / pptx
  if (h.startsWith('424d')) return 'bmp';
  return 'unknown';
}
export const IMG_OK = new Set(['png', 'jpeg', 'webp', 'gif']);
export const VID_OK = new Set(['mp4', 'webm']);
