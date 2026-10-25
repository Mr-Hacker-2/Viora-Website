/**
 * Viora — icon set.
 *
 * The interface itself never speaks in emoji — only Viora's replies do, and
 * only at whatever level is picked in settings. Everywhere the chrome needs a
 * glyph — which assistant is active, a tab in a list, the mic — it draws from
 * here instead: plain stroke icons that inherit color from whatever contains
 * them, the same way the toolbar icons already do.
 */

const wrap = (body, viewBox = '0 0 20 20') =>
  `<svg viewBox="${viewBox}" class="glyph" aria-hidden="true">${body}</svg>`;

const ICONS = {
  // ---- the assistants ----
  flash: wrap('<path d="M11 2 5 12h4l-1 8 7-11h-4l1-7Z"/>'),

  agent: wrap(
    '<rect x="3.5" y="6" width="13" height="10" rx="3"/>' +
      '<path d="M10 6V3.5"/><circle cx="10" cy="2.8" r="1" fill="currentColor" stroke="none"/>' +
      '<circle cx="7.4" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="12.6" cy="11" r="1" fill="currentColor" stroke="none"/>'
  ),

  search: wrap(
    '<circle cx="8.3" cy="8.3" r="5.3"/>' +
      '<path d="M12.4 12.4 17 17"/>' +
      '<circle cx="15.3" cy="3.6" r="1" fill="currentColor" stroke="none"/>'
  ),

  math: wrap('<path d="M3 11.5 6 16l4-13h7"/>'),

  automate: wrap(
    '<rect x="3" y="3.5" width="10.5" height="13" rx="1.6"/>' +
      '<path d="M12 11.3l6 2.4-2.7.9-.9 2.7-2.4-6Z" fill="currentColor" stroke="none"/>'
  ),

  // A pen nib over a wavy line — text being rewritten by hand.
  humanize: wrap(
    '<path d="M13.2 2.8 17.2 6.8 8.4 15.6 3.6 16.4 4.4 11.6Z"/>' +
      '<path d="M11.4 4.6 15.4 8.6"/>' +
      '<path d="M2.5 18.4c1.4-1.2 2.4-1.2 3.8 0s2.4 1.2 3.8 0"/>'
  ),

  // ---- chrome ----
  plus: wrap('<path d="M10 4v12M4 10h12"/>'),

  // A framed picture: sun and a ridge line.
  image: wrap(
    '<rect x="2.5" y="3.5" width="15" height="13" rx="1.8"/>' +
      '<circle cx="7.2" cy="8" r="1.4"/>' +
      '<path d="M3 14.6l4.2-3.8 3.1 2.7 2.4-2 4.3 3.6"/>'
  ),

  upload: wrap(
    '<path d="M6.3 2.5h5l3 3V17a1 1 0 0 1-1 1H6.3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"/>' +
      '<path d="M10 14V8M7.3 10.4 10 7.6l2.7 2.8"/>'
  ),

  camera: wrap(
    '<path d="M7.2 4.8 8 3.2h4l.8 1.6h2.7a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"/>' +
      '<circle cx="10" cy="10.6" r="3"/>'
  ),

  // A monitor with an eye on it — "see my screen".
  screen: wrap(
    '<rect x="2.3" y="3.3" width="15.4" height="10.2" rx="1.6"/>' +
      '<path d="M7.5 17h5M10 13.5V17"/>' +
      '<path d="M5.6 8.4c1.2-1.5 2.8-2.3 4.4-2.3s3.2.8 4.4 2.3c-1.2 1.5-2.8 2.3-4.4 2.3S6.8 9.9 5.6 8.4Z"/>' +
      '<circle cx="10" cy="8.4" r="1" fill="currentColor" stroke="none"/>'
  ),

  tab: wrap(
    '<rect x="2.5" y="4.5" width="15" height="11.5" rx="1.6"/>' +
      '<path d="M2.5 7.5h15"/>' +
      '<circle cx="5" cy="6" r="0.5" fill="currentColor" stroke="none"/>'
  ),

  mic: wrap(
    '<rect x="7.5" y="2.3" width="5" height="9.6" rx="2.5"/>' +
      '<path d="M5 9.8a5 5 0 0 0 10 0M10 14.8V18M7.3 18h5.4"/>'
  ),

  check: wrap('<path d="M4.2 10.4 8 14.3l7.5-9"/>'),

};

/** id → the small stroke SVG (as a markup string) for that id. */
ICONS.copy = wrap('<rect x="7" y="7" width="9" height="9" rx="1.6"/><path d="M4 13V5.6A1.6 1.6 0 0 1 5.6 4H13"/>');
ICONS.more = wrap('<circle cx="4.5" cy="10" r="1.3" fill="currentColor"/><circle cx="10" cy="10" r="1.3" fill="currentColor"/><circle cx="15.5" cy="10" r="1.3" fill="currentColor"/>');
ICONS.speaker = wrap('<path d="M3.5 8v4h3l4 3.2V4.8L6.5 8h-3Z"/><path d="M13.2 7.2a3.6 3.6 0 0 1 0 5.6M15.4 5.2a6.4 6.4 0 0 1 0 9.6"/>');
ICONS.stop = wrap('<rect x="5" y="5" width="10" height="10" rx="1.8" fill="currentColor" stroke="none"/>');
ICONS.star = wrap('<path d="m10 2.8 2.2 4.5 4.9.7-3.5 3.5.8 4.9L10 14l-4.4 2.4.8-4.9L2.9 8l4.9-.7L10 2.8Z"/>');
ICONS.starFilled = wrap('<path d="m10 2.8 2.2 4.5 4.9.7-3.5 3.5.8 4.9L10 14l-4.4 2.4.8-4.9L2.9 8l4.9-.7L10 2.8Z" fill="currentColor"/>');
ICONS.pin = wrap('<path d="m12.5 3 4.5 4.5-2 .6-2.6 2.6.2 3.1-1.2 1.2-3.4-3.4L4 15.6l-.6-.6 3.6-3.6L3.6 8l1.2-1.2 3.1.2 2.6-2.6L12.5 3Z"/>');
ICONS.pinFilled = wrap('<path d="m12.5 3 4.5 4.5-2 .6-2.6 2.6.2 3.1-1.2 1.2-3.4-3.4L4 15.6l-.6-.6 3.6-3.6L3.6 8l1.2-1.2 3.1.2 2.6-2.6L12.5 3Z" fill="currentColor"/>');
ICONS.download = wrap('<path d="M10 3.5v9M6.2 9.2 10 13l3.8-3.8M4 16h12"/>');

export function icon(name) {
  return ICONS[name] || '';
}

/** Every assistant id maps 1:1 to an icon of the same name. */
export const MODEL_ICON = { flash: 'flash', search: 'search', math: 'math', automate: 'automate', humanize: 'humanize' };
