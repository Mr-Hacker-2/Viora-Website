#!/usr/bin/env python3
"""Usage: python3 apply-viora-patch.py path/to/app.html
Applies targeted edits to Viora's app.html. Every edit must match exactly once or nothing is written.
Writes app.html.bak first, then checks the module script's syntax and that every $('#id') exists."""
import re, sys, shutil, subprocess, tempfile, os
p = sys.argv[1] if len(sys.argv) > 1 else 'app.html'
s = open(p, encoding='utf-8').read()
E = []
def ed(old, new): E.append((old, new))

# --- theme: default to dark violet (saved user choice in prefs.js still applies if it overrides) ---
ed('<html lang="en" data-theme="light" data-model="flash">', '<html lang="en" data-theme="dark" data-model="flash">')
ed('<meta name="theme-color" content="#f6f8fe">', '<meta name="theme-color" content="#120c26">')
ed('<p>Viora opens in the same soft light look as the extension, with its violet accent. Change the look here.</p>', '<p>Choose how Viora looks on this device.</p>')

# --- sidebar: Projects were unreachable (they lived in the hidden right panel); add a quiet app link ---
ed('<div id="projs" class="sh-agents"></div>', '')
ed('<h3>Your Projects <span class="sh-new">New</span></h3>', '')
ed('<div class="sh-invite"><b>Viora on your phone</b><small>Install this website like an app. No browser extension needed.</small><button type="button" id="sh-invite">Set up phone app</button></div>',
   '<h6>PROJECTS</h6>\n  <div id="projs" class="sh-agents"></div>\n  <a class="sh-getapp" href="mobile.html"><b>Get the Viora app</b><small>Add it to your Home Screen</small></a>')
ed("$('#sh-invite').onclick = () => { window.location.href = 'mobile.html'; };\n", '')

# --- new markup: rename dialog + jump-to-latest ---
ed('<button id="att" type="button" hidden></button>',
   '<button id="att" type="button" hidden></button>\n<dialog id="rdlg"><h3>Rename chat</h3><input type="text" id="r-name" maxlength="80" aria-label="Chat name"><div class="dl"><span style="flex:1"></span><button class="btn" id="r-x" type="button">Cancel</button><button class="btn p" id="r-ok" type="button">Save</button></div></dialog>\n<button id="jump" type="button" hidden aria-label="Jump to latest message">Jump to latest</button>')

# --- bug: [n] citation linking also rewrote code like arr[1] and existing [1](url) links ---
ed("function mdx(t, srcs) { const safe = Src.cleanSources(srcs || []); if (safe.length) t = t.replace(/\\[(\\d{1,2})\\]/g, (x, n) => safe[n - 1] ? `[${n}](${safe[n - 1].url})` : x); return renderMarkdown(t); }",
   "function mdx(t, srcs) { const safe = Src.cleanSources(srcs || []); if (safe.length) t = t.split(/(```[\\s\\S]*?(?:```|$)|`[^`\\n]*`)/).map((seg, i) => i % 2 ? seg : seg.replace(/\\[(\\d{1,2})\\](?!\\()/g, (x, n) => safe[n - 1] ? `[${n}](${safe[n - 1].url})` : x)).join(''); return renderMarkdown(t); }")

# --- bug: chats silently dropped when storage is full ---
ed("const save = () => { if (!ls.set(key, chats.slice(0, 80))) ls.set(key, chats.slice(0, 30)); };",
   "const save = () => { if (!ls.set(key, chats.slice(0, 80)) && !ls.set(key, chats.slice(0, 30))) toast('Could not save chats: browser storage is full or blocked. Export your data to keep them.', 8000); };")

# --- bug: Esc closing a dialog also cancelled a running reply; Esc now closes the drawer too ---
ed("if (e.key === 'Escape') { busy?.abort(); hide(); }", "if (e.key === 'Escape') { if (!document.querySelector('dialog[open]')) busy?.abort(); hide(); closeSb(); }")

# --- chat history: rename, confirm delete, touch/keyboard reachable ---
ed('<span class="hx" data-del="${x.id}" aria-label="Delete chat">×</span>',
   '<span class="hx hx-r" role="button" tabindex="0" data-ren="${x.id}" aria-label="Rename chat">✎</span><span class="hx" role="button" tabindex="0" data-del="${x.id}" aria-label="Delete chat">×</span>')
ed("const d = e.target.closest('[data-del]'); if (d) { e.stopPropagation(); chats = chats.filter(c => c.id !== d.dataset.del);",
   "const rn = e.target.closest('[data-ren]'); if (rn) { e.stopPropagation(); openRename(rn.dataset.ren); return; }\n  const d = e.target.closest('[data-del]'); if (d) { e.stopPropagation(); if (!confirm('Delete this chat? This cannot be undone.')) return; chats = chats.filter(c => c.id !== d.dataset.del);")
