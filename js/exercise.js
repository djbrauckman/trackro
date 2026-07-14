/**
 * exercise.js
 * Logic for exercise.html: log entries, render type-count tiles + history table.
 */
let editingExerciseId = null;
let exerciseRows = [];
let exerciseItemsByEntry = {};
let openExerciseSections = new Set();

const CATEGORY_LABELS = { cardio: 'Cardio', lifting: 'Lift', core: 'Core' };

document.addEventListener('DOMContentLoaded', () => {
  initNav('exercise');
  document.getElementById('eDate').value = todayISO();
  resetExerciseRows();
  updateCategoryFields();

  document.getElementById('eCategory').addEventListener('change', updateCategoryFields);
  document.getElementById('eSubmit').addEventListener('click', submitExercise);
  document.getElementById('eCancelEdit').addEventListener('click', cancelExerciseEdit);
  document.getElementById('eAddExercise').addEventListener('click', addExerciseRow);
  document.getElementById('eExercises').addEventListener('click', (e) => {
    if (e.target.classList.contains('ex-remove')) {
      removeExerciseRow(e.target.closest('.repeatable-row'));
    }
  });
  document.getElementById('eDuration').addEventListener('blur', updatePaceField);
  document.getElementById('eDistance').addEventListener('blur', updatePaceField);

  loadExerciseData();
});

function setExerciseFormMode(mode) {
  document.getElementById('eSubmit').textContent = mode === 'edit' ? 'Update entry' : 'Save entry';
  document.getElementById('eCancelEdit').style.display = mode === 'edit' ? '' : 'none';
}

// Parses "mm:ss" (or a bare number of minutes) into fractional minutes.
function parseMinutesSeconds(str) {
  if (!str) return null;
  const trimmed = str.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':');
  if (parts.length === 1) {
    const n = parseFloat(parts[0]);
    return isNaN(n) ? null : n;
  }
  const mins = parseInt(parts[0], 10) || 0;
  const secs = parseFloat(parts[1]) || 0;
  return mins + secs / 60;
}

