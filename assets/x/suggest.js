/* Follow-up suggestions and the "Continue" decision for assistant replies.
   Everything here is a local, rule-based reading of the reply that was just shown: no extra model call, nothing is sent
   anywhere until the person taps a chip. Suggestions are plain messages Viora can answer without any special mode. */

const MAX = 3;
const has = (re, t) => re.test(t);

/** True when the answer looks like it stopped halfway: an open code block, or the last line ends mid-sentence. */
export function looksCutOff(text) {
  const t = String(text || '').trimEnd();
  if (t.length < 40) return false;
  if ((t.match(/```/g) || []).length % 2 === 1) return true;
  const last = t.split('\n').pop().trim();
  if (!last || /^(?:[-*•]|\d+[.)])\s*$/.test(last)) return false;
  if (/[.!?…:)\]}"'”’`*|>\p{Extended_Pictographic}]$/u.test(last)) return false; // a sentence, a list item, a table row, a closing mark or an emoji
  if (/^(?:[-*•]|\d+[.)])\s+\S{1,40}$/.test(last)) return false; // a short list item such as "- Paris"
  if (/^#{1,6}\s/.test(last)) return false;                       // a heading
  return /[\p{L}\p{N},;]$/u.test(last) && last.split(/\s+/).length >= 4;
}

/** Message the Continue button sends. */
export const CONTINUE_PROMPT = 'Continue exactly where your last answer stopped. Do not repeat what you already wrote.';

/** Up to three follow-up prompts that fit the reply. Returns [] where a follow-up would be noise. */
export function suggestFollowUps(reply, { assistant = 'flash', userText = '', hasSources = false } = {}) {
  const t = String(reply || '').trim();
  if (t.length < 80) return [];
  if (assistant === 'human' || assistant === 'humanize') return [];
  const out = [];
  const add = s => { if (s && !out.includes(s) && out.length < MAX) out.push(s); };
  const code = has(/```[\w+-]*\n[\s\S]{20,}?```/, t);
  const math = has(/\$\$[\s\S]+?\$\$|\\\(|\\frac|\\sqrt|(?:^|\n)\s*(?:solve|compute|calculate)\b/i, t) || (assistant === 'math' && !code);
  const steps = has(/(?:^|\n)\s*1[.)]\s+\S[\s\S]*\n\s*2[.)]\s+\S/, t);
  const table = has(/\n\|.+\|\n\|[\s:|-]+\|/, t);
  const long = t.length > 1400;
  const askedCompare = has(/\b(?:vs\.?|versus|compare|difference between)\b/i, userText);
  if (code) { add('Explain this code line by line'); add('Add error handling and edge cases'); add('Write tests for it'); }
  else if (math) { add('Check this answer another way'); add('Show a similar practice problem'); add('Explain the key step more simply'); }
  else if (hasSources) { add('Summarize the key points from the sources'); add('What is still uncertain or disputed?'); add('Find newer or more sources'); }
  else if (steps) { add('What could go wrong at each step?'); add('Turn this into a checklist'); add('Give a concrete example'); }
  else if (table || askedCompare) { add('Which one would you pick, and why?'); add('Summarize this in two sentences'); add('What am I missing?'); }
  else if (long) { add('Summarize this in 3 bullet points'); add('Give me a concrete example'); add('What are the main caveats?'); }
  else { add('Give me a concrete example'); add('Explain it more simply'); add('What should I do next?'); }
  return out.slice(0, MAX);
}
