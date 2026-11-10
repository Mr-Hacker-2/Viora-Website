(() => {
  'use strict';

  const api = 'https://viora-auth-website.onrender.com';
  const body = document.getElementById('users-body');
  const dialog = document.getElementById('user-details');
  const detailsList = document.getElementById('user-details-list');
  const methodFilter = document.getElementById('user-method-filter');
  const sortSelect = document.getElementById('user-sort');
  let pageUsers = [];
  let loadId = 0;

  function authToken() {
    try {
      return sessionStorage.getItem('viora_admin_session') ||
        JSON.parse(localStorage.getItem('viora_session') || 'null')?.token || '';
    } catch {
      return '';
    }
  }

  function dateLabel(value) {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    return Number.isNaN(+date) ? 'Not recorded' : date.toLocaleString();
  }

  function showDetails(user) {
    detailsList.replaceChildren();
    const fields = [
      ['User ID', 'Not returned by the account API'],
      ['Account identifier', user.email],
      ['Name', user.name || 'Not set'],
      ['Authentication method', user.provider === 'password' ? 'Email and password' : 'Google'],
      ['Created', dateLabel(user.createdAt)],
      ['Last login', dateLabel(user.lastLoginAt)],
      ['Sign-ins', String(user.logins || 0)],
      ['Account status', user.status === 'suspended' ? 'Disabled' : 'Enabled'],
      ['Email verified', user.emailVerified ? 'Verified' : 'Not verified'],
      ['Role', user.role]
    ];
    for (const [label, value] of fields) {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      detailsList.append(term, description);
    }
    dialog.showModal();
  }

  function applyControls() {
    const method = methodFilter.value;
    const key = sortSelect.value;
    const sorted = [...pageUsers].sort((a, b) => {
      if (key === 'email') return a.user.email.localeCompare(b.user.email);
      if (key === 'provider') return a.user.provider.localeCompare(b.user.provider);
      return String(b.user[key] || '').localeCompare(String(a.user[key] || ''));
    });
    for (const row of sorted) {
      const matches = method === 'all' || row.user.provider === method;
      row.element.hidden = !matches;
      body.append(row.element);
    }
  }

  async function enrichRows() {
    const thisLoad = ++loadId;
    const rows = [...body.querySelectorAll(':scope > tr')];
    if (!rows.length || rows.some(row => row.children.length !== 8) || rows.some(row => row.querySelector('.user-provider'))) return;
    const pageText = document.getElementById('users-page').textContent;
    const page = Number(pageText.match(/\d+/)?.[0] || 1);
    const query = new URLSearchParams({ page: String(page), perPage: '25', q: document.getElementById('user-search').value.trim() });
    try {
      const response = await fetch(api + '/api/admin/users?' + query, {
        headers: { Authorization: 'Bearer ' + authToken() },
        cache: 'no-store'
      });
      const result = await response.json();
      if (!response.ok || thisLoad !== loadId || !Array.isArray(result.users)) return;
      pageUsers = [];
      const usersByEmail = new Map(result.users.map(user => [user.email.toLowerCase(), user]));
      for (const row of rows) {
        const cells = row.children;
        const user = usersByEmail.get(cells[1].textContent.toLowerCase());
        if (!user) continue;
        const provider = user.provider === 'password' ? 'Email + password' : 'Google';
        const method = document.createElement('span');
        method.className = 'user-provider';
        method.textContent = provider;
        cells[0].append(method);
        const verified = document.createElement('span');
        verified.className = 'status ' + (user.emailVerified ? 'verified' : 'unverified');
        verified.textContent = user.emailVerified ? 'Verified' : 'Not verified';
        cells[5].append(verified);
        const details = document.createElement('button');
        details.className = 'btn';
        details.type = 'button';
        details.textContent = 'Details';
        details.addEventListener('click', () => showDetails(user));
        cells[7].prepend(details);
        pageUsers.push({ user, element: row });
      }
      const emailCount = pageUsers.filter(row => row.user.provider === 'password').length;
      const googleCount = pageUsers.length - emailCount;
      const count = document.getElementById('users-count');
      count.textContent += ' · this page: ' + emailCount + ' Email / ' + googleCount + ' Google';
      applyControls();
    } catch {
      // The primary table remains usable if the optional metadata request fails.
    }
  }

  new MutationObserver(enrichRows).observe(body, { childList: true });
  methodFilter.addEventListener('change', applyControls);
  sortSelect.addEventListener('change', applyControls);
  document.getElementById('user-details-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
})();