/* Viora appearance preferences (shared by the website and the web app).
   - Default look = light (white) with the green accent.
   - Users can change theme (light/dark) and accent in Settings; the choice is stored in
     localStorage (viora_theme, viora_accent) and applied before first paint to avoid a flash.
   - The web app now supports both themes; <html data-fixed-theme> still pins a page to one. */
(function () {
  'use strict';
  var ACCENTS = [
    { id: 'green',  name: 'Viora green', hex: '#4ade50' },
    { id: 'blue',   name: 'Blue',        hex: '#4aa8ff' },
    { id: 'teal',   name: 'Teal',        hex: '#2dd4bf' },
    { id: 'violet', name: 'Violet',      hex: '#9b86ff' },
    { id: 'amber',  name: 'Amber',       hex: '#f5b83d' },
    { id: 'rose',   name: 'Rose',        hex: '#ff6f95' }
  ];
  var root = document.documentElement;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function validAccent(a) { return ACCENTS.some(function (x) { return x.id === a; }); }
  function apply() {
    var a = get('viora_accent');
    if (validAccent(a) && a !== 'green') root.setAttribute('data-accent', a); else root.removeAttribute('data-accent');
    if (!root.hasAttribute('data-fixed-theme')) {
      var t = get('viora_theme'); root.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
    }
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', root.getAttribute('data-theme') === 'light' ? '#f4f8f5' : '#050706');
  }
  function setAccent(id) { if (!validAccent(id)) return; put('viora_accent', id); apply(); }
  function setTheme(t) { put('viora_theme', t === 'dark' ? 'dark' : 'light'); apply(); }
  function reset() { try { localStorage.removeItem('viora_accent'); localStorage.removeItem('viora_theme'); } catch (e) {} apply(); }
  /* Render the picker into a container element. opts.theme=false hides the dark/light choice. */
  function mount(el, opts) {
    opts = opts || {};
    var cur = validAccent(get('viora_accent')) ? get('viora_accent') : 'green';
    var showTheme = opts.theme !== false && !root.hasAttribute('data-fixed-theme');
    var th = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    el.innerHTML =
      (showTheme ? '<div class="pf-row"><b>Theme</b><div class="pf-seg" role="radiogroup" aria-label="Theme">' +
        ['light', 'dark'].map(function (t) { return '<button type="button" role="radio" aria-checked="' + (t === th) + '" data-pf-theme="' + t + '">' + (t === 'light' ? 'Light' : 'Dark') + '</button>'; }).join('') + '</div></div>' : '') +
      '<div class="pf-row"><b>Accent colour</b><div class="pf-sw" role="radiogroup" aria-label="Accent colour">' +
      ACCENTS.map(function (a) { return '<button type="button" role="radio" aria-checked="' + (a.id === cur) + '" data-pf-accent="' + a.id + '" title="' + a.name + '" aria-label="' + a.name + '" style="--sw:' + a.hex + '"></button>'; }).join('') +
      '</div></div><p class="pf-note">' + (showTheme ? 'Viora’s default is the white look. ' : '') + 'Your choice is saved on this device.</p>' +
      '<button type="button" class="pf-reset" data-pf-reset>Reset to default look</button>';
    el.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.pfAccent) setAccent(b.dataset.pfAccent);
      else if (b.dataset.pfTheme) setTheme(b.dataset.pfTheme);
      else if (b.hasAttribute('data-pf-reset')) reset();
      else return;
      mount(el, opts);
    };
  }
  apply();
  window.VioraPrefs = { ACCENTS: ACCENTS, apply: apply, setAccent: setAccent, setTheme: setTheme, reset: reset, mount: mount };
})();
