// Calendario RIVECT: cliente vanilla (sin dependencias).
// Todo el DOM se arma con createElement / textContent. Nunca innerHTML con datos.

const PROJECTS = { pulso: 'Pulso', landur: 'LANDUR', studio: 'Studio', retail: 'Retail', general: 'General' };
const KINDS = { contacto: 'Contacto', entrevista: 'Entrevista', entrega: 'Entrega', vencimiento: 'Vencimiento', otro: 'Otro' };
const STATUSES = { pendiente: 'Pendiente', en_curso: 'En curso', hecho: 'Hecho' };
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']; // indexed by getDay()
const SHORT_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']; // Monday-first
const AGENDA_BACK = 7;
const AGENDA_AHEAD = 60;
const MAX_CHIPS = 3;
const DAY_SEL = '.cal-day, .cal-week-col';
const VIEW_CLASSES = ['view-month', 'view-week', 'view-agenda'];

let els = {};
const state = {
  view: 'month',
  preferredView: 'month',
  forced: false,
  cursor: null,
  csrf: '',
  user: null,
  me: null,
  people: [],
  jobs: [],
  filters: { project: '', assignee: '', status: '' },
  loadSeq: 0,
  pendingSlide: '',
  dragId: null,
  keyMoveId: null,
  editing: null,
  returnTo: null,
  dialogReadonly: false,
  deleteArmed: false,
  deleteTimer: 0,
  toastTimer: 0,
  slideTimer: 0,
};

// ---------- pure helpers ----------

const pad = (n) => String(n).padStart(2, '0');

function iso(date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseIso(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(d) || d.getMonth() !== Number(m[2]) - 1) return null;
  return d;
}

function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

function today() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function weekStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return addDays(d, -((d.getDay() + 6) % 7));
}

function monthStart(date) {
  return weekStart(new Date(date.getFullYear(), date.getMonth(), 1));
}

function monthRange(date) {
  const s = monthStart(date);
  return { from: iso(s), to: iso(addDays(s, 41)) };
}

function monthGrid(date) {
  const s = monthStart(date);
  return Array.from({ length: 42 }, (_, i) => addDays(s, i));
}

