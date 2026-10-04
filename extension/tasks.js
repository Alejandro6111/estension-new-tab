/* Pendientes con fecha, prioridad, categoría y repetición. */
let editingTaskId = '';
function addTodo(text, extras = {}) {
  text = text.trim().slice(0, 120);
  if (!text) return false;
  if (state.todos.length >= 2000) { announce('El perfil ya tiene 2000 tareas. Limpia las completadas.'); return false; }
  state.todos.push({ id: uid(), text, done: false, due: '', priority: 'normal', repeat: 'none', category: '', ...extras });
  persist(); renderTodos(); return true;
}
function nextTodoDate(todo) {
  const base = new Date(`${todo.due || localDayKey()}T12:00:00`);
  if (todo.repeat === 'daily') base.setDate(base.getDate() + 1);
  if (todo.repeat === 'weekly') base.setDate(base.getDate() + 7);
  if (todo.repeat === 'monthly') {
    const day = todo.repeatDay || base.getDate();
    base.setDate(1); base.setMonth(base.getMonth() + 1);
    base.setDate(Math.min(day, new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()));
  }
  return localDayKey(base);
}
function completeTodo(todo) {
  if (!todo.done && todo.repeat !== 'none' && state.todos.length >= 2000) { announce('Limpia tareas completadas antes de crear la siguiente repetición.'); return; }
  todo.done = !todo.done;
  if (todo.done && todo.repeat !== 'none' && !todo.nextId) {
    const nextId = uid(); todo.nextId = nextId;
    const repeatDay = todo.repeatDay || Number((todo.due || localDayKey()).slice(-2));
    state.todos.push({ id: nextId, text: todo.text, done: false, due: nextTodoDate(todo), priority: todo.priority, repeat: todo.repeat, category: todo.category, repeatDay });
  } else if (!todo.done && todo.nextId) {
    const next = state.todos.find((entry) => entry.id === todo.nextId);
    if (!next || !next.done) { state.todos = state.todos.filter((entry) => entry.id !== todo.nextId); delete todo.nextId; }
  }
  persist(); renderTodos();
}
function todoDateLabel(due) {
  if (!due) return '';
  if (due === localDayKey()) return 'Hoy';
  return new Date(`${due}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}
function renderCalendarTodos() {
  const root = document.getElementById('calendar-todos'); root.replaceChildren();
  const tasks = state.todos.filter((todo) => !todo.done && todo.due).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4);
  if (!tasks.length) return;
  root.append(el('p', 'widget-hint', 'Tareas con fecha'));
  tasks.forEach((todo) => root.append(action(`${todoDateLabel(todo.due)} · ${todo.text}`, () => openTaskEditor(todo.id), 'calendar-task')));
}
function renderTodos() {
  const list = document.getElementById('todo-list'); list.replaceChildren();
  const remaining = state.todos.filter((todo) => !todo.done).length;
  document.getElementById('todo-count').textContent = `${remaining} pendiente${remaining === 1 ? '' : 's'}`;
  document.getElementById('todo-clear').hidden = remaining === state.todos.length;
  const today = localDayKey();
  const due = state.todos.filter((todo) => !todo.done && todo.due === today).length;
  const overdue = state.todos.filter((todo) => !todo.done && todo.due && todo.due < today).length;
  document.getElementById('todo-due-summary').textContent = [due ? `${due} para hoy` : '', overdue ? `${overdue} vencida${overdue === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
  if (!state.todos.length) list.append(el('li', 'todo-empty', 'Nada pendiente por ahora.'));
  const priorities = { high: 0, normal: 1, low: 2 };
  [...state.todos].sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '9999').localeCompare(b.due || '9999') || priorities[a.priority] - priorities[b.priority]).forEach((todo) => {
    const row = el('li', `todo-item${todo.done ? ' done' : ''}`); row.dataset.taskId = todo.id;
    const check = action(todo.done ? '✓' : '', () => completeTodo(todo), `todo-check${todo.done ? ' done' : ''}`);
    check.setAttribute('aria-label', todo.done ? `Marcar «${todo.text}» como pendiente` : `Completar «${todo.text}»`);
    const info = el('div', 'todo-info'); info.append(el('span', 'txt', todo.text));
    const meta = [todoDateLabel(todo.due), { high: 'Alta', normal: '', low: 'Baja' }[todo.priority], todo.category,
      { none: '', daily: 'Cada día', weekly: 'Cada semana', monthly: 'Cada mes' }[todo.repeat]].filter(Boolean).join(' · ');
    if (meta) info.append(el('small', `todo-meta${todo.due && todo.due < today && !todo.done ? ' overdue' : ''}`, meta));
    const edit = action('Editar', () => openTaskEditor(todo.id), 'todo-edit'); edit.setAttribute('aria-label', `Editar «${todo.text}»`);
    const remove = action('✕', () => { state.todos = state.todos.filter((entry) => entry.id !== todo.id); persist(); renderTodos(); }, 'todo-remove');
    remove.setAttribute('aria-label', `Eliminar «${todo.text}»`); row.append(check, info, edit, remove); list.append(row);
  }); renderCalendarTodos();
}
function openTaskEditor(id = '') {
  editingTaskId = id; const todo = state.todos.find((entry) => entry.id === id);
  document.getElementById('task-title').textContent = todo ? 'Editar tarea' : 'Nueva tarea';
  document.getElementById('task-text').value = todo?.text || document.getElementById('todo-input').value;
  document.getElementById('task-due').value = todo?.due || '';
  document.getElementById('task-priority').value = todo?.priority || 'normal';
  document.getElementById('task-repeat').value = todo?.repeat || 'none';
  document.getElementById('task-status').textContent = '';
  const category = document.getElementById('task-category'); category.replaceChildren();
  ['', ...new Set([...state.categories, ...(todo?.category ? [todo.category] : [])])].forEach((value) => { const option = el('option', '', value || 'Sin categoría'); option.value = value; category.append(option); });
  category.value = todo?.category || ''; openModal('task-modal');
}
function setupTodos() {
  document.getElementById('todo-form').addEventListener('submit', (event) => {
    event.preventDefault(); const input = document.getElementById('todo-input'); if (addTodo(input.value)) input.value = '';
  });
  document.getElementById('todo-clear').addEventListener('click', () => { state.todos = state.todos.filter((todo) => !todo.done); persist(); renderTodos(); });
  document.getElementById('todo-advanced').addEventListener('click', () => openTaskEditor());
  document.getElementById('task-detail-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = document.getElementById('task-text').value.trim(), due = document.getElementById('task-due').value, repeat = document.getElementById('task-repeat').value;
    if (!boundedText(text, 120) || due && !validDayKey(due) || repeat !== 'none' && !due) {
      document.getElementById('task-status').textContent = 'Escribe una tarea y elige una fecha válida para repetirla.'; return;
    }
    const extra = { text, due, repeat, priority: document.getElementById('task-priority').value, category: document.getElementById('task-category').value };
    const todo = state.todos.find((entry) => entry.id === editingTaskId);
    if (todo) { Object.assign(todo, extra); if (due) todo.repeatDay = Number(due.slice(-2)); persist(); renderTodos(); }
    else if (!addTodo(text, extra)) return;
    document.getElementById('todo-input').value = ''; closeModal('task-modal');
  });
}
