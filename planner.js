(() => {
'use strict';
const API = 'https://viora-auth-website.onrender.com';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let token = '';
try { token = JSON.parse(localStorage.getItem('viora_session') || 'null')?.token || ''; } catch {}
let state = { projects: [], tasks: [], activity: [] };
let view = 'dashboard', mode = 'list', currentProject = '', currentList = '', editingTask = '', monthCursor = new Date();
const selected = new Set();
let toastTimer;
function localDate(d = new Date()) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,10); }
function dateLabel(value) { if (!value) return 'No date'; const d = new Date(value + 'T12:00:00'); return Number.isNaN(+d) ? 'No date' : d.toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
function dateTime(value) { if (!value) return ''; const d = new Date(value); return Number.isNaN(+d) ? '' : d.toLocaleString(); }
function today() { return localDate(); }
function statusName(value) { return ({todo:'To do',in_progress:'In progress',review:'Review',completed:'Completed'})[value] || 'To do'; }
function priorityName(value) { return ({urgent:'Urgent',high:'High',normal:'Normal',low:'Low'})[value] || 'Normal'; }
function projectById(id) { return state.projects.find(p => p.id === id); }
function taskById(id) { return state.tasks.find(t => t.id === id); }
async function request(path, options = {}) {
  const response = await fetch(API + path, { ...options, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(options.headers || {}) }, cache: 'no-store' });
  let data;
  try { data = await response.json(); } catch { throw new Error('The Planner service returned an invalid response.'); }
  if (!response.ok) throw new Error(data.error || ('Planner request failed (' + response.status + ').'));
  return data;
}
function setSync(ok, text) { $('#sync-dot').classList.toggle('error', !ok); $('#sync-label').textContent = text; }
function announce(message, error = false) {
  const box = $('#notice'); box.hidden = !message; box.textContent = message || ''; box.classList.toggle('error-block', !!error);
}
function toast(message) { const box = $('#toast'); box.textContent = message; box.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => box.classList.remove('show'), 2600); }
function showGate() { $('#signin-gate').hidden = false; $('#planner-app').hidden = true; }
function showApp() { $('#signin-gate').hidden = true; $('#planner-app').hidden = false; }
async function loadState() {
  if (!token) { showGate(); return; }
  setSync(true, 'Syncing privately');
  try {
    state = await request('/api/planner/state');
    state.projects ||= []; state.tasks ||= []; state.activity ||= [];
    showApp(); setSync(true, 'Synced to your account'); announce('');
    renderAll();
  } catch (error) {
    if (/sign in again/i.test(error.message)) { showGate(); return; }
    showApp(); setSync(false, 'Sync unavailable');
    announce(error.message + ' Your Planner changes have not been saved.', true);
    renderAll();
  }
}
async function runActions(actions, confirmed = false) {
  const result = await request('/api/planner/actions', { method: 'POST', body: JSON.stringify({ actions, confirmed }) });
  state = result.state; state.projects ||= []; state.tasks ||= []; state.activity ||= [];
  setSync(true, 'Synced to your account'); announce(''); renderAll();
  return result;
}
function filteredTasks() {
  const query = $('#search')?.value.trim().toLowerCase() || '';
  const status = $('#status-filter')?.value || '', priority = $('#priority-filter')?.value || '';
  return state.tasks.filter(task => {
    if (currentProject && task.projectId !== currentProject) return false;
    if (currentList && task.listId !== currentList) return false;
    if (status && task.status !== status) return false;
    if (priority && task.priority !== priority) return false;
    if (query) {
      const hay = [task.title,task.description,task.assignee,...(task.tags || [])].join(' ').toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  }).sort((a,b) => (a.status === 'completed') - (b.status === 'completed') || (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.title.localeCompare(b.title));
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
  $('#project-view').hidden = view !== 'project';
  $('#activity-view').hidden = view !== 'activity';
  const project = projectById(currentProject);
  const title = view === 'dashboard' ? 'Overview' : view === 'activity' ? 'Activity' : (project?.name || 'Project');
  $('#current-crumb').textContent = title + (currentList ? ' / ' + (project?.lists.find(x => x.id === currentList)?.name || '') : '');
  if (view === 'dashboard') { $('#page-title').textContent = 'Good work starts with a plan.'; $('#page-subtitle').textContent = 'A clear view of what’s moving, what’s next, and where Viora can help.'; $('#head-eyebrow').textContent = 'YOUR PRODUCTIVITY, IN FOCUS'; }
  else if (view === 'activity') { $('#page-title').textContent = 'Workspace activity'; $('#page-subtitle').textContent = 'A private history of changes across your projects.'; $('#head-eyebrow').textContent = 'RECENT CHANGES'; }
  else { $('#page-title').textContent = title; $('#page-subtitle').textContent = project?.description || 'Plan the work, see the progress, and keep every next step in view.'; $('#head-eyebrow').textContent = currentList ? 'TASK LIST' : (project?.folder || 'PROJECT'); }
  $('#add-list').hidden = view !== 'project';
  $$('.side-link').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  renderSidebar();
}
function renderTaskMini(task) {
  return '<div class="task-row"><span class="task-indicator ' + esc(task.priority) + '"></span><div class="task-copy"><strong><button class="task-open-link" data-open-task="' + esc(task.id) + '">' + esc(task.title) + '</button></strong><small>' + esc(taskProjectName(task)) + ' · ' + esc(statusName(task.status)) + '</small></div><span class="task-date">' + esc(dateLabel(task.dueDate)) + '</span></div>';
}
function renderDashboard() {
  const tasks = state.tasks, day = today(), active = tasks.filter(t => t.status !== 'completed');
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
  const recent = [...tasks].sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,7);
  $('#recent-list').innerHTML = recent.length ? recent.map(renderTaskMini).join('') : '<div class="empty-state">Your recently updated tasks will appear here.</div>';
}
function statusCell(status) { return '<span class="status-pill ' + esc(status) + '">' + esc(statusName(status)) + '</span>'; }
function priorityCell(priority) { return '<span class="priority-pill ' + esc(priority) + '">' + esc(priorityName(priority)) + '</span>'; }
function renderList() {
  const tasks = filteredTasks();
  if (!tasks.length) { $('#list-view').innerHTML = '<div class="empty-state">No tasks match this view. Create one or adjust the filters.</div>'; return; }
  let rows = '';
  for (const task of tasks) {
    const tags = (task.tags || []).slice(0,3).map(tag => '<span class="tag">' + esc(tag) + '</span>').join(' ');
    rows += '<tr><td class="row-select"><input class="table-check select-task" type="checkbox" aria-label="Select ' + esc(task.title) + '" data-select-task="' + esc(task.id) + '"' + (selected.has(task.id) ? ' checked' : '') + '></td><td class="task-title-cell ' + (task.parentId ? 'task-subtask' : '') + '"><button class="task-open-link" data-open-task="' + esc(task.id) + '">' + esc(task.parentId ? '↳ ' : '') + esc(task.title) + '</button></td><td>' + esc(taskProjectName(task)) + ' / ' + esc(taskListName(task)) + '</td><td>' + statusCell(task.status) + '</td><td>' + priorityCell(task.priority) + '</td><td>' + esc(task.assignee || '—') + '</td><td>' + esc(dateLabel(task.dueDate)) + '</td><td>' + tags + '</td></tr>';
  }
  $('#list-view').innerHTML = '<table class="list-table"><thead><tr><th></th><th>Task</th><th>Project / list</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due</th><th>Tags</th></tr></thead><tbody>' + rows + '</tbody></table>';
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
  const year = monthCursor.getFullYear(), month = monthCursor.getMonth(), first = new Date(year, month, 1), start = new Date(year, month, 1 - first.getDay());
  const monthName = monthCursor.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  let days = '<div class="calendar-head"><button class="button ghost" data-month="-1">←</button><h2>' + esc(monthName) + '</h2><button class="button ghost" data-month="1">→</button></div><div class="calendar">';
  for (const name of ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']) days += '<div class="cal-dow">' + name + '</div>';
  for (let i=0;i<42;i++) {
    const date = new Date(start); date.setDate(start.getDate()+i); const key = localDate(date);
    const items = filteredTasks().filter(task => task.dueDate === key);
    days += '<div class="cal-day' + (date.getMonth() !== month ? ' muted' : '') + (key === today() ? ' today' : '') + '"><span class="cal-date">' + date.getDate() + '</span>' + items.slice(0,3).map(task => '<button class="cal-task" data-open-task="' + esc(task.id) + '" title="' + esc(task.title) + '">' + esc(task.title) + '</button>').join('') + (items.length > 3 ? '<span class="cal-extra">+' + (items.length-3) + ' more</span>' : '') + '</div>';
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
  if (mode === 'list') renderList(); if (mode === 'board') renderBoard(); if (mode === 'calendar') renderCalendar(); if (mode === 'timeline') renderTimeline();
}
function renderSelection() {
  const count = selected.size; $('#selected-count').textContent = count ? count + ' task' + (count === 1 ? '' : 's') + ' selected for context' : 'Your workspace is ready';
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
  form.elements.assignee.value = task?.assignee || '';
  form.elements.tags.value = (task?.tags || []).join(', ');
  form.elements.description.value = task?.description || '';
}
function renderTaskExtras(task) {
  const extras = $('#task-extras'); extras.hidden = !task;
  if (!task) return;
  $('#checklist-list').innerHTML = (task.checklist || []).map(item => '<label class="check-row' + (item.done ? ' done' : '') + '"><input type="checkbox" data-toggle-check="' + esc(item.id) + '"' + (item.done ? ' checked' : '') + '><span>' + esc(item.text) + '</span></label>').join('') || '<span class="muted">No checklist items yet.</span>';
  $('#comment-list').innerHTML = (task.comments || []).map(comment => '<div class="comment-item"><strong>' + esc(comment.author) + '</strong><small>' + esc(dateTime(comment.at)) + '</small><p>' + esc(comment.text) + '</p></div>').join('') || '<span class="muted">No comments yet.</span>';
  $('#select-for-ai').checked = selected.has(task.id);
}
function openTask(id) {
  const task = id ? taskById(id) : null; editingTask = task?.id || '';
  $('#task-dialog-title').textContent = task ? 'Edit task' : 'New task';
  $('#task-kicker').textContent = task ? taskProjectName(task).toUpperCase() : 'TASK DETAILS';
  populateTaskForm(task); renderTaskExtras(task); $('#task-save-note').textContent = '';
  $('#task-dialog').showModal();
}
function updateStateFromResult(data) { if (data.state) { state = data.state; renderAll(); } }
async function saveTask(event) {
  event.preventDefault(); const form = $('#task-form'), data = new FormData(form);
  const fields = {title:String(data.get('title')||'').trim(),description:String(data.get('description')||''),status:String(data.get('status')),priority:String(data.get('priority')),startDate:String(data.get('startDate')||''),dueDate:String(data.get('dueDate')||''),assignee:String(data.get('assignee')||'').trim(),tags:String(data.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean)};
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
      await runActions([{type:'create_task',projectId,listId,parentId,title:fields.title,description:fields.description,status:fields.status,priority:fields.priority,startDate:fields.startDate,dueDate:fields.dueDate,assignee:fields.assignee,tags:fields.tags}]);
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
  const input=$('#ai-input'), command=String(promptOverride||input.value||'').trim();
  if(!command)return;
  input.value=''; pushAiMessage(command,'user');
  const waiting=pushAiMessage('Checking your workspace and preparing the right actions…','assistant'); waiting.classList.add('pending'); $('#ai-send').disabled=true;
  try {
    let data=await request('/api/planner/assistant',{method:'POST',body:JSON.stringify({command,selectedTaskIds:[...selected]})});
    waiting.remove();
    if(data.confirmationRequired) {
      const summary=data.actions.map(action=>action.type==='delete_task'?'Delete “'+(taskById(action.taskId)?.title||'task')+'”':'Complete '+action.type.replaceAll('_',' ')).join('\n');
      if(!window.confirm('Viora is asking to delete or change this data:\n\n'+summary+'\n\nContinue?')) { pushAiMessage('Cancelled. No changes were made.','assistant'); return; }
      data=await request('/api/planner/assistant/confirm',{method:'POST',body:JSON.stringify({confirmationId:data.confirmationId})});
    }
    if(data.state) { state=data.state; renderAll(); }
    pushAiMessage(data.message || 'The request finished.','assistant');
  } catch(error) { waiting.remove(); pushAiMessage('I could not complete that Planner request: '+error.message,'assistant'); }
  finally { $('#ai-send').disabled=false; }
}
function openAi() { $('#ai-panel').classList.add('open'); }
function closeAi() { $('#ai-panel').classList.remove('open'); }
function bindEvents() {
  $('#refresh').addEventListener('click',loadState);
  $('#new-task').addEventListener('click',openNewTask);
  $('#add-project').addEventListener('click',()=>$('#project-dialog').showModal());
  $('#project-form').addEventListener('submit',async event=>{event.preventDefault();const data=new FormData(event.currentTarget);const name=String(data.get('name')||'').trim();if(!name)return;try{await createProject(name,String(data.get('folder')||'').trim(),String(data.get('description')||''));event.currentTarget.reset();$('#project-dialog').close()}catch(error){toast(error.message)}});
  $('#task-form').addEventListener('submit',saveTask);
  $('#task-form').elements.projectId.addEventListener('change',()=>{const task=taskById(editingTask);const id=$('#task-form').elements.projectId.value;const project=projectById(id);$('#task-form').elements.listId.replaceChildren(...(project?.lists||[]).map(list=>new Option(list.name,list.id)));$('#task-form').elements.parentId.replaceChildren(new Option('No parent (top-level)',''),...state.tasks.filter(t=>t.projectId===id&&!t.parentId&&t.id!==editingTask).map(t=>new Option(t.title,t.id)))});
  $('#add-list').addEventListener('click',()=>addList(currentProject));
  $('#project-tree').addEventListener('click',async event=>{if(event.target.closest('#empty-add-project')){ $('#project-dialog').showModal(); return; }const add=event.target.closest('[data-add-list]');if(add){await addList(add.dataset.addList);return}const target=event.target.closest('[data-project]');if(!target)return;if(target.dataset.list){currentProject=target.dataset.project;currentList=target.dataset.list;view='project';mode='list';showView();renderAll()}else openProject(target.dataset.project)});
  $('#empty-add-project')?.addEventListener('click',()=>$('#project-dialog').showModal());
  $('#sidebar').addEventListener('click',event=>{const button=event.target.closest('[data-view]');if(button){view=button.dataset.view;currentProject='';currentList='';showView();renderAll();if(window.matchMedia('(max-width: 800px)').matches)$('#sidebar').classList.remove('open')}});
  $$('.view-tab').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.mode;renderModes()}));
  $$('#search,#status-filter,#priority-filter').forEach(node=>node.addEventListener(node.id==='search'?'input':'change',renderModes));
  $('#dashboard-view').addEventListener('click',handleTaskClick);
  $('#list-view').addEventListener('click',handleTaskClick);
  $('#board-view').addEventListener('click',handleTaskClick);
  $('#calendar-view').addEventListener('click',event=>{const month=event.target.closest('[data-month]');if(month){monthCursor.setMonth(monthCursor.getMonth()+Number(month.dataset.month));renderCalendar();return}handleTaskClick(event)});
  $('#timeline-view').addEventListener('click',handleTaskClick);
  $('#board-view').addEventListener('dragstart',event=>{const card=event.target.closest('[data-drag-task]');if(card)event.dataTransfer.setData('text/plain',card.dataset.dragTask)});
  $('#board-view').addEventListener('dragover',event=>{const col=event.target.closest('[data-drop-status]');if(col){event.preventDefault();col.classList.add('drag-over')}});
  $('#board-view').addEventListener('dragleave',event=>event.target.closest('[data-drop-status]')?.classList.remove('drag-over'));
  $('#board-view').addEventListener('drop',async event=>{const col=event.target.closest('[data-drop-status]');if(!col)return;event.preventDefault();col.classList.remove('drag-over');const id=event.dataTransfer.getData('text/plain');try{await runActions([{type:'update_task',taskId:id,status:col.dataset.dropStatus}])}catch(error){toast(error.message)}});
  $('#task-dialog').addEventListener('change',async event=>{const input=event.target.closest('[data-toggle-check]');if(!input)return;const taskId=editingTask;await addTaskDetailAction({type:'toggle_checklist_item',taskId,itemId:input.dataset.toggleCheck,done:input.checked},taskId)});
  $('#add-checklist-item').addEventListener('click',async()=>{const input=$('#checklist-form input');if(!input.value.trim())return;const id=editingTask;await addTaskDetailAction({type:'add_checklist_item',taskId:id,text:input.value.trim()},id);input.value=''});
  $('#add-comment').addEventListener('click',async()=>{const input=$('#comment-form input');if(!input.value.trim())return;const id=editingTask;await addTaskDetailAction({type:'add_comment',taskId:id,text:input.value.trim()},id);input.value=''});
  $('#select-for-ai').addEventListener('change',()=>{if($('#select-for-ai').checked)selected.add(editingTask);else selected.delete(editingTask);renderSelection();renderModes()});
  $('#ai-form').addEventListener('submit',sendAi);
  $$('.ai-suggestions button').forEach(button=>button.addEventListener('click',()=>sendAi(null,button.dataset.prompt)));
  $('#open-ai').addEventListener('click',openAi);$('#close-ai').addEventListener('click',closeAi);
  $('#menu-button').addEventListener('click',()=>{$('#sidebar').classList.add('open');$('#planner-app').classList.add('drawer-open')});$('#close-sidebar').addEventListener('click',()=>{$('#sidebar').classList.remove('open');$('#planner-app').classList.remove('drawer-open')});
  $('#planner-app').addEventListener('click',event=>{if(event.target===event.currentTarget&&$('#sidebar').classList.contains('open')){$('#sidebar').classList.remove('open');$('#planner-app').classList.remove('drawer-open')}});
  $('#sign-out').addEventListener('click',()=>{localStorage.removeItem('viora_session');token='';showGate()});
  $('#sign-out').title='Sign out of Viora';
  document.addEventListener('click',event=>{const box=event.target.closest('[data-select-task]');if(box){if(box.checked)selected.add(box.dataset.selectTask);else selected.delete(box.dataset.selectTask);renderSelection();return}});
  window.addEventListener('resize',()=>{if(mode==='calendar'&&view==='project')renderCalendar()});
}
async function addList(projectId) { const name=window.prompt('Name this task list');if(!name?.trim())return;try{const out=await runActions([{type:'create_list',projectId,name:name.trim()}]);currentProject=projectId;currentList=out.results[0].listId;view='project';renderAll();toast('List created')}catch(error){toast(error.message)}}
function handleTaskClick(event) {
  const open=event.target.closest('[data-open-task]');if(open){openTask(open.dataset.openTask);return}
  const select=event.target.closest('[data-select-task]');if(select)return;
}
bindEvents();
async function boot() {
  if (!token) { showGate(); return; }
  try { state=await request('/api/planner/state'); state.projects ||= [];state.tasks ||= [];state.activity ||= [];showApp();setSync(true,'Synced to your account');renderAll(); }
  catch(error) { if(/sign in again/i.test(error.message)){showGate();return} showApp();setSync(false,'Sync unavailable');announce(error.message,true);renderAll(); }
}
boot();
})();