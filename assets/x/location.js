/* Location sharing for questions that depend on where the person is.
   Nothing here runs silently: the app first shows a notice (see #locdlg in app.html), and only after the person agrees does the
   browser show its own permission prompt. A shared location is kept on this device and on the person's Viora account, where the
   administrator can see it (the Terms of Service and Privacy Policy say so). The person can clear it from the account page. */

const KEY = 'viora_location', DECLINED = 'viora_location_declined';
export const FRESH_MS = 6 * 3600e3;   // a shared location is reused for six hours, then asked about again
export const DECLINE_MS = 30 * 60e3;  // after "Not now", do not ask again for half an hour

const store_ = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* blocked storage: the choice lasts until reload */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* nothing to remove */ } }
};

/* Words that mean "where I am" or name something found by place. */
const HERE = /\b(?:near ?(?:me|by)|nearby|nearest|closest|around here|close to me|in my area|my location|where am i|walking distance|open now|directions? to|how far (?:is|to)|local (?:weather|news|time|restaurants?|stores?|shops?|services?)|weather|forecast|temperature outside)\b/i;
const THING = /\b(?:find|show|where(?:'s| is| can i)|best|good|cheap|any|recommend)\b[^.?!]{0,40}\b(?:restaurants?|caf[eé]s?|coffee|bars?|pubs?|hotels?|motels?|gas stations?|petrol|pharmac(?:y|ies)|hospitals?|clinics?|urgent care|doctors?|dentists?|stores?|shops?|supermarkets?|groceries|parks?|gyms?|atms?|banks?|barbers?|salons?|mechanics?|plumbers?|electricians?|takeaway|pizza|sushi)\b/i;
const NOT_A_PLACE_QUESTION = /\b(?:recipes?|how (?:to|do i) (?:make|cook|bake)|ingredients|calories|history of|code|script|function)\b/i;
/* A named place ("in Paris", "near Boston", a ZIP code) means the person already said where. Case-sensitive on purpose. */
const NAMES_PLACE = /\b(?:in|at|for|near|around|of)\s+(?:the\s+)?[A-Z][A-Za-z]{2,}|\b\d{5}(?:-\d{4})?\b/;

/** True when the question depends on where the person is and does not already say where. */
export function needsLocation(text) {
  const t = String(text || '');
  if (!t.trim() || NOT_A_PLACE_QUESTION.test(t)) return false;
  if (!(HERE.test(t) || THING.test(t))) return false;
  return !NAMES_PLACE.test(t) || /\b(?:near ?me|nearby|my area|my location|around here|close to me)\b/i.test(t);
}

/** The shared location if it is still fresh, else null. */
export function getStored(now = Date.now()) {
  const s = store_.get(KEY);
  if (!s || typeof s.lat !== 'number' || typeof s.lon !== 'number' || typeof s.at !== 'number' || now - s.at > FRESH_MS) return null;
  return s;
}
export function store(loc, now = Date.now()) { store_.set(KEY, { lat: loc.lat, lon: loc.lon, accuracy: loc.accuracy, at: now }); store_.del(DECLINED); }
export function clearLocal() { store_.del(KEY); store_.del(DECLINED); }
export function markDeclined(now = Date.now()) { store_.set(DECLINED, now); }
export function declinedRecently(now = Date.now()) { const d = store_.get(DECLINED); return typeof d === 'number' && now - d < DECLINE_MS; }

/** What goes into a chat request, or undefined when nothing is shared. */
export function contextFor(now = Date.now()) {
  const s = getStored(now);
  return s ? { lat: s.lat, lon: s.lon, accuracy: s.accuracy } : undefined;
}

/** Ask the browser for the device location. The browser shows its own permission prompt. */
export function getPosition(geo = globalThis.navigator && globalThis.navigator.geolocation) {
  return new Promise((ok, no) => {
    if (!geo) return no(Object.assign(new Error('This browser cannot share a location.'), { code: 'unsupported' }));
    geo.getCurrentPosition(
      p => ok({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      e => no(Object.assign(new Error(e && e.message ? e.message : 'Location was not shared.'), { code: e && e.code === 1 ? 'denied' : e && e.code === 3 ? 'timeout' : 'unavailable' })),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5 * 60e3 }
    );
  });
}

/** Why a location could not be shared, in words for the person. */
export function describeFailure(err) {
  const code = err && err.code;
  if (code === 'denied') return 'Location is blocked for this site. You can allow it in your browser’s site settings, or just tell Viora which city or area you mean.';
  if (code === 'timeout') return 'Your device took too long to find its location. Tell Viora which city or area you mean, or try again.';
  if (code === 'unsupported') return 'This browser cannot share a location. Tell Viora which city or area you mean.';
  return 'Your location could not be found. Tell Viora which city or area you mean.';
}

const post = (api, token, body, fetchFn) => fetchFn(api + '/api/location', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });

/** Save the shared location on the person's account so the administrator can see it. Best effort: the chat still works without it. */
export async function sendToServer(api, token, loc, fetchFn = fetch) {
  try { return (await post(api, token, { lat: loc.lat, lon: loc.lon, accuracy: loc.accuracy }, fetchFn)).ok; } catch { return false; }
}
/** Remove the shared location from this device and from the account. Returns whether the server confirmed. */
export async function clearEverywhere(api, token, fetchFn = fetch) {
  clearLocal();
  try { return (await post(api, token, { clear: true }, fetchFn)).ok; } catch { return false; }
}
