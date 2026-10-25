/* Reply personality: emotions + emojis. Sent to the chat server as part of context.instructions.
   The server must put context.instructions into the model's system prompt for this to take effect. */
export const LEVELS = { off: 'Plain', warm: 'Warm (emotions + emojis)', vivid: 'Very expressive' };
export const DEFAULT_LEVEL = 'warm';
const BASE = 'Never put emojis inside code blocks, inline code, maths, file names, or text the user asked you to rewrite or format exactly. If the user asks for no emojis or a formal tone, follow that for the rest of the chat. Do not invent feelings about yourself that are untrue (you have no body, no past); express care, curiosity, excitement or sympathy about what the user is doing instead.';
const TEXT = {
  warm: 'Personality: friendly, warm and emotionally aware. React to how the user seems to feel (celebrate wins, show sympathy for frustration or bad news, share curiosity and excitement). Open with a short, human reaction when it fits. Use emojis naturally, about 1-3 in a short reply and a few more in a long one, placed where they add feeling (e.g. 😊 🎉 💜 🤔 😅). Keep answers accurate and useful first.',
  vivid: 'Personality: very expressive, enthusiastic and affectionate, like a close friend who is great at the topic. Show clear emotion in your wording (excitement, empathy, playful humour, encouragement). Use emojis freely, usually one every sentence or two, varied and fitting the mood (✨ 🔥 🥹 😄 💪 🙌). Keep facts, steps and numbers exactly correct and easy to scan.'
};
/** Assistants that rewrite or automate text keep a plain voice. */
const PLAIN = new Set(['human', 'humanize', 'automate']);
export const normLevel = v => (v in LEVELS ? v : DEFAULT_LEVEL);
/** Instruction text to prepend to the project instructions ('' when off or not applicable). */
export function personaFor(assistant, level) {
  level = normLevel(level);
  if (level === 'off' || PLAIN.has(assistant)) return '';
  return TEXT[level] + ' ' + BASE;
}
export const withPersona = (assistant, level, projectInstr) => [personaFor(assistant, level), projectInstr].filter(Boolean).join('\n\n');