function formatTitle(view, cursor) {
  if (view === 'agenda') return `Próximos ${AGENDA_AHEAD} días`;
  if (view === 'week') {
    const s = weekStart(cursor);
    const e = addDays(s, 6);
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()} al ${e.getDate()} de ${MONTHS[e.getMonth()]} de ${e.getFullYear()}`;
    }
    const sYear = s.getFullYear() !== e.getFullYear() ? ` de ${s.getFullYear()}` : '';
    return `${s.getDate()} de ${MONTHS[s.getMonth()]}${sYear} al ${e.getDate()} de ${MONTHS[e.getMonth()]} de ${e.getFullYear()}`;
  }
  return `${MONTHS[cursor.getMonth()]} de ${cursor.getFullYear()}`;
}

function filterJobs(jobs, f = {}) {
  return jobs.filter((j) =>
    (!f.project || j.project === f.project) &&
    (!f.assignee || j.assignee === f.assignee) &&
    (!f.status || j.status === f.status));
}

function compareJobs(a, b) {
  return a.date.localeCompare(b.date)
    || Number(!a.allDay) - Number(!b.allDay)
    || (a.start || '').localeCompare(b.start || '')
    || (a.title || '').localeCompare(b.title || '', 'es')
    || String(a.id).localeCompare(String(b.id));
}

function groupByDate(jobs) {
  const map = new Map();
  for (const job of jobs) {
    if (!map.has(job.date)) map.set(job.date, []);
    map.get(job.date).push(job);
  }
  return map;
}

// ---------- small DOM / utility helpers ----------

function node(tag, className = '', text = '') {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== '') n.textContent = String(text);
  return n;
}

function known(value, map, fallback) {
  return Object.prototype.hasOwnProperty.call(map, value) ? value : fallback;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function reduced() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function failure(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function jobUrl(id) {
  return `/api/calendar/jobs/${encodeURIComponent(id)}`;
}

// ---------- API ----------

async function api(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(method === 'GET' ? {} : { 'x-csrf-token': state.csrf }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (cause) {
    throw failure('Sin conexión… Revisá tu red e intentá de nuevo.', 0);
  }
  if (response.status === 401) {
    location.assign('/login');
    throw failure('La sesión venció.', 401);
  }
  let data = null;
  try { data = await response.json(); } catch (cause) { data = null; }
  if (!response.ok) {
    const err = failure(data?.error || 'No se pudo completar la solicitud.', response.status);
    err.job = data?.job || null;
    throw err;
  }
  return data;
}

// ---------- state helpers ----------

function canWrite() {
  return !!(state.me && state.me.write);
}

// Projects (in PROJECTS order) where this user may create and edit jobs.
function writable() {
  const wp = Array.isArray(state.me?.writeProjects) ? state.me.writeProjects : [];
  return Object.keys(PROJECTS).filter((p) => wp.includes(p));
}

function canEditJob(job) {
  return !!(state.me && state.me.write && (state.me.admin || writable().includes(job.project)));
}

function canDelete(job) {
  return !!(state.me && (state.me.admin || (canEditJob(job) && job.createdBy === state.me.id)));
}

function findJob(id) {
  return state.jobs.find((j) => j.id === id) || null;
}

function replaceJob(job) {
  const idx = state.jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) state.jobs[idx] = job;
  else state.jobs.push(job);
}

function toPayload(job, overrides = {}) {
  return {
    title: job.title,
    date: job.date,
    allDay: !!job.allDay,
    start: job.allDay ? '' : job.start || '',
    end: job.allDay ? '' : job.end || '',
    project: job.project,
    kind: job.kind,
    assignee: job.assignee || '',
    status: job.status,
    notes: job.notes || '',
    ...overrides,
  };
}

function visibleJobs() {
  return filterJobs(state.jobs, state.filters).sort(compareJobs);
}

function currentRange() {
  if (state.view === 'agenda') {
    const t = today();
    return { from: iso(addDays(t, -AGENDA_BACK)), to: iso(addDays(t, AGENDA_AHEAD)) };
  }
  if (state.view === 'week') {
    const s = weekStart(state.cursor);
    return { from: iso(s), to: iso(addDays(s, 6)) };
  }
  return monthRange(state.cursor);
}

// ---------- rendering ----------

function showGridMessage(text, cls = '') {
  els.grid.replaceChildren(node('p', cls ? `cal-empty ${cls}` : 'cal-empty', text));
}

function personName(id) {
  if (!id) return '';
  const p = state.people.find((x) => x.id === id);
  return p ? p.name : 'Usuario inactivo';
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
}

function makeChip(job, { index = 0, animate = false, draggable = false, who = false } = {}) {
  const project = known(job.project, PROJECTS, 'general');
  const status = known(job.status, STATUSES, 'pendiente');
  const chip = node('button', `cal-chip p-${project} s-${status}`);
  chip.type = 'button';
  chip.dataset.jobId = job.id;
  chip.setAttribute('draggable', draggable ? 'true' : 'false');
  if (job.allDay) chip.classList.add('allday');
  const person = personName(job.assignee);
  chip.title = `${job.title} · Responsable: ${person || 'sin responsable'} · ${PROJECTS[project]} · ${STATUSES[status]}`;
  chip.append(
    node('span', 'cal-chip-time', job.allDay ? 'Día' : job.start || ''),
    node('span', 'cal-chip-title', job.title),
  );
  if (who && person) chip.append(node('span', 'cal-chip-who', initials(person)));
  if (animate && !reduced()) {
    chip.classList.add('enter');
    chip.style.setProperty('--i', String(Math.min(index, 12)));
  }
  return chip;
}

function makeDayCell(date, todayKey) {
  const key = iso(date);
  const cell = node('div', 'cal-day');
  cell.dataset.date = key;
  cell.tabIndex = -1;
  if ((date.getDay() + 6) % 7 >= 5) cell.classList.add('is-weekend');
  if (key === todayKey) cell.classList.add('is-today');
  return cell;
}

function renderMonth(jobs, animate) {
  const frag = document.createDocumentFragment();
  const todayKey = iso(today());
  for (const label of SHORT_DAYS) frag.append(node('div', 'cal-dow', label));
  const byDate = groupByDate(jobs);
  monthGrid(state.cursor).forEach((date, i) => {
    const key = iso(date);
    const cell = makeDayCell(date, todayKey);
    if (date.getMonth() !== state.cursor.getMonth()) cell.classList.add('is-outside');
    cell.append(node('span', 'cal-day-num', String(date.getDate())));
    const list = byDate.get(key) || [];
    const holder = node('div', 'cal-day-jobs');
    list.slice(0, MAX_CHIPS).forEach((job) => holder.append(makeChip(job, { draggable: canEditJob(job) })));
    if (list.length > MAX_CHIPS) {
      const more = node('button', 'cal-more', `+${list.length - MAX_CHIPS} más`);
      more.type = 'button';
      more.title = 'Ver la semana completa';
      more.setAttribute('aria-label', `Ver todos los trabajos de la semana del ${date.getDate()} de ${MONTHS[date.getMonth()]}`);
      holder.append(more);
    }
    cell.append(holder);
    if (animate && !reduced()) {
      cell.classList.add('enter');
      cell.style.setProperty('--i', String(Math.min(i, 12)));
    }
    frag.append(cell);
  });
  return frag;
}

function renderWeek(jobs, animate) {
  const frag = document.createDocumentFragment();
  const start = weekStart(state.cursor);
  const todayKey = iso(today());
  const byDate = groupByDate(jobs);
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    const key = iso(date);
    const col = makeDayCell(date, todayKey);
    col.classList.add('cal-week-col');
    const head = node('div', 'cal-week-head');
    head.append(node('span', 'cal-dow', SHORT_DAYS[i]), node('span', 'cal-day-num', String(date.getDate())));
    const slots = node('div', 'cal-slot-list');
    (byDate.get(key) || []).forEach((job) => slots.append(makeChip(job, { draggable: canEditJob(job), who: true })));
    col.append(head, slots);
    if (animate && !reduced()) {
      col.classList.add('enter');
      col.style.setProperty('--i', String(Math.min(i, 12)));
    }
    frag.append(col);
  }
  return frag;
}

function renderAgenda(jobs, animate) {
  const frag = document.createDocumentFragment();
  if (!jobs.length) {
    frag.append(node('p', 'cal-empty', 'No hay trabajos en este rango.'));
    return frag;
  }
  const todayKey = iso(today());
  let index = 0;
  for (const [key, list] of groupByDate(jobs)) {
    const date = parseIso(key);
    const section = node('section', 'cal-agenda-day');
    if (key === todayKey) section.classList.add('is-today');
    section.dataset.date = key;
    section.append(node('h3', '', capitalize(`${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`)));
    const ul = node('ul', 'cal-agenda-list');
    for (const job of list) {
      const li = node('li', 'cal-agenda-item');
      li.append(makeChip(job, { index: index++, animate, draggable: false, who: true }));
      ul.append(li);
    }
    section.append(ul);
    frag.append(section);
  }
  return frag;
}

function syncViewClass() {
  els.grid.classList.remove(...VIEW_CLASSES);
  els.grid.classList.add(`view-${state.view}`);
}

function slideGrid(cls) {
  if (reduced()) return;
  els.grid.classList.remove('slide-left', 'slide-right');
  void els.grid.offsetWidth;
  els.grid.classList.add(cls);
  clearTimeout(state.slideTimer);
  state.slideTimer = setTimeout(() => els.grid.classList.remove(cls), 350);
}

function findChipEl(id) {
  return Array.from(els.grid.querySelectorAll('.cal-chip')).find((c) => c.dataset.jobId === id) || null;
}

function render({ animate = false, droppedId = '' } = {}) {
  const jobs = visibleJobs();
  syncViewClass();
  let content;
  if (state.view === 'week') content = renderWeek(jobs, animate);
  else if (state.view === 'agenda') content = renderAgenda(jobs, animate);
  else content = renderMonth(jobs, animate);
  els.grid.replaceChildren(content);
  if (state.pendingSlide) {
    slideGrid(state.pendingSlide);
    state.pendingSlide = '';
  }
  if (droppedId && !reduced()) {
    const chip = findChipEl(droppedId);
    if (chip) {
      chip.classList.add('dropped');
      setTimeout(() => chip.classList.remove('dropped'), 600);
    }
  }
  updateTitle();
  updateButtons();
}

function updateTitle() {
  els.title.textContent = formatTitle(state.view, state.cursor);
}

function updateButtons() {
  for (const b of els.viewButtons) {
    const on = b.dataset.view === state.view;
    b.setAttribute('aria-pressed', String(on));
    b.disabled = state.forced && b.dataset.view !== 'agenda';
  }
  const agenda = state.view === 'agenda';
  els.prev.disabled = agenda;
  els.next.disabled = agenda;
}

function applyPermissions() {
  const write = canWrite();
  els.newBtn.hidden = !write;
  els.newBtn.disabled = !write;
  els.readonly.hidden = write;
}

// ---------- data loading ----------

async function loadJobs({ animate = true } = {}) {
  const seq = ++state.loadSeq;
  const range = currentRange();
  try {
    const data = await api(`/api/calendar/jobs?from=${range.from}&to=${range.to}`);
    if (seq !== state.loadSeq) return;
    state.me = data.me || null;
    state.jobs = Array.isArray(data.jobs) ? data.jobs : [];
    applyPermissions();
    render({ animate });
  } catch (err) {
    if (seq !== state.loadSeq || err.status === 401) return;
    if (err.status === 403 || !state.me) showGridMessage(err.message, 'is-error');
    else toast(err.message, true);
  }
}

function fillPeople(people) {
  state.people = people;
  fillAssigneeOptions(els.fAssignee, 'Todos', state.filters.assignee);
  fillAssigneeOptions(field('assignee'), 'Sin responsable', '');
}

function fillAssigneeOptions(select, emptyLabel, selected) {
  const options = [new Option(emptyLabel, '')];
  for (const p of state.people) options.push(new Option(p.name, p.id));
  if (selected && !state.people.some((p) => p.id === selected)) {
    options.push(new Option('Usuario inactivo', selected));
  }
  select.replaceChildren(...options);
  select.value = selected || '';
}

function ensureOptions(select, map, keepFirst) {
  const min = keepFirst ? 1 : 0;
  if (keepFirst && select.options.length === 0) select.add(new Option('Todos', ''));
  if (select.options.length > min) return;
  for (const [value, label] of Object.entries(map)) select.add(new Option(label, value));
}

// ---------- navigation ----------

// ---------- URL hash route (#/mes/YYYY-MM, #/semana/YYYY-MM-DD, #/agenda) ----------

function routeFor(view, cursor) {
  if (view === 'agenda') return '#/agenda';
  if (view === 'week') return `#/semana/${iso(weekStart(cursor))}`;
  return `#/mes/${iso(cursor).slice(0, 7)}`;
}

function parseRoute(hash) {
  const h = hash || '';
  let m = /^#\/mes\/(\d{4})-(\d{2})$/.exec(h);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    return { view: 'month', cursor: new Date(Number(m[1]), Number(m[2]) - 1, 1) };
  }
  m = /^#\/semana\/(\d{4}-\d{2}-\d{2})$/.exec(h);
  if (m) {
    const d = parseIso(m[1]);
    return d ? { view: 'week', cursor: d } : null;
  }
  if (h === '#/agenda') return { view: 'agenda', cursor: null };
  return null;
}

