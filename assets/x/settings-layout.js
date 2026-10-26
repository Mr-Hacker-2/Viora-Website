/* Viora Settings navigation — progressively enhances the existing settings dialog. */
(() => {
  'use strict';
  function init() {
    const dialog = document.querySelector('#sdlg');
    if (!dialog || dialog.dataset.sectioned === 'true') return;
    dialog.dataset.sectioned = 'true';

    const title = dialog.querySelector('h3');
    const intro = dialog.querySelector(':scope > p');
    const appearance = dialog.querySelector('#pf-mount');
    const personalityTitle = dialog.querySelector('.np-h');
    const personality = personalityTitle?.nextElementSibling;
    const speedTitle = dialog.querySelectorAll('.np-h')[1];
    const performance = dialog.querySelector('#np-mount');
    const chat = dialog.querySelector('.settings-section');
    const footer = dialog.querySelector('.dl:last-child');
    if (!title || !appearance || !chat || !footer) return;

    const nav = document.createElement('div');
    nav.className = 'settings-tabs';
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', 'Settings categories');

    const content = document.createElement('div');
    content.className = 'settings-panels';
    const definitions = [
      { id: 'appearance', label: 'Appearance', icon: 'sparkle' },
      { id: 'chat', label: 'Chat', icon: 'chat' },
      { id: 'ai', label: 'AI & Models', icon: 'bot' },
      { id: 'memory', label: 'Memory', icon: 'note' },
      { id: 'performance', label: 'Performance', icon: 'bolt' }
    ];
    const panels = {};
    const glyphs = {
      sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"/></svg>',
      chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z"/></svg>',
      bot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4M8 4h8M5 8h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/><path d="M9 14h.01M15 14h.01"/></svg>',
      note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
      bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7Z"/></svg>',
      external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></svg>'
    };
    definitions.forEach((item, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'settings-tab';
      button.id = 'settings-tab-' + item.id;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', 'settings-panel-' + item.id);
      button.setAttribute('aria-selected', String(i === 0));
      button.innerHTML = '<span class="settings-tab-icon" aria-hidden="true">' + glyphs[item.icon] + '</span><span>' + item.label + '</span>';
      nav.append(button);

      const panel = document.createElement('section');
      panel.className = 'settings-panel';
      panel.id = 'settings-panel-' + item.id;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', button.id);
      panel.hidden = i !== 0;
      panels[item.id] = panel;
      content.append(panel);

      button.addEventListener('click', () => activate(item.id));
      button.addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        const all = [...nav.querySelectorAll('[role="tab"]')];
        const current = all.indexOf(button);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 :
          (current + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length;
        all[next].focus();
        all[next].click();
      });
    });

    panels.appearance.append(appearance);
    panels.chat.append(chat);
    if (personalityTitle) panels.chat.append(personalityTitle);
    if (personality) panels.chat.append(personality);
    if (speedTitle) panels.performance.append(speedTitle);
    if (performance) panels.performance.append(performance);

    const aiIntro = document.createElement('p');
    aiIntro.className = 'settings-help';
    aiIntro.textContent = 'Choose the assistant that fits your task from the model selector in the chat header. Viora Auto can choose for you.';
    const aiButton = document.createElement('button');
    aiButton.type = 'button';
    aiButton.className = 'settings-action';
    aiButton.innerHTML = '<span class="settings-action-icon" aria-hidden="true">' + glyphs.external + '</span><span><b>Choose an assistant</b><small>Open the model picker in the chat header</small></span>';
    aiButton.addEventListener('click', () => {
      dialog.close();
      document.querySelector('#model-btn')?.click();
    });
    panels.ai.append(aiIntro, aiButton);

    const memoryIntro = document.createElement('p');
    memoryIntro.className = 'settings-help';
    memoryIntro.textContent = 'Review, search, add, or remove saved facts. Memory is managed separately from chat preferences.';
    const memoryButton = document.createElement('button');
    memoryButton.type = 'button';
    memoryButton.className = 'settings-action';
    memoryButton.innerHTML = '<span class="settings-action-icon" aria-hidden="true">' + glyphs.external + '</span><span><b>Manage memory</b><small>Review or change what Viora remembers</small></span>';
    memoryButton.addEventListener('click', () => {
      dialog.close();
      const memoryDialog = document.querySelector('#mdlg');
      if (memoryDialog && !memoryDialog.open) memoryDialog.showModal();
    });
    panels.memory.append(memoryIntro, memoryButton);

    title.insertAdjacentElement('afterend', nav);
    nav.insertAdjacentElement('afterend', content);
    if (intro) intro.hidden = true;

    function activate(id) {
      definitions.forEach(item => {
        const active = item.id === id;
        const button = nav.querySelector('#settings-tab-' + item.id);
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
        panels[item.id].hidden = !active;
      });
    }
    activate('appearance');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