function formatMinutesSeconds(totalMinutes) {
  if (totalMinutes == null || isNaN(totalMinutes)) return '';
  const totalSeconds = Math.round(totalMinutes * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateCategoryFields() {
  const isCardio = document.getElementById('eCategory').value === 'cardio';
  document.getElementById('eCardioFields').style.display = isCardio ? '' : 'none';
  document.getElementById('eLiftFields').style.display = isCardio ? 'none' : '';
}

// Recomputes pace from duration + distance, unless the user is actively editing the pace field.
function updatePaceField() {
  if (document.activeElement === document.getElementById('ePace')) return;
  const durationMin = parseMinutesSeconds(document.getElementById('eDuration').value);
  const distanceMi = parseFloat(document.getElementById('eDistance').value);
  if (!durationMin || !distanceMi) return;
  document.getElementById('ePace').value = formatMinutesSeconds(durationMin / distanceMi);
}

function exerciseRowEl() {
  const div = document.createElement('div');
  div.className = 'repeatable-row';
  div.innerHTML = `
    <div class="repeatable-row-head">
      <span>Exercise</span>
      <button type="button" class="btn-danger ex-remove">Remove</button>
    </div>
    <div style="margin-bottom:16px">
      <div class="label">Name</div>
      <input type="text" class="ex-name" placeholder="e.g. Squat" />
    </div>
    <div class="input-row-3">
      <div>
        <div class="label">Sets</div>
        <input type="number" class="ex-sets" step="1" />
      </div>
      <div>
        <div class="label">Reps</div>
        <input type="number" class="ex-reps" step="1" />
      </div>
      <div>
        <div class="label">Load (lbs)</div>
        <input type="number" class="ex-load" step="0.5" />
      </div>
    </div>
    <div style="margin-bottom:16px">
      <div class="label">Notes (optional)</div>
      <input type="text" class="ex-item-notes" placeholder="e.g. felt strong, used cambered bar" />
    </div>
  `;
  return div;
}

function addExerciseRow() {
  document.getElementById('eExercises').appendChild(exerciseRowEl());
  updateExerciseRemoveButtons();
}

function removeExerciseRow(rowEl) {
  rowEl.remove();
  updateExerciseRemoveButtons();
}

function updateExerciseRemoveButtons() {
  const rows = document.querySelectorAll('#eExercises .repeatable-row');
  rows.forEach(row => {
    row.querySelector('.ex-remove').style.display = rows.length > 1 ? '' : 'none';
  });
}

function resetExerciseRows() {
  const container = document.getElementById('eExercises');
  container.innerHTML = '';
  container.appendChild(exerciseRowEl());
  updateExerciseRemoveButtons();
}

async function submitExercise() {
  const errorEl = document.getElementById('eError');
  errorEl.textContent = '';

  const logged_at = document.getElementById('eDate').value;
  const exercise_name = document.getElementById('eName').value.trim();
  const category = document.getElementById('eCategory').value;

  if (!logged_at || !exercise_name) {
    errorEl.textContent = 'Enter a date and title.';
    return;
  }

  const numOrNull = (id) => {
    const v = document.getElementById(id).value;
    return v === '' ? null : parseFloat(v);
  };
  const numOrNullFromEl = (el) => (el.value === '' ? null : parseFloat(el.value));

  const duration_min = parseMinutesSeconds(document.getElementById('eDuration').value);

  const entry = {
    logged_at,
    exercise_name,
    category,
    duration_min,
    calories_burned: numOrNull('eCalories'),
    notes: document.getElementById('eNotes').value.trim() || null,
    sets: null,
    reps: null,
    load_lbs: null,
    distance_mi: null,
    pace_sec_per_mi: null,
    details: null,
  };

  let items = [];

  if (category === 'cardio') {
    const distance_mi = numOrNull('eDistance');
    entry.distance_mi = distance_mi;

    const paceMin = parseMinutesSeconds(document.getElementById('ePace').value);
    entry.pace_sec_per_mi = paceMin != null
      ? paceMin * 60
      : (duration_min && distance_mi ? (duration_min / distance_mi) * 60 : null);
  } else {
    document.querySelectorAll('#eExercises .repeatable-row').forEach((row, position) => {
      const name = row.querySelector('.ex-name').value.trim();
      if (!name) return;
      items.push({
        position,
        name,
        sets: numOrNullFromEl(row.querySelector('.ex-sets')),
        reps: numOrNullFromEl(row.querySelector('.ex-reps')),
        load_lbs: numOrNullFromEl(row.querySelector('.ex-load')),
        notes: row.querySelector('.ex-item-notes').value.trim() || null,
      });
    });

    if (!items.length) {
      errorEl.textContent = 'Add at least one exercise.';
      return;
    }
  }

  let entryId = editingExerciseId;

  if (editingExerciseId) {
    const { error: updateError } = await supabaseClient.from('exercise_entries').update(entry).eq('id', editingExerciseId);
    if (updateError) {
      errorEl.textContent = updateError.message;
      return;
    }
    // Replace whatever items existed before — simpler than diffing, and category may have changed.
    await supabaseClient.from('exercise_items').delete().eq('exercise_entry_id', entryId);
  } else {
    const { data: inserted, error: insertError } = await supabaseClient.from('exercise_entries').insert(entry).select().single();
    if (insertError) {
      errorEl.textContent = insertError.message;
      return;
    }
    entryId = inserted.id;
  }

  if (items.length) {
    const itemRows = items.map(it => ({ ...it, exercise_entry_id: entryId }));
    const { error: itemsError } = await supabaseClient.from('exercise_items').insert(itemRows);
    if (itemsError) {
      errorEl.textContent = itemsError.message;
      if (!editingExerciseId) await supabaseClient.from('exercise_entries').delete().eq('id', entryId);
      return;
    }
  }

  editingExerciseId = null;
  setExerciseFormMode('add');
  ['eName', 'eDuration', 'eDistance', 'ePace', 'eCalories', 'eNotes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  resetExerciseRows();
  loadExerciseData();
}

function editExercise(id) {
  const r = exerciseRows.find(x => x.id === id);
  if (!r) return;

  editingExerciseId = id;

  document.getElementById('eDate').value = r.logged_at;
  document.getElementById('eCategory').value = r.category;
  document.getElementById('eName').value = r.exercise_name;
  document.getElementById('eDuration').value = r.duration_min ? formatMinutesSeconds(r.duration_min) : '';
  document.getElementById('eCalories').value = r.calories_burned ?? '';
  document.getElementById('eNotes').value = r.notes ?? '';

  updateCategoryFields();

  if (r.category === 'cardio') {
    document.getElementById('eDistance').value = r.distance_mi ?? '';
    document.getElementById('ePace').value = r.pace_sec_per_mi ? formatMinutesSeconds(r.pace_sec_per_mi / 60) : '';
  } else {
    document.getElementById('eDistance').value = '';
    document.getElementById('ePace').value = '';
    const container = document.getElementById('eExercises');
    container.innerHTML = '';
    const entryItems = exerciseItemsByEntry[id];
    if (entryItems && entryItems.length) {
      entryItems.forEach(it => {
        const row = exerciseRowEl();
        row.querySelector('.ex-name').value = it.name;
        row.querySelector('.ex-sets').value = it.sets ?? '';
        row.querySelector('.ex-reps').value = it.reps ?? '';
        row.querySelector('.ex-load').value = it.load_lbs ?? '';
        row.querySelector('.ex-item-notes').value = it.notes ?? '';
        container.appendChild(row);
      });
    } else {
      container.appendChild(exerciseRowEl());
    }
    updateExerciseRemoveButtons();
  }

  setExerciseFormMode('edit');
  document.getElementById('eDate').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelExerciseEdit() {
  editingExerciseId = null;
  document.getElementById('eDate').value = todayISO();
  document.getElementById('eCategory').value = 'cardio';
  updateCategoryFields();
  ['eName', 'eDuration', 'eDistance', 'ePace', 'eCalories', 'eNotes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  resetExerciseRows();
  setExerciseFormMode('add');
}

async function deleteExercise(id) {
  await supabaseClient.from('exercise_entries').delete().eq('id', id);
  loadExerciseData();
}

async function loadExerciseData() {
  const { data: entries, error } = await supabaseClient
    .from('exercise_entries')
    .select('*')
    .gte('logged_at', daysAgoISO(90))
    .order('logged_at', { ascending: false });

  const historyEl = document.getElementById('eHistory');
  if (error) {
    historyEl.innerHTML = `<div class="empty-note">${escapeHtml(error.message)}</div>`;
    return;
  }

  const strengthIds = entries.filter(e => e.category !== 'cardio').map(e => e.id);
  let items = [];
  if (strengthIds.length) {
    const { data: itemRows } = await supabaseClient
      .from('exercise_items')
      .select('*')
      .in('exercise_entry_id', strengthIds)
      .order('position', { ascending: true });
    items = itemRows || [];
  }

  exerciseRows = entries;
  exerciseItemsByEntry = {};
  items.forEach(it => {
    (exerciseItemsByEntry[it.exercise_entry_id] = exerciseItemsByEntry[it.exercise_entry_id] || []).push(it);
  });

  renderExerciseCounts(entries);
  renderExerciseHistory(entries);
}

const EXERCISE_CATEGORIES = ['cardio', 'lifting', 'core'];

function renderExerciseCounts(rows) {
  const counts = { cardio: 0, lifting: 0, core: 0 };
  rows.forEach(r => {
    if (counts[r.category] != null) counts[r.category]++;
  });

  const tiles = EXERCISE_CATEGORIES.map(cat => [CATEGORY_LABELS[cat], counts[cat]]);
  tiles.push(['Total', rows.length]);

  document.getElementById('eCounts').innerHTML = tiles.map(([label, value]) => `
    <div class="stat-chip"><span>${value}</span>${label}</div>
  `).join('');
}

function toggleExerciseSection(key) {
  if (openExerciseSections.has(key)) openExerciseSections.delete(key);
  else openExerciseSections.add(key);
  renderExerciseHistory(exerciseRows);
}

function renderExerciseHistory(rows) {
  const historyEl = document.getElementById('eHistory');
  if (!rows.length) {
    historyEl.innerHTML = '<div class="empty-note">No entries yet.</div>';
    return;
  }

  const grids = [
    renderCardioGrid(rows.filter(r => r.category === 'cardio')),
    renderStrengthGrid(rows.filter(r => r.category === 'lifting'), 'lifting'),
    renderStrengthGrid(rows.filter(r => r.category === 'core'), 'core'),
  ].filter(Boolean);

  historyEl.innerHTML = grids.join('') || '<div class="empty-note">No entries yet.</div>';
}

function renderCardioGrid(rows) {
  if (!rows.length) return '';

  const isOpen = openExerciseSections.has('cardio');

  const durationCell = (r) => r.duration_min ? formatMinutesSeconds(r.duration_min) : '—';
  const distanceCell = (r) => r.distance_mi ? `${r.distance_mi} mi` : '—';
  const paceCell = (r) => r.pace_sec_per_mi ? `${formatMinutesSeconds(r.pace_sec_per_mi / 60)}/mi` : '—';
  const caloriesCell = (r) => r.calories_burned ? `${r.calories_burned}` : '—';

  const rowsHtml = rows.slice(0, 40).map(r => `
    <tr>
      <td>${formatDateShort(r.logged_at)}</td>
      <td>${escapeHtml(r.exercise_name)}</td>
      <td>${durationCell(r)}</td>
      <td>${distanceCell(r)}</td>
      <td>${paceCell(r)}</td>
      <td>${caloriesCell(r)}</td>
      <td>${r.notes ? escapeHtml(r.notes) : '—'}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" title="Edit" onclick="editExercise('${r.id}')">${ICON_EDIT}</button>
          <button class="icon-btn icon-btn-danger" title="Delete" onclick="deleteExercise('${r.id}')">${ICON_TRASH}</button>
        </div>
      </td>
    </tr>
  `).join('');

  return `
    <div class="history-subhead-row" onclick="toggleExerciseSection('cardio')">
      <h3 class="history-subhead">
        <span class="collapsible-chevron${isOpen ? ' open' : ''}">${ICON_CHEVRON}</span>
        Cardio <span class="history-subhead-meta">(${rows.length})</span>
      </h3>
      <button class="btn-tiny" onclick="event.stopPropagation(); exportCardioCSV()">Export CSV</button>
    </div>
    <div class="collapsible-body${isOpen ? ' open' : ''}">
      <div class="table-scroll">
        <table class="history-table">
          <thead>
            <tr><th>Date</th><th>Title</th><th>Duration</th><th>Distance</th><th>Pace</th><th>Cal</th><th>Notes</th><th></th></tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>
  `;
}

// Renders one row per exercise item; legacy entries saved before exercise_items
// existed fall back to their old serialized `details` text as a single line.
function renderStrengthGrid(rows, category) {
  if (!rows.length) return '';

  const isOpen = openExerciseSections.has(category);
  const label = CATEGORY_LABELS[category];

  const rowsHtml = rows.slice(0, 40).flatMap(r => {
    const entryItems = exerciseItemsByEntry[r.id];
    const lines = entryItems && entryItems.length
      ? entryItems.map(it => [it.name, it.sets, it.reps, it.load_lbs, it.notes])
      : [[r.details || '—', null, null, null, null]];

    return lines.map(([name, sets, reps, load, note], idx) => `
      <tr${idx === 0 ? ' class="group-start"' : ''}>
        <td>${idx === 0 ? formatDateShort(r.logged_at) : ''}</td>
        <td>${idx === 0 ? escapeHtml(r.exercise_name) : ''}</td>
        <td>${escapeHtml(name)}${note ? `<div class="cell-note">${escapeHtml(note)}</div>` : ''}</td>
        <td>${sets ?? '—'}</td>
        <td>${reps ?? '—'}</td>
        <td>${load ? `${load} lbs` : '—'}</td>
        <td>${idx === 0 ? (r.duration_min ? formatMinutesSeconds(r.duration_min) : '—') : ''}</td>
        <td>${idx === 0 ? (r.calories_burned ? r.calories_burned : '—') : ''}</td>
        <td>${idx === 0 ? (r.notes ? escapeHtml(r.notes) : '—') : ''}</td>
        <td>${idx === 0 ? `
          <div class="row-actions">
            <button class="icon-btn" title="Edit" onclick="editExercise('${r.id}')">${ICON_EDIT}</button>
            <button class="icon-btn icon-btn-danger" title="Delete" onclick="deleteExercise('${r.id}')">${ICON_TRASH}</button>
          </div>
        ` : ''}</td>
      </tr>
    `).join('');
  }).join('');

  return `
    <div class="history-subhead-row" onclick="toggleExerciseSection('${category}')">
      <h3 class="history-subhead">
        <span class="collapsible-chevron${isOpen ? ' open' : ''}">${ICON_CHEVRON}</span>
        ${escapeHtml(label)} <span class="history-subhead-meta">(${rows.length})</span>
      </h3>
      <button class="btn-tiny" onclick="event.stopPropagation(); exportStrengthCSV('${category}')">Export CSV</button>
    </div>
    <div class="collapsible-body${isOpen ? ' open' : ''}">
      <div class="table-scroll">
        <table class="history-table">
          <thead>
            <tr><th>Date</th><th>Title</th><th>Exercise</th><th>Sets</th><th>Reps</th><th>Load</th><th>Duration</th><th>Cal</th><th>Notes</th><th></th></tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>
  `;
}

async function exportCardioCSV() {
  const { data, error } = await supabaseClient
    .from('exercise_entries')
    .select('*')
    .eq('category', 'cardio')
    .order('logged_at', { ascending: true });
  if (error || !data || !data.length) return;

  const rows = [['Date', 'Title', 'Duration', 'Distance (mi)', 'Pace (min/mi)', 'Calories', 'Notes']];
  data.forEach(r => {
    rows.push([
      r.logged_at,
      r.exercise_name,
      r.duration_min ? formatMinutesSeconds(r.duration_min) : '',
      r.distance_mi ?? '',
      r.pace_sec_per_mi ? formatMinutesSeconds(r.pace_sec_per_mi / 60) : '',
      r.calories_burned ?? '',
      r.notes ?? '',
    ]);
  });
  downloadCSV('trackro-cardio.csv', rows);
}

async function exportStrengthCSV(category) {
  const { data: entries, error } = await supabaseClient
    .from('exercise_entries')
    .select('*')
    .eq('category', category)
    .order('logged_at', { ascending: true });
  if (error || !entries || !entries.length) return;

  const ids = entries.map(e => e.id);
  const { data: itemRows } = await supabaseClient
    .from('exercise_items')
    .select('*')
    .in('exercise_entry_id', ids)
    .order('position', { ascending: true });

  const itemsByEntry = {};
  (itemRows || []).forEach(it => {
    (itemsByEntry[it.exercise_entry_id] = itemsByEntry[it.exercise_entry_id] || []).push(it);
  });

  const rows = [['Date', 'Title', 'Exercise', 'Sets', 'Reps', 'Load (lbs)', 'Exercise Notes', 'Duration', 'Calories', 'Workout Notes']];
  entries.forEach(r => {
    const entryItems = itemsByEntry[r.id];
    const lines = entryItems && entryItems.length
      ? entryItems.map(it => [it.name, it.sets ?? '', it.reps ?? '', it.load_lbs ?? '', it.notes ?? ''])
      : [[r.details || '', '', '', '', '']];

    lines.forEach(([name, sets, reps, load, notes]) => {
      rows.push([
        r.logged_at,
        r.exercise_name,
        name,
        sets,
        reps,
        load,
        notes,
        r.duration_min ? formatMinutesSeconds(r.duration_min) : '',
        r.calories_burned ?? '',
        r.notes ?? '',
      ]);
    });
  });
  downloadCSV(`trackro-${category}.csv`, rows);
}