// Writes the current view into the hash. Forced agenda (narrow screens) leaves the hash alone.
function commitRoute(replace = false) {
  if (state.forced) return;
  const h = routeFor(state.view, state.cursor);
  if (location.hash === h) return;
  if (replace) history.replaceState(null, '', h);
  else location.hash = h;
}

function onHashChange() {
  const r = parseRoute(location.hash);
  if (!r || routeFor(state.view, state.cursor) === location.hash) return;
  if (r.cursor) state.cursor = r.cursor;
  if (!state.forced) {
    state.view = r.view;
    state.preferredView = r.view;
  }
  updateButtons();
  loadJobs();
}

function setView(view) {
  if (view === state.view) return;
  if (state.forced && view !== 'agenda') return;
  state.view = view;
  if (!state.forced) state.preferredView = view;
  updateButtons();
  commitRoute();
  loadJobs();
}

function navigate(dir) {
  if (state.view === 'agenda') return;
  const c = state.cursor;
  state.cursor = state.view === 'month'
    ? new Date(c.getFullYear(), c.getMonth() + dir, 1)
    : addDays(c, 7 * dir);
  state.pendingSlide = dir > 0 ? 'slide-left' : 'slide-right';
  commitRoute();
  loadJobs();
}

function goToday() {
  state.cursor = today();
  commitRoute();
  loadJobs();
}

