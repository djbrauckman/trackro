/**
 * exercise.js
 * Logic for exercise.html: log entries, render type-count tiles + history table.
 */
document.addEventListener('DOMContentLoaded', () => {
  initNav('exercise');
  document.getElementById('eDate').value = todayISO();
  resetExerciseRows();
  updateCategoryFields();

  document.getElementById('eCategory').addEventListener('change', updateCategoryFields);
  document.getElementById('eSubmit').addEventListener('click', submitExercise);
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
      });
    });

    if (!items.length) {
      errorEl.textContent = 'Add at least one exercise.';
      return;
    }
  }

  const { data: inserted, error } = await supabaseClient.from('exercise_entries').insert(entry).select().single();
  if (error) {
    errorEl.textContent = error.message;
    return;
  }

  if (items.length) {
    const itemRows = items.map(it => ({ ...it, exercise_entry_id: inserted.id }));
    const { error: itemsError } = await supabaseClient.from('exercise_items').insert(itemRows);
    if (itemsError) {
      errorEl.textContent = itemsError.message;
      await supabaseClient.from('exercise_entries').delete().eq('id', inserted.id);
      return;
    }
  }

  ['eName', 'eDuration', 'eDistance', 'ePace', 'eCalories', 'eNotes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  resetExerciseRows();
  loadExerciseData();
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

  renderExerciseCounts(entries);
  renderExerciseHistory(entries, items);
}

const EXERCISE_CATEGORIES = ['cardio', 'lifting', 'core'];

function renderExerciseCounts(rows) {
  const counts = { cardio: 0, lifting: 0, core: 0 };
  rows.forEach(r => {
    if (counts[r.category] != null) counts[r.category]++;
  });

  const tiles = EXERCISE_CATEGORIES.map(cat => [cat.charAt(0).toUpperCase() + cat.slice(1), counts[cat]]);
  tiles.push(['Total', rows.length]);

  document.getElementById('eCounts').innerHTML = tiles.map(([label, value]) => `
    <div class="stat-chip"><span>${value}</span>${label}</div>
  `).join('');
}

function renderExerciseHistory(rows, items) {
  const historyEl = document.getElementById('eHistory');
  if (!rows.length) {
    historyEl.innerHTML = '<div class="empty-note">No entries yet.</div>';
    return;
  }

  const itemsByEntry = {};
  items.forEach(it => {
    (itemsByEntry[it.exercise_entry_id] = itemsByEntry[it.exercise_entry_id] || []).push(it);
  });

  const grids = [
    renderCardioGrid(rows.filter(r => r.category === 'cardio')),
    renderStrengthGrid(rows.filter(r => r.category === 'lifting'), itemsByEntry, 'Lifting'),
    renderStrengthGrid(rows.filter(r => r.category === 'core'), itemsByEntry, 'Core'),
  ].filter(Boolean);

  historyEl.innerHTML = grids.join('') || '<div class="empty-note">No entries yet.</div>';
}

function renderCardioGrid(rows) {
  if (!rows.length) return '';

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
      <td><button class="btn-danger" onclick="deleteExercise('${r.id}')">Delete</button></td>
    </tr>
  `).join('');

  return `
    <h3 class="history-subhead">Cardio</h3>
    <div class="table-scroll">
      <table class="history-table">
        <thead>
          <tr><th>Date</th><th>Title</th><th>Duration</th><th>Distance</th><th>Pace</th><th>Cal</th><th>Notes</th><th></th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

// Renders one row per exercise item; legacy entries saved before exercise_items
// existed fall back to their old serialized `details` text as a single line.
function renderStrengthGrid(rows, itemsByEntry, label) {
  if (!rows.length) return '';

  const rowsHtml = rows.slice(0, 40).flatMap(r => {
    const entryItems = itemsByEntry[r.id];
    const lines = entryItems && entryItems.length
      ? entryItems.map(it => [it.name, it.sets, it.reps, it.load_lbs])
      : [[r.details || '—', null, null, null]];

    return lines.map(([name, sets, reps, load], idx) => `
      <tr${idx === 0 ? ' class="group-start"' : ''}>
        <td>${idx === 0 ? formatDateShort(r.logged_at) : ''}</td>
        <td>${idx === 0 ? escapeHtml(r.exercise_name) : ''}</td>
        <td>${escapeHtml(name)}</td>
        <td>${sets ?? '—'}</td>
        <td>${reps ?? '—'}</td>
        <td>${load ? `${load} lbs` : '—'}</td>
        <td>${idx === 0 ? (r.duration_min ? formatMinutesSeconds(r.duration_min) : '—') : ''}</td>
        <td>${idx === 0 ? (r.calories_burned ? r.calories_burned : '—') : ''}</td>
        <td>${idx === 0 ? (r.notes ? escapeHtml(r.notes) : '—') : ''}</td>
        <td>${idx === 0 ? `<button class="btn-danger" onclick="deleteExercise('${r.id}')">Delete</button>` : ''}</td>
      </tr>
    `).join('');
  }).join('');

  return `
    <h3 class="history-subhead">${escapeHtml(label)}</h3>
    <div class="table-scroll">
      <table class="history-table">
        <thead>
          <tr><th>Date</th><th>Title</th><th>Exercise</th><th>Sets</th><th>Reps</th><th>Load</th><th>Duration</th><th>Cal</th><th>Notes</th><th></th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}
