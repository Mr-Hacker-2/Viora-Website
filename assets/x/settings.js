const DEFAULTS = {
  enterToSend: true,
  compactChat: false,
  animations: true,
  customInstructions: ''
};

export function initSettings(host) {
  const dialog = document.getElementById('sdlg');
  if (!dialog) return { open() {} };
  const key = 'viora_settings_' + String(host.email || '').toLowerCase();
  const read = () => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(key) || '{}') }; }
    catch { return { ...DEFAULTS }; }
  };
  let state = read();
  const save = () => {
    try { localStorage.setItem(key, JSON.stringify(state)); }
    catch { status('Could not save settings. Browser storage may be full or blocked.', true); }
    apply();
  };
  const statusEl = dialog.querySelector('#settings-status');
  function status(message, error = false) {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.dataset.error = error ? 'true' : 'false';
  }
  function apply() {
    document.documentElement.classList.toggle('viora-compact', !!state.compactChat);
    document.documentElement.classList.toggle('viora-no-motion', !state.animations);
  }
  function activate(name) {
    dialog.querySelectorAll('[data-settings-tab]').forEach(button => {
      const active = button.dataset.settingsTab === name;
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    dialog.querySelectorAll('[data-settings-panel]').forEach(panel => {
      panel.hidden = panel.dataset.settingsPanel !== name;
    });
    const heading = dialog.querySelector('#settings-section-title');
    const activeButton = dialog.querySelector('[data-settings-tab="' + name + '"]');
    if (heading && activeButton) heading.textContent = activeButton.textContent.trim();
    status('');
  }
  dialog.addEventListener('click', async event => {
    const tab = event.target.closest('[data-settings-tab]');
    if (tab) { activate(tab.dataset.settingsTab); return; }
    const action = event.target.closest('[data-settings-action]');
    if (!action) return;
    const name = action.dataset.settingsAction;
    if (name === 'save-profile') {
      const input = dialog.querySelector('#settings-display-name');
      const value = input.value.trim();
      if (!value || value.length > 80) { status('Enter a display name between 1 and 80 characters.', true); input.focus(); return; }
      action.disabled = true;
      try {
        const response = await fetch(host.api + '/api/account/profile', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + host.token(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: value })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Your profile could not be saved.');
        host.onNameSaved(value);
        status('Your display name has been updated.');
      } catch (error) { status(error.message || 'Your profile could not be saved.', true); }
      finally { action.disabled = false; }
    }
    if (name === 'export-data') host.exportData();
    if (name === 'clear-chats') host.clearChats();
    if (name === 'open-memory') host.openMemory();
    if (name === 'sign-out') host.signOut();
    if (name === 'delete-account') {
      const email = dialog.querySelector('#settings-delete-email').value.trim().toLowerCase();
      const word = dialog.querySelector('#settings-delete-word').value.trim();
      if (email !== String(host.email || '').toLowerCase() || word !== 'DELETE') {
        status('Enter your exact account email and type DELETE to continue.', true);
        return;
      }
      const confirmed = window.confirm('Permanently delete your Viora account and all account-owned server data, including stored files and previous file versions? This cannot be undone. After deletion finishes, you can sign up again with the same email as a completely new account.');
      if (!confirmed) return;
      action.disabled = true;
      status('Deleting your account and associated data…');
      try {
        const response = await fetch(host.api + '/api/account/delete', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + host.token(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, confirmation: word })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Account deletion could not be completed.');
        status('Account deleted. Signing out…');
        host.onDeleted();
      } catch (error) {
        status(error.message || 'Account deletion could not be completed. You can safely retry.', true);
        action.disabled = false;
      }
    }
  });
  dialog.addEventListener('change', event => {
    const target = event.target;
    if (target.matches('[data-setting]')) {
      const field = target.dataset.setting;
      state[field] = target.type === 'checkbox' ? target.checked : target.value;
      save();
      if (field === 'defaultModel' && host.setAssistant) host.setAssistant(target.value);
    }
  });
  dialog.addEventListener('input', event => {
    const target = event.target;
    if (target.matches('[data-setting="customInstructions"]')) {
      state.customInstructions = target.value.slice(0, 2000);
      save();
    }
  });
  const nameInput = dialog.querySelector('#settings-display-name');
  const emailEl = dialog.querySelector('#settings-email');
  if (nameInput) nameInput.value = host.name() || '';
  if (emailEl) emailEl.textContent = host.email || '';
  const enter = dialog.querySelector('[data-setting="enterToSend"]');
  const compact = dialog.querySelector('[data-setting="compactChat"]');
  const animations = dialog.querySelector('[data-setting="animations"]');
  const instructions = dialog.querySelector('[data-setting="customInstructions"]');
  const model = dialog.querySelector('[data-setting="defaultModel"]');
  if (enter) enter.checked = state.enterToSend !== false;
  if (compact) compact.checked = !!state.compactChat;
  if (animations) animations.checked = state.animations !== false;
  if (instructions) instructions.value = state.customInstructions || '';
  if (model) model.value = host.assistant() || 'auto';
  apply();

  async function loadAccount() {
    try {
      const response = await fetch(host.api + '/api/account/plan', {
        headers: { Authorization: 'Bearer ' + host.token() }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Account details are unavailable.');
      const plan = dialog.querySelector('#settings-plan');
      const created = dialog.querySelector('#settings-created');
      if (plan) plan.textContent = data.premium ? 'Viora Premium' : 'Free plan';
      if (created) created.textContent = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'Not available';
      if (nameInput && data.name) nameInput.value = data.name;
    } catch {
      const plan = dialog.querySelector('#settings-plan');
      if (plan) plan.textContent = 'Could not load plan';
    }
  }
  return {
    open() {
      state = read();
      if (nameInput) nameInput.value = host.name() || '';
      if (enter) enter.checked = state.enterToSend !== false;
      if (compact) compact.checked = !!state.compactChat;
      if (animations) animations.checked = state.animations !== false;
      if (instructions) instructions.value = state.customInstructions || '';
      if (model) model.value = host.assistant() || 'auto';
      apply();
      activate('general');
      status('');
      loadAccount();
    }
  };
}