function goToWeek(date) {
  state.view = 'week';
  state.preferredView = 'week';
  state.cursor = date;
  updateButtons();
  commitRoute();
  loadJobs();
}

function syncForced() {
  state.forced = !!(els.narrow && els.narrow.matches);
  state.view = state.forced ? 'agenda' : state.preferredView;
}

// ---------- toast ----------

function toast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle('is-error', isError);
  els.toast.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => els.toast.classList.remove('show'), 4000);
}

// ---------- dialog ----------

function field(name) {
  return els.form.elements.namedItem(name);
}

function draft(date) {
  return {
    title: '',
    date: iso(date || today()),
    allDay: true,
    start: '',
    end: '',
    project: writable()[0] || 'general',
    kind: 'otro',
    assignee: '',
    status: 'pendiente',
    notes: '',
  };
}

function fillForm(v) {
  field('title').value = v.title || '';
  field('date').value = v.date || '';
  field('allDay').checked = !!v.allDay;
  field('start').value = v.allDay ? '' : v.start || '';
  field('end').value = v.allDay ? '' : v.end || '';
  fillProjectOptions(known(v.project, PROJECTS, 'general'), state.dialogReadonly);
  field('kind').value = known(v.kind, KINDS, 'otro');
  field('status').value = known(v.status, STATUSES, 'pendiente');
  fillAssigneeOptions(field('assignee'), 'Sin responsable', v.assignee || '');
  field('notes').value = v.notes || '';
  syncTimeFields();
}