ed("const name = S.name || S.email.split('@')[0];\n",
"""let renId = null; const rdlg = $('#rdlg');
function openRename(id) { const c = chats.find(x => x.id === id); if (!c) return; renId = id; $('#r-name').value = c.title; rdlg.showModal(); $('#r-name').select(); }
function doRename() { const c = chats.find(x => x.id === renId), t = $('#r-name').value.trim().slice(0, 80); if (c && t) { c.title = t; save(); render(); } rdlg.close(); }
$('#r-ok').onclick = doRename; $('#r-x').onclick = () => rdlg.close();
$('#r-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doRename(); } });
$('#sh-hist').addEventListener('keydown', e => { const x = e.target.closest('.hx'); if (x && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); x.click(); } });
/* jump to latest: shown only when the reader has scrolled away from the bottom */
{ const th = $('#thread'), j = $('#jump'); const sync = () => { j.hidden = th.scrollHeight - th.scrollTop - th.clientHeight < 240; };
  th.addEventListener('scroll', sync, { passive: true }); j.onclick = () => { th.scrollTo({ top: th.scrollHeight, behavior: 'smooth' }); }; new MutationObserver(sync).observe(th, { childList: true, subtree: true }); }
const name = S.name || S.email.split('@')[0];
""")

# --- dark-violet surfaces, loaded last so it wins over the earlier stylesheets ---
ed('</head>', """<style id="viora-violet">
/* Dark-violet surfaces. Accent colour is left to accent.css / the user's Settings choice. */
:root[data-theme="dark"]{--ink:#0e0a1c;--ink-2:#160f2a;--raised:#1e1637;--line:#2e2551;--paper:#f2eeff;--muted:#b4abd8;--faint:#8479ad;--shadow:0 2px 10px #0000005c;--shadow-lg:0 16px 44px #0000008c}
:root[data-theme="dark"] #shell{background:radial-gradient(ellipse at 50% -20%,color-mix(in srgb,var(--accent) 16%,transparent),transparent 52%),var(--ink)!important}
:root[data-theme="dark"] .msg.user{background:color-mix(in srgb,var(--accent) 20%,var(--ink-2))}
.hx{opacity:0;width:24px;height:24px;display:grid;place-items:center;border-radius:6px;padding:0!important;cursor:pointer}
.hx.hx-r{right:32px}
.sh-hist button{padding-right:60px!important}
.sh-hist button:hover .hx,.sh-hist button:focus-within .hx,.sh-hist button.on .hx{opacity:.85}
.hx:hover,.hx:focus-visible{background:var(--raised);color:var(--paper);opacity:1!important}
@media(hover:none){.hx{opacity:.7}}
.sh-getapp{display:flex;flex-direction:column;gap:2px;margin-top:14px;padding:11px 13px;border:1px solid var(--line);border-radius:12px;color:var(--paper);text-decoration:none;font-size:13px;transition:border-color .16s,background .16s}
.sh-getapp small{color:var(--faint)}.sh-getapp:hover{border-color:var(--accent);background:var(--raised)}
#jump{position:fixed;left:50%;bottom:calc(150px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:30;border:1px solid var(--line);background:var(--ink-2);color:var(--paper);border-radius:999px;padding:7px 16px;font:inherit;font-size:13px;cursor:pointer;box-shadow:var(--shadow-lg)}
#jump:hover{border-color:var(--accent)}
.thread pre code{font-size:13px;line-height:1.6}
</style>
</head>""")

for old, new in E:
    n = s.count(old)
    if n != 1:
        sys.exit(f'ABORTED, nothing written. Expected 1 match, found {n} for:\n{old[:120]}')
    s = s.replace(old, new)

# --- checks ---
m = re.search(r'<script type="module">([\s\S]*?)</script>', s)
tmp = tempfile.NamedTemporaryFile('w', suffix='.mjs', delete=False, encoding='utf-8'); tmp.write(m.group(1)); tmp.close()
r = subprocess.run(['node', '--check', tmp.name], capture_output=True, text=True); os.unlink(tmp.name)
if r.returncode: sys.exit('ABORTED: syntax error in module script:\n' + r.stderr)
ids = set(re.findall(r'\sid="([^"]+)"', s)); dup = {i for i in ids if len(re.findall(r'\sid="%s"' % re.escape(i), s)) > 1}
miss = sorted({i for i in re.findall(r"\$\('#([\w-]+)'\)", m.group(1)) if i not in ids})
if dup or miss: sys.exit(f'ABORTED: duplicate ids {sorted(dup)} / missing ids {miss}')
shutil.copy(p, p + '.bak'); open(p, 'w', encoding='utf-8').write(s)
print('Patched', p, '(backup at', p + '.bak)', '- syntax OK, all ids resolve')
