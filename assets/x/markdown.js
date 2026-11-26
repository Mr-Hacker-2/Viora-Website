/**
 * Viora — markdown.
 * Small on purpose: pull out the things that must not be escaped (code spans
 * and maths), escape everything else, then build a limited set of blocks.
 * Model output is never inserted as raw HTML.
 */

import { renderMath } from './math.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

/**
 * Inline formatting. Code and maths are lifted out into slots before the
 * escape pass so `$x < y$` still renders as a comparison rather than `&lt;`,
 * then dropped back in at the end.
 */
function inline(text) {
  const slots = [];
  const hold = (html) => `\u0000${slots.push(html) - 1}\u0000`;

  let s = String(text ?? '');

  // Code first: a backtick span wins over anything inside it.
  s = s.replace(/`([^`]+)`/g, (_, c) => hold(`<code>${escapeHtml(c)}</code>`));

  // Maths, longest delimiters first.
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => hold(renderMath(m, true)));
  // Anything still carrying $$ is an unmatched delimiter (a reply cut off
  // between pairs) — strip it so it can't print back into the message.
  s = s.replace(/\$\$/g, '');
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => hold(renderMath(m, true)));
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => hold(renderMath(m, false)));
  s = s.replace(/(?<![\\$])\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g, (_, m) => hold(renderMath(m, false)));

  // Bare LaTeX outside any $…$ (a model answering with a raw \frac{153}{35}):
  // wrap it so it renders as a fraction instead of printing backslashes.
  s = s.replace(
    /\\(?:d?frac|tfrac|cfrac)\{(?:[^{}]|\{[^{}]*\})*\}\{(?:[^{}]|\{[^{}]*\})*\}|\\sqrt(?:\[[^\]]*\])?\{(?:[^{}]|\{[^{}]*\})*\}/g,
    (m) => hold(renderMath(m, false))
  );

  let out = escapeHtml(s);

  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|\W)\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  out = out.replace(
    /(^|[\s(])(https?:\/\/[^\s<)]+)/g,
    '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>'
  );

  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[Number(i)] ?? '');
}

/** Inline-only formatting (maths, bold, code, links) with no block wrapper — for text that lands inside a button or a heading, where a <p> would be invalid. */
export { inline as renderInline };

const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);
const isTableRule = (line) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes('-');

function cells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/** Returns an HTML string built only from escaped input. */
export function renderMarkdown(src) {
  const lines = String(src ?? '').split('\n');
  const html = [];
  let i = 0;
  let listType = null;

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^\s*```([\w+-]*)\s*$/);
    if (fence) {
      closeList();
      const lang = fence[1] || 'text';
      const body = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++;
      const code = escapeHtml(body.join('\n'));
      html.push(
        `<figure class="code"><figcaption><span>${escapeHtml(lang)}</span>` +
          `<button class="copy" type="button" data-copy>Copy</button></figcaption>` +
          `<pre><code class="lang-${escapeHtml(lang)}">${code}</code></pre></figure>`
      );
      continue;
    }

    if (!line.trim()) {
      closeList();
      i++;
      continue;
    }

    // A display-maths block on its own lines — but only when a closing $$
    // exists; an unmatched opener must not swallow the rest of the reply
    // as maths.
    if (/^\s*\$\$\s*$/.test(line)) {
      const closer = lines.findIndex((l, j) => j > i && /^\s*\$\$\s*$/.test(l));
      if (closer < 0) {
        i++;
        continue;
      }
      closeList();
      html.push(`<p class="math-line">${renderMath(lines.slice(i + 1, closer).join(' '), true)}</p>`);
      i = closer + 1;
      continue;
    }

    if (isTableRow(line) && isTableRule(lines[i + 1] ?? '')) {
      closeList();
      const head = cells(lines[i]);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      html.push(
        '<div class="table-wrap"><table><thead><tr>' +
          head.map((c) => `<th>${inline(c)}</th>`).join('') +
          '</tr></thead><tbody>' +
          rows
            .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
            .join('') +
          '</tbody></table></div>'
      );
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 2, 6);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      closeList();
      const quote = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      html.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
      continue;
    }

    if (/^\s*([-*+])\s+/.test(line)) {
      if (listType !== 'ul') {
        closeList();
        html.push('<ul>');
        listType = 'ul';
      }
      html.push(`<li>${inline(line.replace(/^\s*[-*+]\s+/, ''))}</li>`);
      i++;
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      if (listType !== 'ol') {
        closeList();
        html.push('<ol>');
        listType = 'ol';
      }
      html.push(`<li>${inline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`);
      i++;
      continue;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      closeList();
      html.push('<hr>');
      i++;
      continue;
    }

    closeList();
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(```|[-*+]\s|\d+[.)]\s|#{1,4}\s|>|\$\$\s*$)/.test(lines[i]) &&
      !isTableRow(lines[i])
    ) {
      para.push(lines[i++]);
    }
    const text = para.join(' ');
    // A paragraph that is *exactly one* display-maths pair gets centred on
    // its own line. The pair count matters: the old greedy match hijacked
    // paragraphs that merely started and ended with $$ while holding several
    // pairs plus prose inside, and shoved the whole blob through the maths
    // renderer, where $ printed literally.
    const only = text.match(/^\s*\$\$((?:(?!\$\$)[\s\S])+)\$\$\s*$/);
    html.push(only ? `<p class="math-line">${renderMath(only[1], true)}</p>` : `<p>${inline(text)}</p>`);
  }

  closeList();
  return html.join('');
}

/** Wire up copy buttons inside a rendered message. */
export function bindCodeCopy(root) {
  root.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = btn.closest('.code')?.querySelector('code')?.textContent ?? '';
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = 'Copied';
        setTimeout(() => (btn.textContent = 'Copy'), 1400);
      } catch {
        btn.textContent = 'Press Ctrl+C';
      }
    });
  });
}