// Offers only the projects this user can write to; a read-only job shows just its own project.
function fillProjectOptions(selected, readonly) {
  const ids = readonly ? [selected] : writable();
  field('project').replaceChildren(...ids.map((id) => new Option(PROJECTS[id] || id, id)));
  field('project').value = selected;
}

function syncTimeFields() {
  const off = field('allDay').checked;
  const ro = state.dialogReadonly;
  field('start').disabled = off || ro;
  field('end').disabled = off || ro;
  if (!off && !ro && !field('start').value) field('start').value = '09:00';
}

function setDialogReadonly(ro) {
  for (const control of Array.from(els.form.elements)) {
    if (control.id === 'job-cancel') continue;
    control.disabled = ro;
  }
  syncTimeFields();
}

function setFormError(message, focusEl = null) {
  for (const input of Array.from(els.form.querySelectorAll('[aria-invalid]'))) {
    input.removeAttribute('aria-invalid');
  }
  els.formError.textContent = message;
  if (!message) return;
  if (focusEl && !focusEl.disabled && typeof focusEl.focus === 'function') {
    focusEl.setAttribute('aria-invalid', 'true');
    focusEl.focus();
  }
  els.formError.scrollIntoView({ block: 'nearest' });
}

function readForm() {
  const allDay = field('allDay').checked;
  return {
    title: field('title').value.trim(),
    date: field('date').value,
    allDay,
    start: allDay ? '' : field('start').value,
    end: allDay ? '' : field('end').value,
    project: field('project').value,
    kind: field('kind').value,
    assignee: field('assignee').value,
    status: field('status').value,
    notes: field('notes').value,
  };
}

function validatePayload(p) {
  if (!p.title) return ['title', 'Escribí un título.'];
  if (p.title.length > 120) return ['title', 'El título no puede superar los 120 caracteres.'];
  if (!parseIso(p.date)) return ['date', 'Elegí una fecha válida.'];
  if (!p.allDay) {
    if (!/^\d{2}:\d{2}$/.test(p.start)) return ['start', 'Indicá la hora de inicio o marcá "Todo el día".'];
    if (p.end && p.end < p.start) return ['end', 'La hora de fin no puede ser anterior al inicio.'];
  }
  if (p.notes.length > 2000) return ['notes', 'Las notas no pueden superar los 2000 caracteres.'];
  return null;
}

