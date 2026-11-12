/* Viora web app — Think mode (the "Think" button in the composer).

   Not to be confused with think.js, which draws the activity panel of a reply. This file is the on/off switch:

   - the setting is stored per signed-in person (the key contains their email), so it can never carry over to
     someone else who uses the same browser;
   - it stays on until that person turns it off;
   - it is sent to the server as `think: true` with each chat request; the server decides what it really does
     (assistant-side rules live in Viora-auth/think.js);
   - the text shown after a reply comes from what the server REPORTED, never from what we hoped it did. */

export const thinkKey = email => 'viora_think_' + String(email || '').trim().toLowerCase();

/** `store` has the same get(key, fallback) / set(key, value) shape as `ls` in app.html. */
export const readThink = (store, email) => !!email && store.get(thinkKey(email), false) === true;
export const writeThink = (store, email, on) => (email ? store.set(thinkKey(email), on === true) : false);

/** The Writing Studio ('human') rewrites a draft, so Think does not apply to it. */
export const thinkApplies = assistant => assistant !== 'human' && assistant !== 'humanize';

/** The value sent as `think` in a chat request. Always a real boolean. */
export const thinkRequestFlag = (on, assistant) => on === true && thinkApplies(assistant);

/** Everything the button needs to look and read correctly. */
export function thinkButtonState(on, assistant) {
  const usable = thinkApplies(assistant);
  const pressed = usable && on === true;
  return {
    pressed,
    disabled: !usable,
    title: !usable ? 'Think is not used by the Writing Studio'
      : pressed ? 'Think is on: Viora takes extra care with hard questions. Click to turn it off.'
        : 'Think: have Viora take extra time and double-check hard questions'
  };
}

/** Plain-language note for a finished reply, built only from the server's own report (the `viora_think` event). */
export function thinkNote(report) {
  if (!report || report.requested !== true) return '';
  if (report.applied !== true) return 'Think was not used for this reply';
  const parts = ['Think'];
  parts.push(report.strongerModel ? 'used a stronger model' : 'extra care');
  if (report.review) parts.push('answer double-checked');
  return parts.join(' · ');
}
