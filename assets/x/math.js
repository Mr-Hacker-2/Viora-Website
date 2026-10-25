/**
 * Viora — maths rendering.
 *
 * No LaTeX engine ships with the extension (the CSP forbids remote scripts and
 * KaTeX is far too big to bundle for a side panel), so this is a deliberately
 * small renderer covering what an assistant actually writes: fractions, roots,
 * powers, indices, and the usual symbols. Output is plain HTML styled by
 * sidepanel.css — a fraction is a two-row flex box with a rule between, not
 * "3/4".
 *
 * Everything that reaches the DOM goes through escapeHtml first. Unknown
 * commands are dropped rather than passed through.
 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

/* Commands that stand for a single character. */
const SYMBOL = {
  // greek
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ',
  tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
  Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',

  // relations and operators
  times: '×', div: '÷', cdot: '·', ast: '∗', star: '⋆', pm: '±', mp: '∓',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', ll: '≪', gg: '≫',
  approx: '≈', equiv: '≡', cong: '≅', sim: '∼', simeq: '≃', propto: '∝',
  subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇', in: '∈', notin: '∉',
  cup: '∪', cap: '∩', setminus: '∖', emptyset: '∅', varnothing: '∅',
  oplus: '⊕', ominus: '⊖', otimes: '⊗', circ: '∘', bullet: '∙',
  perp: '⊥', parallel: '∥', mid: '∣', angle: '∠', triangle: '△',

  // arrows
  to: '→', rightarrow: '→', Rightarrow: '⇒', leftarrow: '←', Leftarrow: '⇐',
  leftrightarrow: '↔', Leftrightarrow: '⇔', mapsto: '↦', implies: '⟹', iff: '⟺',

  // big operators and calculus
  sum: '∑', prod: '∏', coprod: '∐', int: '∫', iint: '∬', iiint: '∭', oint: '∮',
  partial: '∂', nabla: '∇', infty: '∞', Re: 'ℜ', Im: 'ℑ', ell: 'ℓ', hbar: 'ℏ',
  aleph: 'ℵ', degree: '°', prime: '′', forall: '∀', exists: '∃', nexists: '∄',
  neg: '¬', lnot: '¬', land: '∧', lor: '∨', therefore: '∴', because: '∵',
  checkmark: '✓', dagger: '†',

  // number sets
  R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ',

  // dots and spacing glyphs
  ldots: '…', dots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱'
};

/* Multi-letter names that should be set upright, like sin or lim. */
const FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan',
  'sinh', 'cosh', 'tanh', 'log', 'ln', 'lg', 'exp', 'lim', 'limsup', 'liminf',
  'max', 'min', 'sup', 'inf', 'det', 'dim', 'ker', 'deg', 'gcd', 'lcm',
  'mod', 'bmod', 'arg', 'Pr'
]);

/* Commands that only change spacing. */
const SPACING = {
  ',': '<span class="mspace mspace-s"></span>',
  ':': '<span class="mspace mspace-m"></span>',
  ';': '<span class="mspace mspace-l"></span>',
  '!': '<span class="mspace mspace-neg"></span>',
  ' ': ' ',
  quad: '<span class="mspace mspace-quad"></span>',
  qquad: '<span class="mspace mspace-quad"></span><span class="mspace mspace-quad"></span>'
};

/* Text-mode wrappers: \text{...} and the font commands, all upright-ish. */
const TEXTY = {
  text: 'mtext', textrm: 'mtext', textnormal: 'mtext', mathrm: 'mtext',
  operatorname: 'mop', mathbf: 'mbold', textbf: 'mbold',
  mathit: 'mital', textit: 'mital', mathsf: 'msans', mathtt: 'mtt',
  mathbb: 'mbb', mathcal: 'mcal', boldsymbol: 'mbold'
};

/**
 * Turn the bits of ASCII maths people type into the real characters, and
 * promote a simple `a/b` into a proper fraction. Conservative on purpose:
 * only bare numbers and single letters become fractions, so "km/h" and
 * "f(x)/g(x)" are left for the author to write as \frac.
 */