function openDialog({ job = null, date = null, opener = null } = {}) {
  if (els.dialog.open) return;
  const ro = job ? !canEditJob(job) : !canWrite();
  state.editing = job;
  state.dialogReadonly = ro;
  state.returnTo = {
    opener: opener || document.activeElement,
    jobId: job ? job.id : '',
    date: date ? iso(date) : '',
  };
  disarmDelete();
  setFormError('');
  fillForm(job ? { ...job } : draft(date));
  setDialogReadonly(ro);
  els.save.hidden = ro;
  if (job && ro) setFormError('Solo lectura: no tenés permiso de edición en este proyecto.');
  els.delete.hidden = ro || !job || !canDelete(job);
  els.cancel.textContent = ro ? 'Cerrar' : 'Cancelar';
  els.dialogTitle.textContent = ro ? 'Ver trabajo' : job ? 'Editar trabajo' : 'Nuevo trabajo';
  els.dialog.showModal();
  (ro ? els.cancel : field('title')).focus();
}

function armDelete() {
  state.deleteArmed = true;
  els.delete.textContent = '¿Seguro? Tocá de nuevo';
  clearTimeout(state.deleteTimer);
  state.deleteTimer = setTimeout(disarmDelete, 4000);
}

function disarmDelete() {
  clearTimeout(state.deleteTimer);
  state.deleteArmed = false;
  if (els.delete) els.delete.textContent = 'Eliminar';
}

function refocusAfterClose() {
  const rt = state.returnTo;
  state.returnTo = null;
  if (!rt) return;
  if (rt.opener && rt.opener.isConnected && typeof rt.opener.focus === 'function') {
    rt.opener.focus();
    return;
  }
  if (rt.jobId) {
    const chip = findChipEl(rt.jobId);
    if (chip) return chip.focus();
  }
  if (rt.date) {
    const cell = els.grid.querySelector(`[data-date="${rt.date}"]`);
    if (cell) cell.focus();
  }
}

// ---------- drag and drop ----------

function clearDropTargets(except = null) {
  for (const cell of Array.from(els.grid.querySelectorAll('.drop-target'))) {
    if (cell !== except) cell.classList.remove('drop-target');
  }
}

function refocusKeyMove(id) {
  if (state.keyMoveId !== id) return;
  state.keyMoveId = null;
  const chip = findChipEl(id);
  if (chip) chip.focus();
}

async function moveJob(id, date) {
  const job = findJob(id);
  if (!job || !canEditJob(job) || job.date === date) return;
  const previous = { ...job };
  replaceJob({ ...job, date });
  render({ droppedId: id });
  try {
    const data = await api(jobUrl(id), {
      method: 'PUT',
      body: { ...toPayload(previous), date, version: previous.version },
    });
    replaceJob(data.job);
    render();
    refocusKeyMove(id);
    toast('Trabajo movido.');
  } catch (err) {
    if (err.status === 404) {
      toast('Ese trabajo ya no existe o no lo podés ver.', true);
      loadJobs({ animate: false });
      return;
    }
    replaceJob(err.status === 409 && err.job ? err.job : previous);
    render();
    refocusKeyMove(id);
    toast(err.message, true);
  }
}

// ---------- wiring ----------

