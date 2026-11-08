(() => {
'use strict';
const API = 'https://viora-auth-website.onrender.com';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let token = '';
try { token = JSON.parse(localStorage.getItem('viora_session') || 'null')?.token || ''; } catch {}
let state = { projects: [], tasks: [], activity: [] };
let view = 'dashboard', mode = 'list', currentProject = '', currentList = '', editingTask = '', monthCursor = new Date(), calendarScale = 'month', sortColumn = 'dueDate', sortDirection = 'asc';
let focusRemaining = 25 * 60, focusDuration = 25 * 60, focusInterval = 0, focusStartedAt = 0, focusTaskId = '', reminderInterval = 0;
const selected = new Set();
let toastTimer, loadPromise = null, lastLoadedAt = 0, pendingActions = 0, refreshQueued = false, aiRequestActive = false;
let actionQueue = Promise.resolve();
function localDate(d = new Date()) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,10); }
function dateLabel(value) { if (!value) return 'No date'; const d = new Date(value + 'T12:00:00'); return Number.isNaN(+d) ? 'No date' : d.toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
function dateTime(value) { if (!value) return ''; const d = new Date(value); return Number.isNaN(+d) ? '' : d.toLocaleString(); }
function dateTimeInput(value) { if (!value) return ''; const d = new Date(value); return Number.isNaN(+d) ? '' : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16); }
function dateTimeIso(value) { if (!value) return ''; const d = new Date(value); return Number.isNaN(+d) ? '' : d.toISOString(); }
function updateLiveClock() { const now=new Date(),small=window.matchMedia('(max-width:480px)').matches;$('#planner-live-clock').textContent=(small?now.toLocaleDateString(undefined,{month:'numeric',day:'numeric'})+' ':now.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})+' · ')+now.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',...(small?{}:{second:'2-digit'})}); }
function today() { return localDate(); }
function statusName(value) { return ({todo:'To do',in_progress:'In progress',review:'Review',completed:'Completed'})[value] || 'To do'; }
function priorityName(value) { return ({urgent:'Urgent',high:'High',normal:'Normal',low:'Low'})[value] || 'Normal'; }
function projectById(id) { return state.projects.find(p => p.id === id); }
function taskById(id) { return state.tasks.find(t => t.id === id); }
async function request(path, options = {}) {
  const timeoutMs = options.timeoutMs || (path === '/api/planner/assistant' ? 70000 : path.includes('/attachments') ? 45000 : options.method ? 45000 : 22000);
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), timeoutMs);
  const { timeoutMs: _timeoutMs, ...fetchOptions } = options;
  const signal = options.signal && AbortSignal.any ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  let response, raw;
  try {
    response = await fetch(API + path, { ...fetchOptions, signal, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(options.headers || {}) }, cache: 'no-store' });
    raw = await response.text();
  }
  catch (error) {
    if (controller.signal.aborted) throw Object.assign(new Error('The Planner request took too long. Check your connection and retry.'), { code: 'PLANNER_TIMEOUT' });
    if (error?.name === 'AbortError') throw new Error('The Planner request was cancelled.');
    throw new Error('Could not reach the Planner service. Check your connection and retry.');
  } finally { clearTimeout(timeout); }
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('The Planner service returned an invalid response. Retry the request.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The Planner service returned malformed data. Your saved workspace was left unchanged.');
  if (!response.ok) throw new Error(data.error || ('Planner request failed (' + response.status + ').'));
  return data;
}
function normalizeState(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.projects) || !Array.isArray(value.tasks) || (value.activity != null && !Array.isArray(value.activity))) throw new Error('The Planner service returned malformed workspace data. Your saved data was left untouched.');
  return { version: 1, ...value, activity: value.activity || [] };
}
function setSync(ok, text) { $('#sync-dot').classList.toggle('error', !ok); $('#sync-label').textContent = text; }
function announce(message, error = false) {
  const box = $('#notice'); box.replaceChildren(); box.hidden = !message; box.classList.toggle('error-block', !!error);
  if (!message) return;
  const text = document.createElement('span'); text.className = 'notice-text'; text.textContent = message; box.append(text);
  if (error) { const retry = document.createElement('button'); retry.className = 'notice-retry'; retry.type = 'button'; retry.textContent = 'Retry'; retry.addEventListener('click', () => { retry.disabled = true; retry.textContent = 'Retrying…'; void loadState({ force: true }); }); box.append(retry); }
}
function toast(message) { const box = $('#toast'); box.textContent = message; box.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => box.classList.remove('show'), 2600); }
function showGate() { $('#planner-loading').hidden = true; $('#signin-gate').hidden = false; $('#planner-app').hidden = true; }
function showLoading() { $('#planner-loading').hidden = false; $('#signin-gate').hidden = true; $('#planner-app').hidden = true; }
function showApp() { $('#planner-loading').hidden = true; $('#signin-gate').hidden = true; $('#planner-app').hidden = false; }
function loadState({ force = false, quiet = false } = {}) {
  if (!token) { showGate(); return Promise.resolve(); }
  if (pendingActions) { refreshQueued = true; return actionQueue.then(() => loadState({ force: true, quiet })); }
  if (loadPromise) return loadPromise;
  if (!force && lastLoadedAt && Date.now() - lastLoadedAt < 3000) return Promise.resolve();
  loadPromise = (async () => {
    if (!quiet) setSync(true, 'Syncing privately');
    try {
      state = normalizeState(await request('/api/planner/state'));
      lastLoadedAt = Date.now(); showApp(); setSync(true, 'Synced to your account'); announce('');
      renderAll();
    } catch (error) {
      if (/sign in again/i.test(error.message)) { showGate(); return; }
      showApp(); setSync(false, 'Sync unavailable');
      announce(error.message, true); renderAll();
    }
  })().finally(() => { loadPromise = null; });
  return loadPromise;
}
function runActions(actions, confirmed = false) {
  pendingActions++;
  const operation = actionQueue.catch(() => {}).then(async () => {
    if (loadPromise) await loadPromise;
    try {
      const result = await request('/api/planner/actions', { method: 'POST', body: JSON.stringify({ actions, confirmed }) });
      if (!Array.isArray(result.results)) throw new Error('The Planner service returned an incomplete save response. Refresh before retrying.');
      const updated = normalizeState(result.state);
      state = updated; lastLoadedAt = Date.now();
      setSync(true, 'Synced to your account'); announce(''); renderAll();
      return { ...result, state: updated };
    } catch (error) {
      if (error.code === 'PLANNER_TIMEOUT') {
        try { state = normalizeState(await request('/api/planner/state')); lastLoadedAt = Date.now(); renderAll(); }
        catch { /* Keep the last known good state; retry control remains available. */ }
      }
      throw error;
    }
  });
  actionQueue = operation.catch(() => {}).finally(() => {
    pendingActions = Math.max(0, pendingActions - 1);
    if (!pendingActions && refreshQueued) { refreshQueued = false; void loadState({ force: true, quiet: true }); }
  });
  return operation;
}
function filteredTasks() {
  const query = $('#search')?.value.trim().toLowerCase() || '';
  const status = $('#status-filter')?.value || '', priority = $('#priority-filter')?.value || '';
  return state.tasks.filter(task => {
    if (view === 'today' && task.dueDate !== today() && String(task.scheduledAt || '').slice(0,10) !== today()) return false;
    if (view === 'upcoming' && (!task.dueDate || task.dueDate < today() || task.dueDate > localDate(new Date(Date.now() + 7 * 864e5)))) return false;
    if (view === 'important' && !task.important) return false;
    if (view === 'completed' && task.status !== 'completed') return false;
    if (view === 'archived' && !task.archived) return false;
    if (view !== 'archived' && task.archived) return false;
    if (view === 'calendar' && task.status === 'completed') return false;
    if (view === 'my-tasks' && task.status === 'completed') return false;
    if (currentProject && task.projectId !== currentProject) return false;
    if (currentList && task.listId !== currentList) return false;
    if (status && task.status !== status) return false;
    if (priority && task.priority !== priority) return false;
    if (query) {
      const hay = [task.title,task.description,task.notes,task.assignee,task.category,...(task.tags || [])].join(' ').toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  }).sort((a,b) => {
    const av = sortColumn === 'priority' ? ({urgent:0,high:1,normal:2,low:3}[a.priority] ?? 2) : String(a[sortColumn] ?? (sortColumn === 'dueDate' ? '9999' : '')).toLowerCase();
    const bv = sortColumn === 'priority' ? ({urgent:0,high:1,normal:2,low:3}[b.priority] ?? 2) : String(b[sortColumn] ?? (sortColumn === 'dueDate' ? '9999' : '')).toLowerCase();
    const compared = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDirection === 'asc' ? compared : -compared;
  });
}
function taskProjectName(task) { return projectById(task.projectId)?.name || 'Project'; }
function taskListName(task) { return projectById(task.projectId)?.lists?.find(x => x.id === task.listId)?.name || 'Tasks'; }
function openProject(id) {
  currentProject = id; currentList = ''; view = 'project'; showView(); renderAll();
  if (window.matchMedia('(max-width: 800px)').matches) { $('#sidebar').classList.remove('open'); $('#planner-app').classList.remove('drawer-open'); }
}
function renderSidebar() {
  const root = $('#project-tree'); root.replaceChildren();
  const groups = new Map();
  for (const project of state.projects) { const folder = project.folder || 'Projects'; if (!groups.has(folder)) groups.set(folder, []); groups.get(folder).push(project); }
  for (const [folder, projects] of groups) {
    const label = document.createElement('div'); label.className = 'folder-label'; label.textContent = folder; root.append(label);
    for (const project of projects) {
      const row = document.createElement('div'); row.className = 'project-tree-row';
      const button = document.createElement('button'); button.className = 'project-link' + (currentProject === project.id && !currentList ? ' active' : ''); button.style.setProperty('--project-color', project.color || '#9277ff'); button.dataset.project = project.id;
      button.innerHTML = '<span class="project-dot"></span><span class="project-name">' + esc(project.name) + '</span><span class="project-count">' + state.tasks.filter(t => t.projectId === project.id && t.status !== 'completed').length + '</span>';
      row.append(button);
      const addList = document.createElement('button'); addList.className = 'project-more'; addList.textContent = '＋'; addList.title = 'Add task list'; addList.setAttribute('aria-label','Add task list to ' + project.name); addList.dataset.addList = project.id; row.append(addList);
      root.append(row);
      for (const list of project.lists || []) {
        const listButton = document.createElement('button'); listButton.className = 'list-link' + (currentProject === project.id && currentList === list.id ? ' active' : '');
        listButton.innerHTML = '<span class="list-name">' + esc(list.name) + '</span><span class="project-count">' + state.tasks.filter(t => t.listId === list.id).length + '</span>';
        listButton.dataset.project = project.id; listButton.dataset.list = list.id; root.append(listButton);
      }
    }
  }
  if (!state.projects.length) root.innerHTML = '<div class="empty-side">Your projects will appear here.<br><button class="text-button" id="empty-add-project">Create your first project</button></div>';
}
function showView() {
  $('#dashboard-view').hidden = view !== 'dashboard';
  const smartView = ['my-tasks','today','upcoming','calendar','important','completed','archived'].includes(view);
  $('#project-view').hidden = view !== 'project' && !smartView;
  $('#activity-view').hidden = view !== 'activity';
  $('#focus-view').hidden = view !== 'focus';
  const project = projectById(currentProject);
  const titles = { dashboard:'Overview', activity:'Activity', 'my-tasks':'My tasks', today:'Today', upcoming:'Upcoming', calendar:'Calendar', important:'Important', completed:'Completed', archived:'Archived', focus:'Focus' };
  const title = titles[view] || project?.name || 'Project';
  $('#current-crumb').textContent = title + (currentList ? ' / ' + (project?.lists.find(x => x.id === currentList)?.name || '') : '');
  if (view === 'dashboard') { $('#page-title').textContent = 'Good work starts with a plan.'; $('#page-subtitle').textContent = 'A clear view of what’s moving, what’s next, and where Viora can help.'; $('#head-eyebrow').textContent = 'YOUR PRODUCTIVITY, IN FOCUS'; }
  else if (view === 'activity') { $('#page-title').textContent = 'Workspace activity'; $('#page-subtitle').textContent = 'A private history of changes across your projects.'; $('#head-eyebrow').textContent = 'RECENT CHANGES'; }
  else if (smartView) { $('#page-title').textContent = title; $('#page-subtitle').textContent = ({today:'A clear list of tasks scheduled for today.',upcoming:'Tasks due over the next seven days.',calendar:'Move through your schedule and drag a task onto a day to reschedule it.',important:'The work you marked important.',completed:'Finished work across your projects.',archived:'Tasks you have put away.', 'my-tasks':'Every active task across your projects.'})[view]; $('#head-eyebrow').textContent = view === 'today' ? 'DAILY PLAN' : 'SMART LIST'; }
  else if (view === 'focus') { $('#page-title').textContent = 'Make space for focused work.'; $('#page-subtitle').textContent = 'Choose a task, set a session, and keep your attention on one thing.'; $('#head-eyebrow').textContent = 'FOCUS MODE'; }
  else { $('#page-title').textContent = title; $('#page-subtitle').textContent = project?.description || 'Plan the work, see the progress, and keep every next step in view.'; $('#head-eyebrow').textContent = currentList ? 'TASK LIST' : (project?.folder || 'PROJECT'); }
  $('#add-list').hidden = view !== 'project';
  $('#calendar-scale-wrap').hidden = view !== 'calendar' && mode !== 'calendar';
  if (view === 'calendar') mode = 'calendar';
  if (view === 'focus') renderFocus();
  $$('.side-link').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  renderSidebar();
}
function renderTaskMini(task) {
  return '<div class="task-row"><span class="task-indicator ' + esc(task.priority) + '"></span><div class="task-copy"><strong><button class="task-open-link" data-open-task="' + esc(task.id) + '">' + esc(task.title) + '</button></strong><small>' + esc(taskProjectName(task)) + ' · ' + esc(statusName(task.status)) + '</small></div><span class="task-date">' + esc(dateLabel(task.dueDate)) + '</span></div>';
}
function renderDashboard() {
  const tasks = state.tasks.filter(t => !t.archived), day = today(), active = tasks.filter(t => t.status !== 'completed');
  $('#stat-today').textContent = active.filter(t => t.dueDate === day).length;
  $('#stat-overdue').textContent = active.filter(t => t.dueDate && t.dueDate < day).length;
  $('#stat-progress').textContent = tasks.filter(t => t.status === 'in_progress').length;
  $('#stat-complete').textContent = tasks.filter(t => t.status === 'completed').length;
  const upcoming = active.filter(t => t.dueDate).sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0,8);
  $('#upcoming-list').innerHTML = upcoming.length ? upcoming.map(renderTaskMini).join('') : '<div class="empty-state">No dated tasks yet. Add a due date to make the week easier to see.</div>';
  const pulse = state.projects.map(p => {
    const projectTasks = tasks.filter(t => t.projectId === p.id), completed = projectTasks.filter(t => t.status === 'completed').length, pct = projectTasks.length ? Math.round(completed * 100 / projectTasks.length) : 0;
    return '<div class="pulse-project"><div class="pulse-head"><strong>' + esc(p.name) + '</strong><span>' + pct + '% · ' + completed + '/' + projectTasks.length + '</span></div><div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div></div>';
  }).join('');
  $('#project-pulse').innerHTML = pulse || '<div class="empty-state">Create a project to track its progress.</div>';
  const week = [];
  for (let offset = 6; offset >= 0; offset--) { const date = new Date(); date.setDate(date.getDate() - offset); const key = localDate(date); week.push({ key, label: date.toLocaleDateString(undefined,{weekday:'short'}), count: tasks.filter(task => task.completedAt && task.completedAt.slice(0,10) === key).length }); }
  const weekMax = Math.max(1, ...week.map(item => item.count)), weekSum = week.reduce((sum,item)=>sum+item.count,0);
  $('#week-total').textContent = weekSum + ' completed';
  $('#week-chart').innerHTML = week.map(item => '<div class="week-day" title="' + esc(item.count + ' completed') + '"><span class="week-count">' + item.count + '</span><div class="week-bar-wrap"><i style="height:' + (item.count ? Math.max(10,Math.round(item.count * 100 / weekMax)) : 3) + '%"></i></div><small>' + esc(item.label) + '</small></div>').join('') || '<div class="empty-state">No recent completions.</div>';
  const recent = [...tasks].sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,7);
  $('#recent-list').innerHTML = recent.length ? recent.map(renderTaskMini).join('') : '<div class="empty-state">Your recently updated tasks will appear here.</div>';
}
function markdownHtml(value) {
  const lines = String(value || '').split('\n'), out = []; let list = false;
  for (const raw of lines) {
    const line = esc(raw);
    if (/^\s*[-*]\s+/.test(raw)) {
      if (!list) { out.push('<ul>'); list = true; }
      out.push('<li>' + line.replace(/^\s*[-*]\s+/, '') + '</li>'); continue;
    }
    if (list) { out.push('</ul>'); list = false; }
    if (!raw.trim()) { out.push('<p><br></p>'); continue; }
    let formatted = line.replace(/\x60([^\x60]+)\x60/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
    if (/^#\s/.test(raw)) formatted = '<strong>' + formatted.replace(/^#\s+/, '') + '</strong>';
    out.push('<p>' + formatted + '</p>');
  }
  if (list) out.push('</ul>');
  return out.join('');
}
function updateDescriptionPreview() {
  const value = $('#task-form').elements.description.value;
  const preview = $('#description-preview');
  preview.innerHTML = markdownHtml(value);
  preview.hidden = !value.trim();
}
function statusCell(status) { return '<span class="status-pill ' + esc(status) + '">' + esc(statusName(status)) + '</span>'; }
function priorityCell(priority) { return '<span class="priority-pill ' + esc(priority) + '">' + esc(priorityName(priority)) + '</span>'; }
function renderList() {
  const tasks = filteredTasks();
  if (!tasks.length) { $('#list-view').innerHTML = '<div class="empty-state">No tasks match this view. Create one or adjust the filters.</div>'; return; }
  let rows = '';
  for (const task of tasks) {
    const tags = (task.tags || []).slice(0,3).map(tag => '<span class="tag">' + esc(tag) + '</span>').join(' ');
    rows += '<tr draggable="true" data-drag-task="' + esc(task.id) + '"><td class="row-select"><input class="table-check select-task" type="checkbox" aria-label="Select ' + esc(task.title) + '" data-select-task="' + esc(task.id) + '"' + (selected.has(task.id) ? ' checked' : '') + '></td><td class="task-title-cell ' + (task.parentId ? 'task-subtask' : '') + '">' + (task.parentId ? '<span class="task-subtask-marker">↳ </span>' : '') + '<span class="inline-title" contenteditable="true" spellcheck="false" role="textbox" aria-label="Edit task title" data-inline-title="' + esc(task.id) + '">' + esc(task.title) + '</span><button class="task-open-link task-detail-link" data-open-task="' + esc(task.id) + '" aria-label="Open task details">↗</button>' + (task.important ? '<span class="important-mark" title="Important">✦</span>' : '') + '</td><td>' + esc(taskProjectName(task)) + ' / ' + esc(taskListName(task)) + '</td><td>' + statusCell(task.status) + '</td><td>' + priorityCell(task.priority) + '</td><td>' + esc(task.category || task.assignee || '—') + '</td><td>' + esc(dateLabel(task.dueDate)) + '</td><td>' + tags + '</td></tr>';
  }
  $('#list-view').innerHTML = '<table class="list-table"><thead><tr><th></th><th><button class="sort-button" data-sort="title">Task</button></th><th>Project / list</th><th>Status</th><th><button class="sort-button" data-sort="priority">Priority</button></th><th>Category / assignee</th><th><button class="sort-button" data-sort="dueDate">Due</button></th><th>Tags</th></tr></thead><tbody>' + rows + '</tbody></table>';
}
const statuses = ['todo','in_progress','review','completed'];
function renderBoard() {
  const tasks = filteredTasks();
  $('#board-view').innerHTML = '<div class="board">' + statuses.map(status => {
    const items = tasks.filter(t => t.status === status);
    return '<section class="board-column" data-drop-status="' + status + '"><header class="column-head"><h3>' + esc(statusName(status)) + '</h3><span>' + items.length + '</span></header>' + items.map(task => '<article class="board-card" draggable="true" data-drag-task="' + esc(task.id) + '"><div class="board-card-select"><input class="table-check select-task" type="checkbox" aria-label="Select task for Viora" data-select-task="' + esc(task.id) + '"' + (selected.has(task.id) ? ' checked' : '') + '></div><button class="task-open-link" data-open-task="' + esc(task.id) + '"><strong>' + esc(task.title) + '</strong></button><div class="card-meta">' + priorityCell(task.priority) + (task.dueDate ? '<span class="tag">' + esc(dateLabel(task.dueDate)) + '</span>' : '') + '</div></article>').join('') + '</section>';
  }).join('') + '</div>';
}
function renderCalendar() {
  const month = monthCursor.getMonth(), base = new Date(monthCursor.getFullYear(), month, monthCursor.getDate());
  const start = new Date(base);
  if (calendarScale === 'month') start.setDate(1 - start.getDay());
  if (calendarScale === 'week') start.setDate(start.getDate() - start.getDay());
  const count = calendarScale === 'month' ? 42 : calendarScale === 'week' ? 7 : 1;
  const title = calendarScale === 'month' ? monthCursor.toLocaleDateString(undefined,{month:'long',year:'numeric'}) : calendarScale === 'week' ? `${start.toLocaleDateString(undefined,{month:'short',day:'numeric'})} – ${new Date(start.getTime()+6*864e5).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}` : monthCursor.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const step = calendarScale === 'month' ? -1 : calendarScale === 'week' ? -7 : -1;
  let days = '<div class="calendar-head"><button class="button ghost" data-month="' + step + '" aria-label="Previous ' + calendarScale + '">←</button><h2>' + esc(title) + '</h2><button class="button ghost" data-month="' + -step + '" aria-label="Next ' + calendarScale + '">→</button><button class="button ghost" data-month="today">Today</button></div><div class="calendar scale-' + esc(calendarScale) + '">';
  if (calendarScale !== 'day') for (const name of ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']) days += '<div class="cal-dow">' + name + '</div>';
  const tasks = filteredTasks();
  for (let i=0;i<count;i++) {
    const date = new Date(start); date.setDate(start.getDate()+i); const key = localDate(date);
    const items = tasks.filter(task => (task.dueDate || String(task.scheduledAt || '').slice(0,10)) === key).sort((a,b)=>String(a.scheduledAt||'').localeCompare(String(b.scheduledAt||'')));
    const dateText = calendarScale === 'day' ? date.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}) : date.getDate();
    days += '<div class="cal-day' + (calendarScale === 'month' && date.getMonth() !== month ? ' muted' : '') + (key === today() ? ' today' : '') + '" data-schedule-date="' + key + '"><span class="cal-date">' + esc(dateText) + '</span>' + items.map(task => '<button draggable="true" class="cal-task ' + esc(task.priority) + '" data-drag-task="' + esc(task.id) + '" data-open-task="' + esc(task.id) + '" title="' + esc(task.title) + '">' + (task.scheduledAt ? '<small>' + esc(new Date(task.scheduledAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})) + '</small> ' : '') + esc(task.title) + '</button>').join('') + (items.length ? '' : '<span class="calendar-empty">Drop a task here to schedule it</span>') + '</div>';
  }
  $('#calendar-view').innerHTML = days + '</div>';
}
function renderTimeline() {
  const tasks = filteredTasks(), start = new Date(today() + 'T00:00:00'), days = [];
  for (let i=0;i<14;i++) { const d=new Date(start); d.setDate(start.getDate()+i); days.push(localDate(d)); }
  let html = '<div class="timeline"><div class="timeline-head"><div class="timeline-title">Task / next 14 days</div>' + days.map(d => '<div>' + esc(new Date(d+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',day:'numeric'})) + '</div>').join('') + '</div>';
  for (const task of tasks) {
    const from = task.startDate || task.dueDate || today(), to = task.dueDate || from;
    let a = Math.max(0, Math.min(13, Math.round((new Date(from+'T00:00:00')-start)/86400000)));
    let b = Math.max(a, Math.min(13, Math.round((new Date(to+'T00:00:00')-start)/86400000)));
    if (new Date(to+'T00:00:00') < start || new Date(from+'T00:00:00') > new Date(days[13]+'T23:00:00')) continue;
    html += '<div class="timeline-row"><button class="timeline-name task-open-link" data-open-task="' + esc(task.id) + '">' + esc(task.title) + '</button><div class="timeline-lane"><button class="timeline-bar ' + esc(task.status) + '" style="grid-column:' + (a+1) + '/' + (b+2) + '" data-open-task="' + esc(task.id) + '" title="' + esc(task.title + ' · ' + statusName(task.status)) + '"></button></div></div>';
  }
  $('#timeline-view').innerHTML = html + '</div>';
}
function renderActivity() {
  const items = state.activity || [];
  $('#activity-list').innerHTML = items.length ? items.slice(0,300).map(item => '<div class="activity-item"><span class="activity-bullet"></span><div><p><strong>' + esc(item.action.replaceAll('_',' ')) + '</strong> · ' + esc(item.target) + '</p><small>' + esc(item.detail || '') + '</small></div><time>' + esc(dateTime(item.at)) + '</time></div>').join('') : '<div class="empty-state">Planner changes will appear here.</div>';
}
function renderModes() {
  const modes = ['list-view','board-view','calendar-view','timeline-view'];
  const names = ['list','board','calendar','timeline'];
  names.forEach((name,index) => { $('#' + modes[index]).hidden = mode !== name; });
  $$('.view-tab').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
  $('#calendar-scale-wrap').hidden = mode !== 'calendar' && view !== 'calendar';
  $('#calendar-scale').value = calendarScale;
  if (mode === 'list') renderList(); if (mode === 'board') renderBoard(); if (mode === 'calendar') renderCalendar(); if (mode === 'timeline') renderTimeline();
}
function renderSelection() {
  for (const id of selected) if (!taskById(id)) selected.delete(id);
  const count = selected.size; $('#selected-count').textContent = count ? count + ' task' + (count === 1 ? '' : 's') + ' selected for context' : 'Your workspace is ready';
}
function renderFocus() {
  const picker = $('#focus-task'), available = state.tasks.filter(task => task.status !== 'completed' && !task.archived);
  const previous = picker.value;
  picker.replaceChildren(...available.map(task => new Option(task.title, task.id)));
  if (available.some(task => task.id === previous)) picker.value = previous;
  const task = taskById(picker.value) || available[0];
  if (task) picker.value = task.id;
  $('#focus-task-card').innerHTML = task ? '<span class="priority-pill ' + esc(task.priority) + '">' + esc(priorityName(task.priority)) + '</span><h3>' + esc(task.title) + '</h3><p>' + esc(task.description || 'No task description yet.') + '</p><div class="focus-progress"><span>Progress</span><strong>' + Math.min(100,Number(task.progress)||0) + '%</strong><div class="progress-track"><div class="progress-fill" style="width:' + Math.min(100,Number(task.progress)||0) + '%"></div></div></div><button class="text-button" data-open-task="' + esc(task.id) + '">Open task details →</button>' : '<div class="empty-state">No active tasks to focus on. Add a task or restore one from Archived.</div>';
  $('#focus-start').disabled = !task;
}
function drawFocusClock() {
  const minutes = Math.floor(focusRemaining / 60), seconds = focusRemaining % 60;
  $('#focus-clock').textContent = String(minutes).padStart(2,'0') + ':' + String(seconds).padStart(2,'0');
}
async function finishFocus(saveTime = true) {
  if (!focusInterval) return;
  clearInterval(focusInterval); focusInterval = 0;
  const elapsed = Math.max(0,Math.floor((Date.now() - focusStartedAt) / 1000));
  const task = taskById(focusTaskId);
  $('#focus-start').textContent = 'Start focus'; focusStartedAt = 0;
  focusTaskId = ''; $('#focus-length').disabled = false;
  if (saveTime && task && elapsed >= 60) {
    const minutes = Math.max(1,Math.round(elapsed / 60));
    try { await runActions([{type:'update_task',taskId:task.id,actualMinutes:(Number(task.actualMinutes)||0)+minutes,status:task.status==='todo'?'in_progress':task.status}]); $('#focus-note').textContent = minutes + ' minute' + (minutes===1?'':'s') + ' added to actual time.'; }
    catch(error) { $('#focus-note').textContent = 'Time could not be saved: ' + error.message; }
  } else if (saveTime) $('#focus-note').textContent = 'Session ended before one minute, so no time was added.';
  renderFocus();
}
async function enableBrowserReminders() {
  if (!('Notification' in window)) { toast('This browser does not support notifications.'); return; }
  let permission; try { permission = await Notification.requestPermission(); } catch { $('#reminder-permission').textContent = 'Notifications could not be enabled. Check browser permissions.'; return; }
  $('#reminder-permission').textContent = permission === 'granted' ? 'Browser reminders enabled on this device.' : 'Notifications are blocked by your browser settings.';
  if (permission === 'granted') pollReminders();
}
function pollReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = Date.now();
  for (const task of state.tasks) {
    const at = Date.parse(task.reminderAt || '');
    if (!Number.isFinite(at) || at > now || task.status === 'completed' || task.archived) continue;
    const key = 'viora_planner_reminder_' + task.id + '_' + task.reminderAt;
    try { if (localStorage.getItem(key)) continue; localStorage.setItem(key, 'shown'); } catch { continue; }
    try { new Notification('Viora Planner reminder', { body: task.title, tag: key }); } catch {}
  }
}
function renderAll() { renderSidebar(); showView(); renderDashboard(); renderModes(); renderActivity(); renderSelection(); }
async function createProject(name, folder, description) {
  const result = await runActions([{type:'create_project',name,folder,description}]);
  const id = result.results[0].projectId; openProject(id); toast('Project created');
}
function openNewTask() {
  if (!state.projects.length) { $('#project-dialog').showModal(); toast('Create a project first'); return; }
  openTask('');
}
function populateTaskForm(task) {
  const form = $('#task-form'), projects = form.elements.projectId, lists = form.elements.listId, parents = form.elements.parentId;
  projects.replaceChildren(...state.projects.map(project => { const option=document.createElement('option'); option.value=project.id; option.textContent=project.name; return option; }));
  let project = task ? projectById(task.projectId) : projectById(currentProject) || state.projects[0];
  if (!project) return;
  projects.value = project.id;
  lists.replaceChildren(...(project.lists || []).map(list => { const option=document.createElement('option'); option.value=list.id; option.textContent=list.name; return option; }));
  lists.value = task?.listId || currentList || project.lists[0]?.id || '';
  const candidates = state.tasks.filter(item => item.projectId === project.id && item.id !== task?.id && !item.parentId);
  parents.replaceChildren(new Option('No parent (top-level)',''), ...candidates.map(item => new Option(item.title,item.id)));
  parents.value = task?.parentId || '';
  form.elements.title.value = task?.title || '';
  form.elements.status.value = task?.status || 'todo';
  form.elements.priority.value = task?.priority || 'normal';
  form.elements.startDate.value = task?.startDate || '';
  form.elements.dueDate.value = task?.dueDate || '';
  form.elements.scheduledAt.value = dateTimeInput(task?.scheduledAt);
  form.elements.reminderAt.value = dateTimeInput(task?.reminderAt);
  form.elements.category.value = task?.category || '';
  form.elements.estimatedMinutes.value = task?.estimatedMinutes || '';
  form.elements.actualMinutes.value = task?.actualMinutes || '';
  form.elements.progress.value = task?.progress ?? (task?.status === 'completed' ? 100 : 0);
  form.elements.recurrenceFrequency.value = task?.recurrence?.frequency || 'none';
  form.elements.recurrenceInterval.value = task?.recurrence?.interval || 1;
  form.elements.important.checked = !!task?.important;
  form.elements.archived.checked = !!task?.archived;
  form.elements.assignee.value = task?.assignee || '';
  form.elements.tags.value = (task?.tags || []).join(', ');
  form.elements.description.value = task?.description || '';
  form.elements.notes.value = task?.notes || '';
}
function renderTaskExtras(task) {
  const extras = $('#task-extras'); extras.hidden = !task;
  if (!task) return;
  $('#checklist-list').innerHTML = (task.checklist || []).map(item => '<label class="check-row' + (item.done ? ' done' : '') + '"><input type="checkbox" data-toggle-check="' + esc(item.id) + '"' + (item.done ? ' checked' : '') + '><span>' + esc(item.text) + '</span></label>').join('') || '<span class="muted">No checklist items yet.</span>';
  $('#comment-list').innerHTML = (task.comments || []).map(comment => '<div class="comment-item"><strong>' + esc(comment.author) + '</strong><small>' + esc(dateTime(comment.at)) + '</small><p>' + esc(comment.text) + '</p></div>').join('') || '<span class="muted">No comments yet.</span>';
  $('#attachment-list').innerHTML = (task.attachments || []).map(file => '<div class="attachment-row"><span>▧</span><strong>' + esc(file.name) + '</strong><small>' + (Number(file.size) ? (file.size < 1048576 ? Math.ceil(file.size/1024)+' KB' : (file.size/1048576).toFixed(1)+' MB') : '') + '</small><button type="button" data-download-attachment="' + esc(file.id) + '" aria-label="Download ' + esc(file.name) + '">↓</button><button type="button" data-remove-attachment="' + esc(file.id) + '" aria-label="Remove ' + esc(file.name) + '">×</button></div>').join('') || '<span class="muted">No attachments yet.</span>';
  $('#select-for-ai').checked = selected.has(task.id);
}
async function uploadAttachment() {
  const task = taskById(editingTask), input = $('#attachment-file'), file = input.files?.[0];
  if (!task) { toast('Save the task before adding attachments.'); return; }
  if (!file) { toast('Choose a file to upload.'); return; }
  if (file.size > 3*1024*1024) { $('#attachment-status').textContent = 'File is larger than the 3 MB limit.'; return; }
  const types = {'pdf':'application/pdf','png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg','gif':'image/gif','webp':'image/webp','txt':'text/plain','md':'text/markdown'};
  const ext = file.name.split('.').pop().toLowerCase(), contentType = file.type || types[ext] || '';
  const status = $('#attachment-status'), button = $('#upload-attachment'); button.disabled = true;
  try {
    status.textContent = 'Preparing ' + file.name + '…';
    const bytes = new Uint8Array(await file.arrayBuffer()); let binary = '';
    for (let at=0;at<bytes.length;at+=0x8000) binary += String.fromCharCode(...bytes.subarray(at,at+0x8000));
    status.textContent = 'Uploading to your private Viora storage…';
    const data = await request('/api/planner/attachments',{method:'POST',body:JSON.stringify({taskId:task.id,name:file.name,contentType,data:btoa(binary)})});
    state=normalizeState(data.state);lastLoadedAt=Date.now();setSync(true,'Synced to your account');renderAll();renderTaskExtras(taskById(task.id));status.textContent='Uploaded '+file.name;input.value='';
  } catch(error) { status.textContent='Upload failed: '+error.message; }
  finally { button.disabled = false; }
}
async function downloadAttachment(id) {
  const task=taskById(editingTask),file=task?.attachments?.find(item=>item.id===id);if(!task||!file)return;
  $('#attachment-status').textContent='Downloading '+file.name+'…';
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),45000);
  try {
    const response=await fetch(API+'/api/planner/attachments/'+encodeURIComponent(id)+'?taskId='+encodeURIComponent(task.id),{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal});
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Download failed ('+response.status+').')}
    const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);$('#attachment-status').textContent='Downloaded '+file.name;
  } catch(error) { $('#attachment-status').textContent=controller.signal.aborted?'Download timed out. Check your connection and retry.':'Download failed: '+error.message; }
  finally { clearTimeout(timeout); }
}
async function removeAttachment(id) {
  const task=taskById(editingTask),file=task?.attachments?.find(item=>item.id===id);if(!task||!file)return;
  if(!window.confirm('Remove attachment “'+file.name+'”?'))return;
  try { const data=await request('/api/planner/attachments/remove',{method:'POST',body:JSON.stringify({taskId:task.id,attachmentId:id})});state=normalizeState(data.state);lastLoadedAt=Date.now();renderAll();renderTaskExtras(taskById(task.id));$('#attachment-status').textContent='Removed '+file.name; }
  catch(error){$('#attachment-status').textContent='Could not remove attachment: '+error.message}
}
function openTask(id) {
  const task = id ? taskById(id) : null; editingTask = task?.id || '';
  $('#task-dialog-title').textContent = task ? 'Edit task' : 'New task';
  $('#task-kicker').textContent = task ? taskProjectName(task).toUpperCase() : 'TASK DETAILS';
  populateTaskForm(task); renderTaskExtras(task); updateDescriptionPreview(); $('#task-save-note').textContent = '';
  $('#task-dialog').showModal();
}
function updateStateFromResult(data) { if (data.state) { state = data.state; renderAll(); } }
async function saveTask(event) {
  /* Cancel and × are submit buttons of this dialog form: let the dialog close natively and save nothing. */
  if (event.submitter && event.submitter.value === 'cancel') return;
  event.preventDefault(); const form = $('#task-form'), data = new FormData(form);
  const frequency = String(data.get('recurrenceFrequency') || 'none');
  const fields = {title:String(data.get('title')||'').trim(),description:String(data.get('description')||''),notes:String(data.get('notes')||''),status:String(data.get('status')),priority:String(data.get('priority')),startDate:String(data.get('startDate')||''),dueDate:String(data.get('dueDate')||''),scheduledAt:dateTimeIso(String(data.get('scheduledAt')||'')),reminderAt:dateTimeIso(String(data.get('reminderAt')||'')),category:String(data.get('category')||'').trim(),estimatedMinutes:Number(data.get('estimatedMinutes')||0),actualMinutes:Number(data.get('actualMinutes')||0),progress:Number(data.get('progress')||0),important:form.elements.important.checked,archived:form.elements.archived.checked,recurrence:frequency==='none'?null:{frequency,interval:Number(data.get('recurrenceInterval')||1)},assignee:String(data.get('assignee')||'').trim(),tags:String(data.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean)};
  const projectId = String(data.get('projectId')||''), listId = String(data.get('listId')||''), parentId = String(data.get('parentId')||'');
  $('#save-task').disabled = true; $('#task-save-note').textContent = 'Saving securely…';
  try {
    if (editingTask) {
      const old = taskById(editingTask), actions = [];
      const moving = old && (old.projectId !== projectId || old.listId !== listId);
      if (moving && old.parentId) actions.push({type:'update_task',taskId:editingTask,parentId:''});
      if (moving) actions.push({type:'move_task',taskId:editingTask,projectId,listId});
      actions.push({type:'update_task',taskId:editingTask,...fields,parentId});
      await runActions(actions);
    } else {
      await runActions([{type:'create_task',projectId,listId,parentId,...fields}]);
    }
    $('#task-dialog').close(); toast(editingTask ? 'Task updated' : 'Task created'); editingTask = '';
  } catch (error) { $('#task-save-note').textContent = error.message; setSync(false,'Save failed'); }
  finally { $('#save-task').disabled = false; }
}
async function addTaskDetailAction(action, taskId) {
  try { const result = await runActions([action]); if (taskId && taskById(taskId)) renderTaskExtras(taskById(taskId)); }
  catch (error) { toast(error.message); }
}
function pushAiMessage(text, role) {
  const row = document.createElement('div'); row.className = 'ai-message ' + role;
  if (role === 'assistant') { const icon = document.createElement('span'); icon.className='ai-avatar'; icon.textContent='✦'; const p=document.createElement('p'); p.textContent=text; row.append(icon,p); }
  else row.textContent=text;
  $('#ai-messages').append(row); $('#ai-messages').scrollTop=$('#ai-messages').scrollHeight; return row;
}
async function sendAi(event, promptOverride) {
  if (event) event.preventDefault();
  if (aiRequestActive) return;
  const input=$('#ai-input'), command=String(promptOverride||input.value||'').trim();
  if(!command)return;
  aiRequestActive=true;
  input.value=''; pushAiMessage(command,'user');
  const waiting=pushAiMessage('Checking your workspace and preparing the right actions…','assistant'); waiting.classList.add('pending'); $('#ai-send').disabled=true;
  try {
    let data=await request('/api/planner/assistant',{method:'POST',body:JSON.stringify({command,selectedTaskIds:[...selected],timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone})});
    waiting.remove();
    if(data.confirmationRequired) {
      const summary=data.actions.map(action=>action.type==='delete_task'?'Delete “'+(taskById(action.taskId)?.title||'task')+'”':'Complete '+action.type.replaceAll('_',' ')).join('\n');
      if(!window.confirm('Viora is asking to delete or change this data:\n\n'+summary+'\n\nContinue?')) { pushAiMessage('Cancelled. No changes were made.','assistant'); return; }
      data=await request('/api/planner/assistant/confirm',{method:'POST',body:JSON.stringify({confirmationId:data.confirmationId})});
    }
    if(data.state) { state=normalizeState(data.state); lastLoadedAt=Date.now(); renderAll(); }
    pushAiMessage(data.message || 'The request finished.','assistant');
  } catch(error) {
    waiting.remove(); input.value=command;
    pushAiMessage('I could not complete that Planner request: '+error.message+' Your request is back in the input so you can retry.','assistant');
    if(error.code==='PLANNER_TIMEOUT')void loadState({force:true,quiet:true});
  }
  finally { aiRequestActive=false; $('#ai-send').disabled=false; }
}
function openAi() { $('#ai-panel').classList.add('open'); }
function closeAi() { $('#ai-panel').classList.remove('open'); }
function bindEvents() {
  $('#refresh').addEventListener('click',()=>void loadState({force:true}));
  window.addEventListener('focus',()=>{if(!$('dialog[open]').length)void loadState()});
  window.addEventListener('storage',event=>{if(event.key==='viora_planner_changed')void loadState({force:true,quiet:true})});
  if ('BroadcastChannel' in window) { const channel=new BroadcastChannel('viora-planner'); channel.addEventListener('message',event=>{if(event.data?.type==='changed')void loadState({force:true,quiet:true})}); }
  setInterval(()=>{if(document.visibilityState==='visible'&&!$('dialog[open]').length&&Date.now()-lastLoadedAt>=60000)void loadState({force:true,quiet:true})},60000);
  if ('Notification' in window && Notification.permission === 'granted') { $('#reminder-permission').textContent = 'Browser reminders enabled on this device.'; pollReminders(); }
  reminderInterval = setInterval(pollReminders,15000);
  updateLiveClock(); setInterval(updateLiveClock,1000);
  $('#new-task').addEventListener('click',openNewTask);
  $('#add-project').addEventListener('click',()=>$('#project-dialog').showModal());
  let projectSubmitting=false;
  $('#project-form').addEventListener('submit',async event=>{if(event.submitter&&event.submitter.value==='cancel')return;event.preventDefault();if(projectSubmitting)return;const form=event.currentTarget,data=new FormData(form),submit=event.submitter,name=String(data.get('name')||'').trim();if(!name)return;projectSubmitting=true;if(submit)submit.disabled=true;try{await createProject(name,String(data.get('folder')||'').trim(),String(data.get('description')||''));form.reset();$('#project-dialog').close()}catch(error){toast(error.message)}finally{projectSubmitting=false;if(submit)submit.disabled=false}});
  $('#task-form').addEventListener('submit',saveTask);
  $('#enable-reminders').addEventListener('click',enableBrowserReminders);
  $('#focus-task').addEventListener('change',()=>{if(focusInterval)void finishFocus(true);renderFocus()});
  $('#focus-length').addEventListener('change',()=>{if(!focusInterval){focusRemaining=Number($('#focus-length').value)*60;drawFocusClock()}});
  $('#focus-start').addEventListener('click',()=>{
    if(focusInterval){void finishFocus(true);return}
    focusDuration=Number($('#focus-length').value)*60;focusRemaining=focusDuration;focusTaskId=$('#focus-task').value;focusStartedAt=Date.now();$('#focus-length').disabled=true;$('#focus-start').textContent='Finish session';$('#focus-note').textContent='Focus session in progress. Keep this page open.';drawFocusClock();
    focusInterval=setInterval(()=>{focusRemaining=Math.max(0,Math.ceil((focusStartedAt+focusDuration*1000-Date.now())/1000));drawFocusClock();if(focusRemaining<=0)void finishFocus(true)},500);
  });
  $('#focus-reset').addEventListener('click',()=>{if(focusInterval){clearInterval(focusInterval);focusInterval=0}focusStartedAt=0;focusTaskId='';$('#focus-length').disabled=false;focusRemaining=Number($('#focus-length').value)*60;$('#focus-start').textContent='Start focus';$('#focus-note').textContent='Timer reset. No time was added for the stopped session.';drawFocusClock()});
  $('#calendar-scale').addEventListener('change',event=>{calendarScale=event.target.value;renderCalendar()});
  $('#task-form').elements.description.addEventListener('input',updateDescriptionPreview);
  $$('.markdown-tools button').forEach(button=>button.addEventListener('click',()=>{const field=$('#task-form').elements.description,kind=button.dataset.markdown,start=field.selectionStart,end=field.selectionEnd,value=field.value,wrap=kind==='bold'?['**','**']:kind==='italic'?['*','*']:kind==='heading'?['## ','']:['- ',''];if(kind==='heading'||kind==='list'){const lineStart=value.lastIndexOf('\n',Math.max(0,start-1))+1;field.setRangeText(wrap[0],lineStart,lineStart,'end')}else{const selection=value.slice(start,end)||'text';field.setRangeText(wrap[0]+selection+wrap[1],start,end,'select')}field.focus();updateDescriptionPreview()}));
  $('#task-form').elements.projectId.addEventListener('change',()=>{const task=taskById(editingTask);const id=$('#task-form').elements.projectId.value;const project=projectById(id);$('#task-form').elements.listId.replaceChildren(...(project?.lists||[]).map(list=>new Option(list.name,list.id)));$('#task-form').elements.parentId.replaceChildren(new Option('No parent (top-level)',''),...state.tasks.filter(t=>t.projectId===id&&!t.parentId&&t.id!==editingTask).map(t=>new Option(t.title,t.id)))});
  $('#add-list').addEventListener('click',()=>addList(currentProject));
  $('#project-tree').addEventListener('click',async event=>{if(event.target.closest('#empty-add-project')){ $('#project-dialog').showModal(); return; }const add=event.target.closest('[data-add-list]');if(add){await addList(add.dataset.addList);return}const target=event.target.closest('[data-project]');if(!target)return;if(target.dataset.list){currentProject=target.dataset.project;currentList=target.dataset.list;view='project';mode='list';showView();renderAll()}else openProject(target.dataset.project)});
  $('#empty-add-project')?.addEventListener('click',()=>$('#project-dialog').showModal());
  document.addEventListener('click',event=>{const button=event.target.closest('[data-view]');if(button){view=button.dataset.view;currentProject='';currentList='';if(view==='calendar')mode='calendar';else if(['today','upcoming','completed','important','archived','my-tasks'].includes(view))mode='list';showView();renderAll();if(window.matchMedia('(max-width: 800px)').matches){$('#sidebar').classList.remove('open');$('#planner-app').classList.remove('drawer-open')}}});
  $$('.view-tab').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.mode;renderModes()}));
  $$('#search,#status-filter,#priority-filter').forEach(node=>node.addEventListener(node.id==='search'?'input':'change',renderModes));
  $('#dashboard-view').addEventListener('click',handleTaskClick);
  $('#list-view').addEventListener('click',handleTaskClick);
  $('#focus-view').addEventListener('click',handleTaskClick);
  $('#list-view').addEventListener('click',event=>{const sort=event.target.closest('[data-sort]');if(sort){sortDirection=sortColumn===sort.dataset.sort&&sortDirection==='asc'?'desc':'asc';sortColumn=sort.dataset.sort;renderList()}});
  $('#list-view').addEventListener('keydown',event=>{const title=event.target.closest('[data-inline-title]');if(!title)return;if(event.key==='Enter'){event.preventDefault();title.blur()}if(event.key==='Escape'){const task=taskById(title.dataset.inlineTitle);if(task)title.textContent=task.title;title.blur()}});
  $('#list-view').addEventListener('focusout',async event=>{const title=event.target.closest('[data-inline-title]');if(!title)return;const task=taskById(title.dataset.inlineTitle),next=title.textContent.trim();if(!task)return;if(!next){title.textContent=task.title;toast('Task title cannot be empty');return}if(next===task.title)return;try{await runActions([{type:'update_task',taskId:task.id,title:next}])}catch(error){title.textContent=task.title;toast(error.message)}});
  $('#list-view').addEventListener('dragstart',event=>{const row=event.target.closest('[data-drag-task]');if(row)event.dataTransfer.setData('text/plain',row.dataset.dragTask)});
  $('#board-view').addEventListener('click',handleTaskClick);
  $('#calendar-view').addEventListener('click',event=>{const month=event.target.closest('[data-month]');if(month){if(month.dataset.month==='today')monthCursor=new Date();else if(calendarScale==='month')monthCursor.setMonth(monthCursor.getMonth()+Number(month.dataset.month));else monthCursor.setDate(monthCursor.getDate()+Number(month.dataset.month));renderCalendar();return}handleTaskClick(event)});
  $('#timeline-view').addEventListener('click',handleTaskClick);
  $('#board-view').addEventListener('dragstart',event=>{const card=event.target.closest('[data-drag-task]');if(card)event.dataTransfer.setData('text/plain',card.dataset.dragTask)});
  $('#board-view').addEventListener('dragover',event=>{const col=event.target.closest('[data-drop-status]');if(col){event.preventDefault();col.classList.add('drag-over')}});
  $('#board-view').addEventListener('dragleave',event=>event.target.closest('[data-drop-status]')?.classList.remove('drag-over'));
  $('#board-view').addEventListener('drop',async event=>{const col=event.target.closest('[data-drop-status]');if(!col)return;event.preventDefault();col.classList.remove('drag-over');const id=event.dataTransfer.getData('text/plain');try{await runActions([{type:'update_task',taskId:id,status:col.dataset.dropStatus}])}catch(error){toast(error.message)}});
  $('#calendar-view').addEventListener('dragstart',event=>{const card=event.target.closest('[data-drag-task]');if(card)event.dataTransfer.setData('text/plain',card.dataset.dragTask)});
  $('#calendar-view').addEventListener('dragover',event=>{if(event.target.closest('[data-schedule-date]'))event.preventDefault()});
  $('#calendar-view').addEventListener('drop',async event=>{const day=event.target.closest('[data-schedule-date]');if(!day)return;event.preventDefault();const id=event.dataTransfer.getData('text/plain');if(!id)return;try{await runActions([{type:'update_task',taskId:id,dueDate:day.dataset.scheduleDate}]);toast('Task rescheduled to '+dateLabel(day.dataset.scheduleDate))}catch(error){toast(error.message)}});
  $('#task-dialog').addEventListener('change',async event=>{const input=event.target.closest('[data-toggle-check]');if(!input)return;const taskId=editingTask;await addTaskDetailAction({type:'toggle_checklist_item',taskId,itemId:input.dataset.toggleCheck,done:input.checked},taskId)});
  $('#task-dialog').addEventListener('click',event=>{const download=event.target.closest('[data-download-attachment]');if(download){void downloadAttachment(download.dataset.downloadAttachment);return}const remove=event.target.closest('[data-remove-attachment]');if(remove){void removeAttachment(remove.dataset.removeAttachment);return}});
  $('#upload-attachment').addEventListener('click',uploadAttachment);
  $('#add-checklist-item').addEventListener('click',async()=>{const input=$('#checklist-form input');if(!input.value.trim())return;const id=editingTask;await addTaskDetailAction({type:'add_checklist_item',taskId:id,text:input.value.trim()},id);input.value=''});
  $('#add-comment').addEventListener('click',async()=>{const input=$('#comment-form input');if(!input.value.trim())return;const id=editingTask;await addTaskDetailAction({type:'add_comment',taskId:id,text:input.value.trim()},id);input.value=''});
  $('#duplicate-task').addEventListener('click',async()=>{const task=taskById(editingTask);if(!task)return;try{await runActions([{type:'create_task',projectId:task.projectId,listId:task.listId,parentId:task.parentId||'',title:task.title+' (copy)',description:task.description||'',notes:task.notes||'',status:'todo',priority:task.priority,startDate:task.startDate||'',dueDate:task.dueDate||'',category:task.category||'',important:!!task.important,estimatedMinutes:task.estimatedMinutes||0,tags:task.tags||[]}]);$('#task-dialog').close();toast('Task duplicated')}catch(error){toast(error.message)}});
  $('#delete-task').addEventListener('click',async()=>{const task=taskById(editingTask);if(!task)return;if(!window.confirm('Delete “'+task.title+'” and its subtasks? This cannot be undone.'))return;try{await runActions([{type:'delete_task',taskId:task.id}],true);$('#task-dialog').close();editingTask='';toast('Task deleted')}catch(error){toast(error.message)}});
  $('#select-for-ai').addEventListener('change',()=>{if($('#select-for-ai').checked)selected.add(editingTask);else selected.delete(editingTask);renderSelection();renderModes()});
  $('#ai-form').addEventListener('submit',sendAi);
  $$('.ai-suggestions button').forEach(button=>button.addEventListener('click',()=>sendAi(null,button.dataset.prompt)));
  $('#open-ai').addEventListener('click',openAi);$('#close-ai').addEventListener('click',closeAi);
  $('#menu-button').addEventListener('click',()=>{$('#sidebar').classList.add('open');$('#planner-app').classList.add('drawer-open')});$('#close-sidebar').addEventListener('click',()=>{$('#sidebar').classList.remove('open');$('#planner-app').classList.remove('drawer-open')});
  $('#planner-app').addEventListener('click',event=>{if(event.target===event.currentTarget&&$('#sidebar').classList.contains('open')){$('#sidebar').classList.remove('open');$('#planner-app').classList.remove('drawer-open')}});
  $('#sign-out').addEventListener('click',()=>{localStorage.removeItem('viora_session');token='';showGate()});
  $('#sign-out').title='Sign out of Viora';
  document.addEventListener('click',event=>{const box=event.target.closest('[data-select-task]');if(box){if(box.checked)selected.add(box.dataset.selectTask);else selected.delete(box.dataset.selectTask);renderSelection();return}});
  window.addEventListener('resize',()=>{if(mode==='calendar'&&(view==='project'||view==='calendar'))renderCalendar()});
}
async function addList(projectId) { const name=window.prompt('Name this task list');if(!name?.trim())return;try{const out=await runActions([{type:'create_list',projectId,name:name.trim()}]);currentProject=projectId;currentList=out.results[0].listId;view='project';renderAll();toast('List created')}catch(error){toast(error.message)}}
function handleTaskClick(event) {
  const open=event.target.closest('[data-open-task]');if(open){openTask(open.dataset.openTask);return}
  const select=event.target.closest('[data-select-task]');if(select)return;
}
bindEvents();
async function boot() {
  if (!token) { showGate(); return; }
  showLoading();
  await loadState({force:true});
  if ($('#sync-dot').classList.contains('error')) return;
  const params=new URLSearchParams(location.search),taskId=params.get('task'),projectId=params.get('project');
  if(taskId&&taskById(taskId)){history.replaceState(null,'',location.pathname);openTask(taskId)}
  else if(projectId&&projectById(projectId)){history.replaceState(null,'',location.pathname);openProject(projectId)}
}
boot();
})();