function normalise(src) {
  return String(src)
    .replace(/<=>/g, '\\iff')
    .replace(/<=/g, '\\le')
    .replace(/>=/g, '\\ge')
    .replace(/!=/g, '\\ne')
    .replace(/~=/g, '\\approx')
    .replace(/=>/g, '\\Rightarrow')
    .replace(/->/g, '\\to')
    .replace(/\+-/g, '\\pm')
    .replace(/(?<![\\\w])~(?!=)/g, '\\ ')
    .replace(
      /(?<![\w}\)\]])\s*(\d+(?:\.\d+)?|[a-zA-Z])\s*\/\s*(\d+(?:\.\d+)?|[a-zA-Z])(?![\w({[])/g,
      '\\frac{$1}{$2}'
    );
}

function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      const m = /^\\([a-zA-Z]+|[\s\S])/.exec(src.slice(i));
      if (!m) { i++; continue; }
      out.push({ t: 'cmd', v: m[1] });
      i += m[0].length;
    } else if (c === '{' || c === '}' || c === '^' || c === '_') {
      out.push({ t: c });
      i++;
    } else if (/\s/.test(c)) {
      out.push({ t: 'ws' });
      i++;
    } else {
      out.push({ t: 'ch', v: c });
      i++;
    }
  }
  return out;
}

/** Read one argument: a braced group, or the next single atom. */
function argument(ts, st) {
  while (ts[st.i]?.t === 'ws') st.i++;
  return atom(ts, st);
}

function group(ts, st) {
  // caller has consumed '{'
  const parts = [];
  let depth = 1;
  while (st.i < ts.length) {
    const tk = ts[st.i];
    if (tk.t === '{') depth++;
    if (tk.t === '}') {
      depth--;
      if (depth === 0) { st.i++; break; }
    }
    parts.push(scripted(ts, st));
  }
  return parts.join('');
}

/** Same as group() but returns the raw characters, for \text{...}. */
function rawGroup(ts, st) {
  let depth = 1;
  let out = '';
  while (st.i < ts.length) {
    const tk = ts[st.i];
    if (tk.t === '{') depth++;
    if (tk.t === '}') {
      depth--;
      if (depth === 0) { st.i++; break; }
    }
    out += tk.t === 'cmd' ? `\\${tk.v}` : tk.t === 'ws' ? ' ' : tk.v ?? tk.t;
    st.i++;
  }
  return out;
}

const OPEN = { '(': '(', '[': '[', '\\{': '{', '|': '|', '.': '', langle: '⟨' };
const CLOSE = { ')': ')', ']': ']', '\\}': '}', '|': '|', '.': '', rangle: '⟩' };