function wire() {
  els.prev.addEventListener('click', () => navigate(-1));
  els.next.addEventListener('click', () => navigate(1));
  els.today.addEventListener('click', goToday);
  els.newBtn.addEventListener('click', () => {
    if (canWrite()) openDialog({ date: today(), opener: els.newBtn });
  });
  for (const b of els.viewButtons) {
    b.addEventListener('click', () => setView(b.dataset.view));
  }
  const onFilter = () => {
    state.filters = {
      project: els.fProject.value,
      assignee: els.fAssignee.value,
      status: els.fStatus.value,
    };
    render();
  };
  els.fProject.addEventListener('change', onFilter);
  els.fAssignee.addEventListener('change', onFilter);
  els.fStatus.addEventListener('change', onFilter);

  // Grid: delegated clicks.
  els.grid.addEventListener('click', (e) => {
    const chip = e.target.closest('.cal-chip');
    if (chip && els.grid.contains(chip)) {
      const job = findJob(chip.dataset.jobId);
      if (job) openDialog({ job, opener: chip });
      return;
    }
    const more = e.target.closest('.cal-more');
    if (more) {
      const cell = more.closest(DAY_SEL);
      if (cell) goToWeek(parseIso(cell.dataset.date));
      return;
    }
    const cell = e.target.closest(DAY_SEL);
    if (cell && canWrite()) openDialog({ date: parseIso(cell.dataset.date), opener: cell });
  });

  // Grid: delegated drag and drop.
  els.grid.addEventListener('dragstart', (e) => {
    const chip = e.target.closest ? e.target.closest('.cal-chip') : null;
    if (!chip || !canWrite() || chip.getAttribute('draggable') !== 'true') {
      e.preventDefault();
      return;
    }
    state.dragId = chip.dataset.jobId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', state.dragId);
    setTimeout(() => chip.classList.add('dragging'), 0);
  });
  els.grid.addEventListener('dragend', () => {
    state.dragId = null;
    for (const c of Array.from(els.grid.querySelectorAll('.dragging'))) c.classList.remove('dragging');
    clearDropTargets();
  });
  els.grid.addEventListener('dragover', (e) => {
    if (!state.dragId) return;
    const cell = e.target.closest ? e.target.closest(DAY_SEL) : null;
    clearDropTargets(cell);
    if (!cell || !els.grid.contains(cell)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    cell.classList.add('drop-target');
  });
  els.grid.addEventListener('dragleave', (e) => {
    const cell = e.target.closest ? e.target.closest(DAY_SEL) : null;
    if (!cell) return;
    if (e.relatedTarget && cell.contains(e.relatedTarget)) return;
    cell.classList.remove('drop-target');
  });
  els.grid.addEventListener('drop', (e) => {
    if (!state.dragId) return;
    e.preventDefault();
    const cell = e.target.closest ? e.target.closest(DAY_SEL) : null;
    clearDropTargets();
    const id = state.dragId;
    state.dragId = null;
    if (cell) moveJob(id, cell.dataset.date);
  });

  // Dialog.
  window.addEventListener('hashchange', onHashChange);

  els.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state.editing ? !canEditJob(state.editing) : !canWrite()) return;
    const payload = readForm();
    if (!writable().includes(payload.project)) {
      setFormError('No tenés permiso de edición en ese proyecto.', field('project'));
      return;
    }
    const problem = validatePayload(payload);
    if (problem) {
      setFormError(problem[1], field(problem[0]));
      return;
    }
    els.save.disabled = true;
    let message;
    try {
      if (state.editing) {
        await api(jobUrl(state.editing.id), {
          method: 'PUT',
          body: { ...payload, version: state.editing.version },
        });
        message = 'Trabajo actualizado.';
      } else {
        await api('/api/calendar/jobs', { method: 'POST', body: payload });
        message = 'Trabajo creado.';
      }
      await loadJobs({ animate: false });
      els.dialog.close();
      toast(message);
    } catch (err) {
      if (err.status === 409 && err.job) {
        // Keep what the user typed; the next Save overwrites with the new version.
        state.editing = err.job;
        setFormError('Otra persona modificó este trabajo. Revisá los cambios y volvé a guardar para sobrescribir, o cerrá para ver la versión actual.');
        loadJobs({ animate: false });
      } else if (err.status === 404) {
        toast('Ese trabajo ya no existe o no lo podés ver.', true);
        await loadJobs({ animate: false });
        els.dialog.close();
      } else {
        setFormError(err.message);
      }
    } finally {
      els.save.disabled = false;
    }
  });

  els.cancel.addEventListener('click', (e) => {
    e.preventDefault();
    els.dialog.close();
  });

  els.delete.addEventListener('click', async () => {
    const job = state.editing;
    if (!job || !canDelete(job)) return;
    if (!state.deleteArmed) {
      armDelete();
      return;
    }
    disarmDelete();
    els.delete.disabled = true;
    try {
      await api(jobUrl(job.id), { method: 'DELETE' });
      await loadJobs({ animate: false });
      els.dialog.close();
      toast('Trabajo eliminado.');
    } catch (err) {
      if (err.status === 404) {
        toast('Ese trabajo ya no existe o no lo podés ver.', true);
        await loadJobs({ animate: false });
        els.dialog.close();
      } else {
        setFormError(err.message);
      }
    } finally {
      els.delete.disabled = false;
    }
  });

  field('allDay').addEventListener('change', syncTimeFields);

  els.dialog.addEventListener('close', () => {
    disarmDelete();
    state.editing = null;
    setFormError('');
    refocusAfterClose();
  });

  // Keyboard shortcuts.
  document.addEventListener('keydown', (e) => {
    if (els.dialog.open || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target;
    if (target instanceof HTMLElement && target.matches('input, select, textarea, [contenteditable]')) return;
    // Keyboard alternative to drag: Shift+←/→ on a focused chip moves it one day.
    if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && target instanceof HTMLElement && target.matches('.cal-chip')) {
      const job = findJob(target.dataset.jobId);
      if (job && canEditJob(job)) {
        e.preventDefault();
        const base = parseIso(job.date);
        const moved = addDays(base, e.key === 'ArrowLeft' ? -1 : 1);
        state.keyMoveId = job.id;
        moveJob(job.id, iso(moved));
      }
      return;
    }
    switch (e.key) {
      case 'n':
      case 'N':
        if (canWrite()) {
          e.preventDefault();
          openDialog({ date: today(), opener: els.newBtn });
        }
        break;
      case 't':
      case 'T':
        goToday();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        navigate(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        navigate(1);
        break;
      default:
        break;
    }
  });

  // Narrow screens force the agenda view.
  if (els.narrow) {
    const onNarrow = () => {
      const was = state.view;
      syncForced();
      updateButtons();
      if (!state.forced) commitRoute();
      if (state.view !== was) loadJobs();
    };
    if (els.narrow.addEventListener) els.narrow.addEventListener('change', onNarrow);
    else els.narrow.addListener(onNarrow);
  }
}

