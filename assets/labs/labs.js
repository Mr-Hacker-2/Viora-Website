/* Viora Labs: discovery hub for the specialised assistants (Humanizer, Pro Search, Code, Math).
   Loaded by assets/x/pwa.js on app.html only. It reuses the existing assistants: "Try it" switches the app to the real
   assistant through the same model switch the chat already uses (#sh-model -> setAsst), so API calls, routing, sign-in,
   credits and saved chats are untouched. Nothing here talks to a backend. */
(() => {
  'use strict';
  if (window.__vioraLabs) return;
  const thread = document.getElementById('thread');
  const nav = document.querySelector('#sh-left .sh-nav');
  const navChat = document.getElementById('nav-chat');
  if (!thread || !nav || !navChat) return;
  window.__vioraLabs = true;

  const LAB_ASSISTANTS = ['search', 'math', 'human']; // assistant ids used by app.html
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const body = document.body;
  const LABS_API = 'https://viora-auth-website.onrender.com';
  let uid = 0;
  let publishedArticles = [];

  /* ---------- the glass test tube icon (custom SVG: glass body, violet liquid, highlights, glow) ---------- */
  const tube = (cls = '') => {
    const i = 'lt' + (++uid);
    return `<svg class="ico labs-tube ${cls}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="${i}g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".32" stop-color="#eadfff" stop-opacity=".14"/><stop offset=".7" stop-color="#b79cff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity=".45"/></linearGradient>
<linearGradient id="${i}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d2bcff"/><stop offset=".5" stop-color="#9061f9"/><stop offset="1" stop-color="#5b21b6"/></linearGradient>
<radialGradient id="${i}o" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#a78bfa" stop-opacity=".6"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/></radialGradient>
<clipPath id="${i}c"><path d="M11.6 4.6h8.8v17.2a4.4 4.4 0 0 1-8.8 0z"/></clipPath>
</defs>
<g transform="rotate(18 16 16)">
<ellipse cx="16" cy="21.5" rx="12" ry="10" fill="url(#${i}o)"/>
<path d="M11.6 4.6h8.8v17.2a4.4 4.4 0 0 1-8.8 0z" fill="url(#${i}g)" stroke="#a98bff" stroke-width="1.1"/>
<g clip-path="url(#${i}c)"><rect x="10" y="15.6" width="12" height="14" fill="url(#${i}l)"/><ellipse cx="16" cy="15.8" rx="4.4" ry="1.15" fill="#eadcff" opacity=".9"/><circle cx="14.4" cy="21" r=".9" fill="#fff" opacity=".7"/><circle cx="17.6" cy="23.2" r=".6" fill="#fff" opacity=".6"/><circle cx="16.6" cy="19.2" r=".45" fill="#fff" opacity=".6"/></g>
<ellipse cx="16" cy="4.6" rx="5.2" ry="1.35" fill="#fff" fill-opacity=".18" stroke="#efe7ff" stroke-width="1.1"/>
<path d="M13.3 7.4v11" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".85"/>
<path d="M18.9 8.4v5.2" stroke="#fff" stroke-width=".9" stroke-linecap="round" opacity=".4"/>
<path d="M13.4 22.4a2.8 2.8 0 0 0 1.4 1.7" stroke="#fff" stroke-width=".9" stroke-linecap="round" fill="none" opacity=".55"/>
</g></svg>`;
  };

  /* ---------- original artwork: one inline SVG per tool, same palette and glass style, ~2 KB each, no network ---------- */
  const bg = p => `<defs><radialGradient id="${p}bg" cx=".72" cy=".28" r="1"><stop offset="0" stop-color="#5b34b8"/><stop offset=".55" stop-color="#27155a"/><stop offset="1" stop-color="#120a2b"/></radialGradient><linearGradient id="${p}gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".26"/><stop offset="1" stop-color="#c4b5fd" stop-opacity=".05"/></linearGradient><linearGradient id="${p}ac" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#eadcff"/></linearGradient><filter id="${p}bl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter></defs><rect width="480" height="300" fill="url(#${p}bg)"/>`;
  const svg = (p, label, inner) => `<svg viewBox="0 0 480 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(label)}">${bg(p)}${inner}</svg>`;

  const ART = {
    humanizer: () => svg('hz', 'Stiff text flowing into polished writing', `
<circle cx="372" cy="96" r="86" fill="#8b5cf6" opacity=".4" filter="url(#hzbl)"/><circle cx="90" cy="244" r="60" fill="#6d28d9" opacity=".35" filter="url(#hzbl)"/>
<g transform="rotate(-5 110 150)"><rect x="34" y="66" width="152" height="170" rx="16" fill="url(#hzgl)" stroke="#fff" stroke-opacity=".28"/><g fill="#b9b4d6" opacity=".6"><rect x="54" y="92" width="96" height="10" rx="2"/><rect x="54" y="114" width="112" height="10" rx="2"/><rect x="54" y="136" width="70" height="10" rx="2"/><rect x="54" y="158" width="108" height="10" rx="2"/><rect x="54" y="180" width="84" height="10" rx="2"/></g></g>
<path d="M198 152C226 112 252 196 290 152" fill="none" stroke="url(#hzac)" stroke-width="4" stroke-linecap="round"/><circle cx="292" cy="152" r="12" fill="#c4b5fd" opacity=".35"/><circle cx="292" cy="152" r="6" fill="#f3e8ff"/>
<g class="lab-float"><g transform="rotate(4 372 150)"><rect x="296" y="54" width="154" height="192" rx="18" fill="url(#hzgl)" stroke="#fff" stroke-opacity=".34"/><g fill="url(#hzac)"><rect x="318" y="84" width="104" height="8" rx="4"/><rect x="318" y="106" width="110" height="8" rx="4" opacity=".85"/><rect x="318" y="128" width="84" height="8" rx="4" opacity=".9"/><rect x="318" y="150" width="108" height="8" rx="4" opacity=".8"/><rect x="318" y="172" width="64" height="8" rx="4" opacity=".7"/></g><path d="M318 208h52" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/></g></g>
<g font-family="Georgia,serif" font-size="12" fill="#efe7ff" text-anchor="middle"><g class="lab-float"><rect x="150" y="34" width="82" height="24" rx="12" fill="#fff" fill-opacity=".12" stroke="#fff" stroke-opacity=".3"/><text x="191" y="50">moreover</text></g><g class="lab-float2"><rect x="206" y="236" width="74" height="24" rx="12" fill="#fff" fill-opacity=".12" stroke="#fff" stroke-opacity=".3"/><text x="243" y="252">utilize</text></g><g class="lab-float2"><rect x="20" y="28" width="82" height="24" rx="12" fill="#fff" fill-opacity=".1" stroke="#fff" stroke-opacity=".25"/><text x="61" y="44">leverage</text></g></g>`),

    'pro-search': () => svg('ps', 'Connected knowledge nodes around a glowing search lens', `
<circle cx="240" cy="146" r="96" fill="#8b5cf6" opacity=".4" filter="url(#psbl)"/>
<g stroke="#c4b5fd" stroke-opacity=".45" stroke-width="1.5" fill="none"><path d="M240 146L84 66M240 146L150 238M240 146L392 58M240 146L424 196M240 146L330 262M240 146L52 176M84 66L52 176M392 58L424 196M150 238L330 262M424 196L330 262"/></g>
<g fill="url(#psac)"><circle cx="84" cy="66" r="9"/><circle cx="150" cy="238" r="9"/><circle cx="392" cy="58" r="9"/><circle cx="424" cy="196" r="9"/><circle cx="330" cy="262" r="9"/><circle cx="52" cy="176" r="9"/></g>
<g fill="#c4b5fd" opacity=".22"><circle cx="84" cy="66" r="18"/><circle cx="392" cy="58" r="18"/><circle cx="424" cy="196" r="18"/><circle cx="150" cy="238" r="18"/></g>
<g font-family="system-ui,sans-serif" font-size="11" fill="#efe7ff" text-anchor="middle"><g class="lab-float"><rect x="96" y="40" width="64" height="22" rx="11" fill="#fff" fill-opacity=".12" stroke="#fff" stroke-opacity=".3"/><text x="128" y="55">source</text></g><g class="lab-float2"><rect x="398" y="206" width="62" height="22" rx="11" fill="#fff" fill-opacity=".12" stroke="#fff" stroke-opacity=".3"/><text x="429" y="221">cite</text></g></g>
<g class="lab-float2"><path d="M277 183l42 42" stroke="url(#psac)" stroke-width="13" stroke-linecap="round"/><circle cx="240" cy="146" r="56" fill="url(#psgl)" stroke="url(#psac)" stroke-width="7"/><path d="M204 128a40 40 0 0 1 28-26" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="5" stroke-linecap="round"/><path d="M240 124l5 17 17 5-17 5-5 17-5-17-17-5 17-5z" fill="#f3e8ff"/></g>`),

    code: () => svg('cd', 'A glass code editor with floating brackets', `
<circle cx="150" cy="80" r="90" fill="#8b5cf6" opacity=".38" filter="url(#cdbl)"/><circle cx="400" cy="240" r="70" fill="#6d28d9" opacity=".4" filter="url(#cdbl)"/>
<g class="lab-float2"><rect x="66" y="46" width="348" height="208" rx="18" fill="url(#cdgl)" stroke="#fff" stroke-opacity=".32"/><path d="M66 84h348" stroke="#fff" stroke-opacity=".18"/><circle cx="90" cy="65" r="5" fill="#f0abfc"/><circle cx="108" cy="65" r="5" fill="#c4b5fd"/><circle cx="126" cy="65" r="5" fill="#a78bfa"/>
<g><rect x="92" y="106" width="70" height="9" rx="4.5" fill="#c4b5fd"/><rect x="170" y="106" width="104" height="9" rx="4.5" fill="#fff" fill-opacity=".5"/><rect x="112" y="128" width="54" height="9" rx="4.5" fill="#f0abfc"/><rect x="174" y="128" width="136" height="9" rx="4.5" fill="#fff" fill-opacity=".4"/><rect x="112" y="150" width="96" height="9" rx="4.5" fill="#a78bfa"/><rect x="216" y="150" width="62" height="9" rx="4.5" fill="#fff" fill-opacity=".45"/><rect x="132" y="172" width="120" height="9" rx="4.5" fill="#fff" fill-opacity=".4"/><rect x="112" y="194" width="42" height="9" rx="4.5" fill="#c4b5fd"/><rect x="92" y="216" width="30" height="9" rx="4.5" fill="#f0abfc"/><rect x="130" y="214" width="9" height="14" rx="2" fill="#eadcff"/></g>
<text x="352" y="218" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="50" font-weight="700" fill="url(#cdac)" text-anchor="middle" opacity=".95">&lt;/&gt;</text></g>
<g font-family="ui-monospace,Menlo,Consolas,monospace" fill="#eadcff" font-weight="700"><text class="lab-float" x="30" y="150" font-size="44" opacity=".85">{ }</text><text class="lab-float2" x="420" y="92" font-size="30" opacity=".8">=&gt;</text><text class="lab-float" x="396" y="286" font-size="28" opacity=".6">;</text></g>`),

    math: () => svg('mt', 'Floating equations, symbols and geometric shapes', `
<circle cx="240" cy="110" r="100" fill="#8b5cf6" opacity=".36" filter="url(#mtbl)"/><circle cx="90" cy="250" r="60" fill="#6d28d9" opacity=".38" filter="url(#mtbl)"/>
<path d="M24 205C76 150 126 258 180 205S284 152 336 205 432 256 462 205" fill="none" stroke="url(#mtac)" stroke-width="3.5" stroke-linecap="round" opacity=".85"/>
<path d="M24 205h438M240 160v90" stroke="#fff" stroke-opacity=".16"/>
<g class="lab-float2"><path d="M240 42l52 26-52 26-52-26z" fill="#fff" fill-opacity=".34" stroke="#fff" stroke-opacity=".6"/><path d="M188 68l52 26v62l-52-26z" fill="#c4b5fd" fill-opacity=".22" stroke="#fff" stroke-opacity=".45"/><path d="M292 68l-52 26v62l52-26z" fill="#8b5cf6" fill-opacity=".3" stroke="#fff" stroke-opacity=".45"/></g>
<g font-family="Georgia,'Times New Roman',serif" fill="url(#mtac)"><text class="lab-float" x="44" y="112" font-size="76" opacity=".92">&#8721;</text><text class="lab-float2" x="372" y="110" font-size="68" font-style="italic" opacity=".92">&#960;</text><text class="lab-float2" x="62" y="262" font-size="66" opacity=".85">&#8747;</text><text class="lab-float" x="352" y="270" font-size="40" opacity=".9">&#8730;x</text></g>
<g class="lab-float" fill="none" stroke="#eadcff" stroke-opacity=".7" stroke-width="2"><circle cx="330" cy="62" r="22" fill="#fff" fill-opacity=".08"/><path d="M150 232l28-46 28 46z" fill="#fff" fill-opacity=".08"/></g>
<text x="240" y="284" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="16" fill="#eadcff" opacity=".8">a&#178; + b&#178; = c&#178;</text>`)
  };

  /* ---------- content: only capabilities that exist in the app are listed ---------- */
  const SHARED_NOTE = 'Code and Math both open Viora’s Math & Code assistant, so you can mix equations and programs in one conversation.';
  const TOOLS = [
    {
      id: 'humanizer', assistant: 'human', name: 'Humanizer',
      short: 'Polish your writing so it reads naturally, while keeping your meaning and your voice.',
      caps: ['Natural phrasing', 'Clearer flow', 'Meaning preserved'],
      long: 'Humanizer refines stiff, repetitive or awkward writing into clear, natural prose, without changing what you meant to say.',
      does: 'Paste a draft and Humanizer rewrites it for readability: smoother sentences, less repeated wording, better transitions and tighter paragraphs, in the writing style you choose.',
      list: ['Improve writing quality, grammar and readability', 'Make sentences sound more natural', 'Reduce repetitive wording', 'Improve transitions and paragraph flow', 'Preserve your original meaning and voice', 'Choose a writing style, and work through long drafts in parts'],
      tasks: ['Smooth out an essay paragraph that feels stiff', 'Make a cover letter sound more like you', 'Reduce repeated words in a report introduction', 'Tidy the grammar of a rough first draft'],
      when: ['Your draft is correct but reads robotic or repetitive', 'You want cleaner transitions between paragraphs', 'You want to keep your own ideas while polishing the wording'],
      note: 'Humanizer improves writing quality. It does not guarantee any result from AI-detection tools. Use it to refine your own work.'
    },
    {
      id: 'pro-search', assistant: 'search', name: 'Pro Search',
      short: 'Research complex questions across live web sources, with citations you can check.',
      caps: ['Live web search', 'Source links', 'Quick or deep mode'],
      long: 'Pro Search investigates a question across the live web and answers with citations, so you can see where every claim came from.',
      does: 'Ask a research question and Pro Search looks up web sources, reads the most relevant pages and writes an answer with numbered citations and source cards.',
      list: ['Search the web for current information', 'Find relevant sources and link to them', 'Compare information from different sources', 'Summarize research with citations', 'Quick mode: one search pass. Deep mode: up to 3 focused searches and up to 6 pages read'],
      tasks: ['Compare recent research on renewable energy', 'Find official documentation for a JavaScript API', 'Summarize the latest AI regulation news', 'Compare two viewpoints using reliable sources'],
      when: ['You need information that may be newer than a model’s memory', 'You want to verify claims against their sources', 'A topic needs several sources compared'],
      note: 'Pro Search relies on live web results. For anything important, open the cited sources yourself.'
    },
    {
      id: 'code', assistant: 'math', name: 'Code',
      short: 'Write, debug, explain and improve code in many programming languages.',
      caps: ['Debug errors', 'Explain code', 'Many languages'],
      long: 'Code is your programming partner: describe what you need, paste what is broken, and get working, explained solutions.',
      does: 'Describe a task or paste code and Code writes it, finds the bug, explains how it works or suggests improvements, in the language you use.',
      list: ['Write code from a description', 'Debug programming errors', 'Explain code step by step', 'Improve and refactor existing code', 'Build small projects step by step', 'Review programming solutions', 'Work with many programming languages'],
      tasks: ['Why does for(i=0;i<5;i--){} never end?', 'Write a Python palindrome checker', 'Explain Big-O notation simply', 'Review a function for edge cases'],
      when: ['You hit an error you cannot explain', 'You want a second opinion on your solution', 'You are learning a new language or concept'],
      note: 'Code writes and explains code in the chat. It does not run programs or connect to your repositories, so test results yourself. ' + SHARED_NOTE
    },
    {
      id: 'math', assistant: 'math', name: 'Math',
      short: 'Solve problems step by step and understand the reasoning behind every answer.',
      caps: ['Step-by-step', 'Algebra & equations', 'Check your work'],
      long: 'Math works through problems with you, showing each step so you understand the method, not just the answer.',
      does: 'Give Math a problem, a formula or your own working. It solves, explains each step in plain language and can check your reasoning.',
      list: ['Solve mathematical problems', 'Explain solutions step by step', 'Work through algebra and equations', 'Perform calculations', 'Explain formulas and mathematical concepts', 'Check your mathematical reasoning'],
      tasks: ['Solve 3x² − 12 = 0 with steps', 'Explain what a derivative means', 'Check my factoring of x² − 5x + 6', 'Work out a percentage change'],
      when: ['You are stuck partway through a problem', 'You want to understand a method, not only get the answer', 'You want to verify your own working'],
      note: 'Double-check results you depend on. ' + SHARED_NOTE
    }
  ];

  /* ---------- views ---------- */
  const arrow = '<svg class="labs-arrow" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const back = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M16 10H5M9 5l-5 5 5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const view = document.createElement('section');
  view.id = 'labs-view';
  view.setAttribute('aria-label', 'Viora Labs');
  thread.after(view);

  const toolArt = t => t.imageId
    ? `<img class="labs-custom-art" src="${LABS_API}/api/labs/media/${encodeURIComponent(t.imageId)}" alt="" loading="lazy">`
    : (ART[t.id] ? ART[t.id]() : `<div class="labs-generic-art">${esc(t.icon || '✦')}</div>`);
  const card = t => `<a class="labs-card" href="#labs/${t.id}" aria-label="${esc(t.name)}: ${esc(t.short)}">
<div class="labs-art">${toolArt(t)}</div>
<div class="labs-card-body">${t.featured ? '<span class="labs-featured">Featured</span>' : ''}<h3>${esc(t.name)}</h3><p>${esc(t.short)}</p>
<ul class="labs-caps">${(t.caps || []).map(c => `<li>${esc(c)}</li>`).join('')}</ul>
<span class="labs-explore">${t.assistant ? 'Explore' : 'Coming soon'} ${arrow}</span></div></a>`;
  const renderArticleCards = () => publishedArticles.length ? publishedArticles.map(a => `<a class="labs-article-card" href="/labs-article.html?slug=${encodeURIComponent(a.id)}">${a.coverImageId ? `<img src="${LABS_API}/api/labs/media/${encodeURIComponent(a.coverImageId)}" alt="" loading="lazy">` : '<div class="labs-article-art">VIORA LABS</div>'}<div class="labs-article-card-copy"><span>${esc(a.category || 'Technology')}${a.featured ? ' · Featured' : ''}</span><h4>${esc(a.title)}</h4><p>${esc(a.subtitle)}</p><small>${esc(a.author || 'Viora Team')} · ${a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : ''}</small></div></a>`).join('') : '<div class="labs-articles-empty">New research and product updates will appear here.</div>';
  const homeHtml = () => `<div class="labs-wrap labs-page">
<header class="labs-hero">${tube('labs-hero-tube')}<h2 tabindex="-1">Viora Labs</h2><p>Explore specialized AI tools built to help you write, research, code, and solve problems.</p></header>
<div class="labs-grid">${TOOLS.filter(t => t.active !== false).sort((a,b) => (a.order||0)-(b.order||0)).map(card).join('')}</div>
<section class="labs-articles-section"><div class="labs-articles-heading"><div><span class="labs-section-kicker">IDEAS · RESEARCH · BUILDS</span><h3>From Viora Labs</h3><p>Updates, explainers, and ideas from the world of technology.</p></div><a href="/labs-article.html">Explore articles</a></div>
<div class="labs-article-filters"><input id="labs-article-search" type="search" placeholder="Search articles…" aria-label="Search Labs articles"><select id="labs-article-category" aria-label="Filter articles by category"><option value="">All categories</option>${[...new Set(publishedArticles.map(a=>a.category).filter(Boolean))].sort().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div>
<div class="labs-articles-grid" id="labs-articles-grid">${renderArticleCards()}</div></section></div>`;

  const sec = (title, inner) => `<section class="labs-sec"><h3>${esc(title)}</h3>${inner}</section>`;
  const ul = items => `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
  let pendingError = '';

  const detailHtml = t => `<div class="labs-wrap labs-page" data-tool="${t.id}">
<a class="labs-back" href="#labs">${back} Labs</a>
<section class="labs-detail-hero"><div class="labs-art labs-art-big">${toolArt(t)}</div>
<div class="labs-intro"><span class="labs-eyebrow">${tube('labs-eyebrow-tube')} Viora Labs</span><h2 tabindex="-1">${esc(t.name)}</h2><p class="labs-lead">${esc(t.long)}</p>
<div class="labs-actions">${t.assistant ? `<button type="button" class="labs-try" data-try="${t.id}"><span class="labs-try-label">Try ${esc(t.name)}</span>${arrow}<span class="labs-spin" aria-hidden="true"></span></button>` : '<span class="labs-upcoming">Coming soon</span>'}<a class="labs-ghost" href="#labs">Back to Labs</a>${t.documentationUrl ? `<a class="labs-ghost" href="${esc(t.documentationUrl)}" target="_blank" rel="noopener noreferrer">Documentation</a>` : ''}</div>
<p class="labs-err" role="alert"${pendingError ? '' : ' hidden'}>${esc(pendingError)}</p>
<p class="labs-note">${esc(t.note)}</p></div></section>
<div class="labs-secs">${sec('What it does', `<p>${esc(t.does)}</p>`)}${sec('Main capabilities', ul(t.list))}${sec('Example tasks', ul(t.tasks))}${sec('When to use it', ul(t.when))}</div></div>`;

  /* ---------- sidebar entry and tool-mode chip ---------- */
  const navBtn = document.createElement('button');
  navBtn.type = 'button'; navBtn.id = 'nav-labs';
  navBtn.innerHTML = tube() + ' Labs';
  navBtn.setAttribute('aria-label', 'Labs: specialized AI tools');
  navChat.after(navBtn);

  const bar = document.querySelector('#sh-center > .bar');
  const chip = document.createElement('a');
  chip.className = 'labs-chip'; chip.href = '#labs'; chip.title = 'Back to Labs'; chip.setAttribute('aria-label', 'Back to Labs');
  chip.innerHTML = tube() + '<span>Labs</span>';
  if (bar) bar.append(chip);

  /* ---------- state helpers ---------- */
  const activeAssistant = () => { try { return JSON.parse(localStorage.getItem('viora_assistant')); } catch { return null; } };
  let chatWasOn = false;

  function showShell() {
    body.classList.add('labs-open');
    body.classList.remove('sb'); // close the phone drawer
    const of = document.getElementById('open-full'); if (of) of.setAttribute('aria-expanded', 'false');
    chatWasOn = navChat.classList.contains('on') || chatWasOn;
    navChat.classList.remove('on'); navBtn.classList.add('on'); navBtn.setAttribute('aria-current', 'page');
  }
  function hideShell() {
    body.classList.remove('labs-open');
    navBtn.classList.remove('on'); navBtn.removeAttribute('aria-current');
    if (chatWasOn) navChat.classList.add('on');
    chatWasOn = false;
  }
  function leave() { // close Labs and clear #labs from the address without adding history
    hideShell();
    if (/^#labs/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  }
  function bindArticleFilters() {
    const search=document.getElementById('labs-article-search'), category=document.getElementById('labs-article-category');
    const render=()=>{const q=(search?.value||'').trim().toLowerCase(),cat=category?.value||'';const rows=publishedArticles.filter(a=>(!cat||a.category===cat)&&(!q||(a.title+' '+a.subtitle+' '+(a.tags||[]).join(' ')).toLowerCase().includes(q)));const root=document.getElementById('labs-articles-grid');if(!root)return;root.innerHTML=rows.length?rows.map(a=>`<a class="labs-article-card" href="/labs-article.html?slug=${encodeURIComponent(a.id)}">${a.coverImageId?`<img src="${LABS_API}/api/labs/media/${encodeURIComponent(a.coverImageId)}" alt="" loading="lazy">`:'<div class="labs-article-art">VIORA LABS</div>'}<div class="labs-article-card-copy"><span>${esc(a.category||'Technology')}</span><h4>${esc(a.title)}</h4><p>${esc(a.subtitle)}</p><small>${esc(a.author||'Viora Team')} · ${a.publishedAt?new Date(a.publishedAt).toLocaleDateString():''}</small></div></a>`).join(''):'<div class="labs-articles-empty">No articles match your search.</div>';};search?.addEventListener('input',render);category?.addEventListener('change',render);
  }
  async function loadPublishedContent() {
    try { const response=await fetch(LABS_API+'/api/labs/content',{cache:'no-store'});if(!response.ok)return;const data=await response.json();
      if(Array.isArray(data.tools)&&data.tools.length){const base=new Map(TOOLS.map(t=>[t.id,t]));const merged=data.tools.map(remote=>{const old=base.get(remote.id);return {...(old||{caps:[],list:[],tasks:[],when:[],note:remote.assistant?'This opens its connected Viora assistant.':'This tool is not connected to an assistant yet.'}),...remote,long:remote.description||old?.long||remote.short,does:remote.description||old?.does||remote.short,assistant:remote.assistant||'',caps:old?.caps||[remote.category||'Labs tool']};});TOOLS.splice(0,TOOLS.length,...merged);}
      publishedArticles=Array.isArray(data.articles)?data.articles:[];if(body.classList.contains('labs-open')&&location.hash==='#labs'){const y=view.scrollTop;view.innerHTML=homeHtml();bindArticleFilters();view.scrollTop=y;}
    } catch { /* Built-in tools remain available if publishing storage is offline. */ }
  }
  function route() {
    const m = /^#labs(?:\/([a-z-]+))?$/.exec(location.hash);
    if (!m) { if (body.classList.contains('labs-open')) hideShell(); return; }
    const t = TOOLS.find(x => x.id === m[1]);
    showShell();
    view.innerHTML = t ? detailHtml(t) : homeHtml();
    if (!t) bindArticleFilters();
    pendingError = '';
    view.scrollTop = 0;
    view.scrollTo(0, 0);
    /* Re-apply after the display/layout change so the hub always opens at its real top. */
    requestAnimationFrame(() => { if (body.classList.contains('labs-open')) view.scrollTo(0, 0); });
    const h = view.querySelector('h2'); if (h) h.focus({ preventScroll: true });
  }

  /* Switch the app to a real assistant through the chat's own model switch (#sh-model -> setAsst). */
  function switchAssistant(id, label) {
    const sel = $('#sh-model');
    if (!sel) return false;
    if (!sel.querySelector(`option[value="${id}"]`)) sel.add(new Option(label, id));
    sel.value = id;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function launch(t, btn) {
    if (!t.assistant || !LAB_ASSISTANTS.includes(t.assistant)) return;
    btn.disabled = true; btn.classList.add('busy'); btn.setAttribute('aria-busy', 'true');
    let ok = false;
    try { sessionStorage.setItem('viora_labs_session', '1'); } catch {}
    try { ok = switchAssistant(t.assistant, t.name); } catch { ok = false; }
    if (ok) { hideShell(); if (/^#labs/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); }
    setTimeout(() => {
      if (ok && activeAssistant() === t.assistant) { sync(); return; }
      pendingError = 'Could not open ' + t.name + '. Refresh the page and try again.';
      if (location.hash === '#labs/' + t.id) route(); else location.hash = 'labs/' + t.id;
    }, 350);
  }

  view.addEventListener('click', e => {
    const b = e.target.closest('[data-try]');
    if (!b) return;
    const t = TOOLS.find(x => x.id === b.dataset.try);
    if (t) launch(t, b);
  });
  navBtn.addEventListener('click', () => { if (location.hash === '#labs') route(); else location.hash = 'labs'; });
  window.addEventListener('hashchange', route);

  /* Leaving Labs through the normal sidebar actions. AI Chat always returns to Viora Flash. */
  document.getElementById('sh-left').addEventListener('click', e => {
    if (!body.classList.contains('labs-open') || e.target.closest('#nav-labs')) return;
    if (e.target.closest('#nav-chat')) {
      if (LAB_ASSISTANTS.includes(activeAssistant())) switchAssistant('flash', 'Viora Flash');
      leave();
    } else if (e.target.closest('#new-thread, #sh-hist')) leave();
  }, true);

  /* ---------- keep the normal model selector free of the Labs tools ---------- */
  function prune() {
    const sel = $('#sh-model');
    if (!sel) return;
    [...sel.options].forEach(o => { if (LAB_ASSISTANTS.includes(o.value) && !o.selected) o.remove(); });
  }
  function sync() {
    body.classList.toggle('labs-tool', LAB_ASSISTANTS.includes(activeAssistant()));
    prune();
  }
  const sel = $('#sh-model');
  if (sel) new MutationObserver(prune).observe(sel, { childList: true });
  const pill = $('#pill-name');
  if (pill) new MutationObserver(sync).observe(pill, { childList: true, characterData: true, subtree: true });
  sync();
  route();
  loadPublishedContent();
})();