function command(ts, st) {
  const name = ts[st.i].v;
  st.i++;

  if (name === 'frac' || name === 'dfrac' || name === 'tfrac' || name === 'cfrac') {
    const num = argument(ts, st);
    const den = argument(ts, st);
    const size = name === 'tfrac' ? ' frac-tight' : '';
    return (
      `<span class="frac${size}">` +
      `<span class="frac-n">${num}</span>` +
      `<span class="frac-d">${den}</span>` +
      `</span>`
    );
  }

  if (name === 'binom' || name === 'dbinom') {
    const top = argument(ts, st);
    const bottom = argument(ts, st);
    return (
      `<span class="mfence">(</span>` +
      `<span class="frac frac-bare"><span class="frac-n">${top}</span><span class="frac-d">${bottom}</span></span>` +
      `<span class="mfence">)</span>`
    );
  }

  if (name === 'sqrt') {
    let index = '';
    while (ts[st.i]?.t === 'ws') st.i++;
    if (ts[st.i]?.t === 'ch' && ts[st.i].v === '[') {
      st.i++;
      let inner = '';
      while (st.i < ts.length && !(ts[st.i].t === 'ch' && ts[st.i].v === ']')) {
        inner += ts[st.i].v ?? '';
        st.i++;
      }
      st.i++;
      index = `<span class="root-index">${esc(inner)}</span>`;
    }
    const body = argument(ts, st);
    return `<span class="sqrt">${index}<span class="radical">√</span><span class="radicand">${body}</span></span>`;
  }

  if (name === 'overline') return `<span class="radicand">${argument(ts, st)}</span>`;
  if (name === 'underline') return `<span class="munder">${argument(ts, st)}</span>`;
  if (name === 'hat') return `<span class="maccent" data-accent="̂">${argument(ts, st)}</span>`;
  if (name === 'bar') return `<span class="radicand">${argument(ts, st)}</span>`;
  if (name === 'vec') return `<span class="maccent" data-accent="⃗">${argument(ts, st)}</span>`;

  if (TEXTY[name]) {
    while (ts[st.i]?.t === 'ws') st.i++;
    if (ts[st.i]?.t === '{') {
      st.i++;
      const literal = rawGroup(ts, st);
      return `<span class="${TEXTY[name]}">${esc(literal)}</span>`;
    }
    return '';
  }

  if (name === 'left' || name === 'right') {
    while (ts[st.i]?.t === 'ws') st.i++;
    const tk = ts[st.i];
    if (!tk) return '';
    const key = tk.t === 'cmd' ? `\\${tk.v}` : tk.v;
    st.i++;
    const glyph = name === 'left' ? OPEN[key] ?? key : CLOSE[key] ?? key;
    return glyph ? `<span class="mfence">${esc(glyph)}</span>` : '';
  }

  if (name === '\\' || name === 'newline') return '<br>';
  if (name in SPACING) return SPACING[name];
  if (FUNCTIONS.has(name)) return `<span class="mop">${esc(name)}</span>`;
  if (SYMBOL[name]) {
    const big = /^(sum|prod|coprod|int|iint|iiint|oint)$/.test(name);
    return `<span class="${big ? 'mbig' : 'msym'}">${esc(SYMBOL[name])}</span>`;
  }

  // Unknown command — drop it rather than leaking a backslash into the panel.
  return '';
}

function atom(ts, st) {
  const tk = ts[st.i];
  if (!tk) return '';

  if (tk.t === '{') { st.i++; return group(ts, st); }
  if (tk.t === '}') { st.i++; return ''; }
  if (tk.t === 'ws') { st.i++; return ' '; }
  if (tk.t === 'cmd') return command(ts, st);

  st.i++;
  const c = tk.v;
  if (c === '*') return '<span class="msym">·</span>';
  if (c === '-') return '<span class="msym">−</span>';
  if (c === '+' || c === '=' || c === '<' || c === '>') return `<span class="msym">${esc(c)}</span>`;
  if (c === '(' || c === ')' || c === '[' || c === ']') return `<span class="mfence">${esc(c)}</span>`;
  if (/[a-zA-Z]/.test(c)) return `<span class="mvar">${esc(c)}</span>`;
  return esc(c);
}

/** An atom plus any powers or indices hanging off it. */
function scripted(ts, st) {
  let base = atom(ts, st);
  let sup = '';
  let sub = '';

  while (ts[st.i] && (ts[st.i].t === '^' || ts[st.i].t === '_')) {
    const kind = ts[st.i].t;
    st.i++;
    const arg = argument(ts, st);
    if (kind === '^') sup += arg;
    else sub += arg;
  }

  if (sup && sub) {
    return `${base}<span class="mscripts"><span class="msup">${sup}</span><span class="msub">${sub}</span></span>`;
  }
  if (sup) return `${base}<sup>${sup}</sup>`;
  if (sub) return `${base}<sub>${sub}</sub>`;
  return base;
}

/**
 * Render a LaTeX-ish expression to HTML.
 * `display` makes it a centred block with roomier fractions.
 */
export function renderMath(src, display = false) {
  let html = '';
  try {
    const ts = tokenize(normalise(src));
    const st = { i: 0 };
    const parts = [];
    while (st.i < ts.length) {
      const before = st.i;
      parts.push(scripted(ts, st));
      if (st.i === before) st.i++; // never spin on an unexpected token
    }
    html = parts.join('');
  } catch {
    html = esc(src);
  }
  if (!html.trim()) html = esc(src);
  return `<span class="math${display ? ' math-block' : ''}">${html}</span>`;
}

export { esc as escapeMath };