// ---------- init ----------

async function init() {
  wire();
  syncForced();
  const route = parseRoute(location.hash);
  if (route) {
    if (route.cursor) state.cursor = route.cursor;
    if (!state.forced) {
      state.view = route.view;
      state.preferredView = route.view;
    }
  }
  updateButtons();
  els.newBtn.disabled = true;
  showGridMessage('Cargando calendario…');
  try {
    const me = await api('/auth/me');
    state.csrf = me.csrf;
    state.user = me.user;
  } catch (err) {
    if (err.status !== 401) showGridMessage(err.message, 'is-error');
    return;
  }
  ensureOptions(els.fProject, PROJECTS, true);
  ensureOptions(els.fStatus, STATUSES, true);
  ensureOptions(field('kind'), KINDS, false);
  ensureOptions(field('status'), STATUSES, false);
  const people = api('/api/calendar/people')
    .then((data) => fillPeople(Array.isArray(data.people) ? data.people : []))
    .catch((err) => {
      if (err.status !== 401 && err.status !== 403) toast(err.message, true);
    });
  await Promise.all([people, loadJobs({ animate: true })]);
  commitRoute(true);
}

function start() {
  els = {
    grid: document.querySelector('#cal-grid'),
    prev: document.querySelector('#cal-prev'),
    next: document.querySelector('#cal-next'),
    today: document.querySelector('#cal-today'),
    title: document.querySelector('#cal-title'),
    viewButtons: Array.from(document.querySelectorAll('[data-view]')),
    newBtn: document.querySelector('#cal-new'),
    readonly: document.querySelector('#cal-readonly'),
    toast: document.querySelector('#toast'),
    fProject: document.querySelector('#f-project'),
    fAssignee: document.querySelector('#f-assignee'),
    fStatus: document.querySelector('#f-status'),
    dialog: document.querySelector('#job-dialog'),
    form: document.querySelector('#job-form'),
    save: document.querySelector('#job-save'),
    delete: document.querySelector('#job-delete'),
    cancel: document.querySelector('#job-cancel'),
    formError: document.querySelector('#job-error'),
    dialogTitle: document.querySelector('#job-dialog-title'),
    narrow: typeof matchMedia === 'function' ? matchMedia('(max-width: 699.98px)') : null,
  };
  state.cursor = today();
  init();
}

export const __test = { iso, parseIso, addDays, weekStart, monthRange, monthGrid, formatTitle, filterJobs, compareJobs, groupByDate };

if (typeof document !== 'undefined') start();
